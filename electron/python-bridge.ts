import { ChildProcess, spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import { app, BrowserWindow } from "electron";
import WebSocket from "ws";
import { store } from "./store";

const BACKEND_PORT = 8769;
const HEALTH_URL = `http://127.0.0.1:${BACKEND_PORT}/health`;
const MODEL_STATUS_URL = `http://127.0.0.1:${BACKEND_PORT}/model/status`;
const MODELS_URL = `http://127.0.0.1:${BACKEND_PORT}/models`;
const TRANSCRIPTION_CONFIG_URL = `http://127.0.0.1:${BACKEND_PORT}/transcription/config`;
const MODEL_WS_URL = `ws://127.0.0.1:${BACKEND_PORT}/ws/model`;

function findVenvPython(backendDir: string): string {
  const candidates =
    process.platform === "win32"
      ? [
          path.join(backendDir, ".venv", "Scripts", "python.exe"),
          path.join(backendDir, "venv", "Scripts", "python.exe"),
        ]
      : [
          path.join(backendDir, ".venv", "bin", "python"),
          path.join(backendDir, "venv", "bin", "python"),
          path.join(backendDir, ".venv", "bin", "python3"),
          path.join(backendDir, "venv", "bin", "python3"),
        ];

  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }

  return process.platform === "win32" ? "python" : "python3";
}

export class PythonBridge {
  private proc: ChildProcess | null = null;
  private _ownsProcess = false;
  private _procExited = false;
  private _status:
    | "stopped"
    | "starting"
    | "no_model"
    | "downloading"
    | "downloaded"
    | "loading"
    | "ready"
    | "error" = "stopped";
  private healthPoll: ReturnType<typeof setInterval> | null = null;
  private modelWs: WebSocket | null = null;

  get status() {
    return this._status;
  }

  async start() {
    if (this.proc) return;
    this._status = "starting";
    this._autoLoadAttempted = false;
    this.broadcastStatus();

    const existing = await this.probeExistingBackend();
    if (existing) {
      console.log("[python-bridge] Found existing backend on port", BACKEND_PORT, "- adopting it");
      this._ownsProcess = false;
      this._status = existing;
      this.broadcastStatus();
      this.startHealthPolling();
      return;
    }

    this._ownsProcess = true;
    const backendDir = app.isPackaged
      ? path.join(process.resourcesPath, "backend")
      : path.join(__dirname, "../backend");

    const pythonCmd = findVenvPython(backendDir);
    console.log(`[python-bridge] Using Python: ${pythonCmd}`);

    this._procExited = false;

    this.proc = spawn(pythonCmd, ["server.py"], {
      cwd: backendDir,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        VTT_PORT: String(BACKEND_PORT),
        VTT_MODEL: String(store.get("modelSize") || "large-v3"),
        VTT_TRANSCRIPTION_PROFILE: String(store.get("transcriptionProfile") || "balanced"),
        VTT_LANGUAGE_HINT: String(store.get("languageHint") || "auto"),
      },
    });

    const logStdout = (data: Buffer) => {
      if (this._procExited) return;
      const msg = data.toString().trim();
      if (msg) {
        try {
          console.log("[python]", msg);
        } catch {
          // Ignore write errors if pipe is broken
        }
      }
    };

    const logStderr = (data: Buffer) => {
      if (this._procExited) return;
      const msg = data.toString().trim();
      if (msg) {
        try {
          console.error("[python]", msg);
        } catch {
          // Ignore write errors if pipe is broken
        }
      }
    };

    this.proc.stdout?.on("data", logStdout);
    this.proc.stdout?.on("error", () => { /* ignore pipe errors */ });

    this.proc.stderr?.on("data", logStderr);
    this.proc.stderr?.on("error", () => { /* ignore pipe errors */ });

    this.proc.on("error", (err) => {
      console.error("[python-bridge] Process error:", err.message);
      this._procExited = true;
    });

    this.proc.on("exit", (code) => {
      this._procExited = true;
      console.log(`Python backend exited with code ${code}`);
      this.proc = null;
      if (this._status !== "stopped") {
        this._status = "error";
        this.broadcastStatus();
      }
    });

    this.startHealthPolling();
  }

  stop() {
    this._status = "stopped";
    this._autoLoadAttempted = false;
    this._procExited = true;
    this.stopHealthPolling();
    this.disconnectModelWs();

    if (this.proc && this._ownsProcess) {
      try {
        this.proc.kill("SIGTERM");
      } catch {
        // Process may already be dead
      }
      setTimeout(() => {
        if (this.proc && !this.proc.killed) {
          try {
            this.proc.kill("SIGKILL");
          } catch {
            // Process may already be dead
          }
        }
      }, 3000);
    }
    this.proc = null;
  }

  private async probeExistingBackend(): Promise<typeof this._status | null> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);
      const resp = await fetch(HEALTH_URL, { signal: controller.signal });
      clearTimeout(timeout);
      const data = await resp.json();
      const hStatus = data.status as string;
      if (hStatus === "ready") return "ready";
      if (hStatus === "loading") return "loading";
      return "no_model";
    } catch {
      return null;
    }
  }

  async getModelStatus(model?: string): Promise<Record<string, unknown>> {
    try {
      const url = model
        ? `${MODEL_STATUS_URL}?model=${encodeURIComponent(model)}`
        : MODEL_STATUS_URL;
      const resp = await fetch(url);
      return (await resp.json()) as Record<string, unknown>;
    } catch {
      return { status: "error", model: model || "", size_mb: 0, device: "unknown" };
    }
  }

  async getModels(): Promise<Record<string, unknown>> {
    try {
      const resp = await fetch(MODELS_URL);
      return (await resp.json()) as Record<string, unknown>;
    } catch {
      return { default_model: "large-v3", models: [] };
    }
  }

  async updateTranscriptionConfig(profile: string, languageHint: string): Promise<Record<string, unknown>> {
    try {
      const resp = await fetch(TRANSCRIPTION_CONFIG_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile,
          language_hint: languageHint,
        }),
      });
      return (await resp.json()) as Record<string, unknown>;
    } catch {
      return { status: "error" };
    }
  }

  startModelDownload(model: string) {
    this.connectModelWs((ws) => {
      ws.send(JSON.stringify({ action: "download", model }));
    });
  }

  loadModel(model: string) {
    this.connectModelWs((ws) => {
      ws.send(JSON.stringify({ action: "load", model }));
    });
  }

  private connectModelWs(onOpen: (ws: WebSocket) => void) {
    this.disconnectModelWs();

    const ws = new WebSocket(MODEL_WS_URL);
    this.modelWs = ws;

    ws.on("open", () => {
      onOpen(ws);
    });

    ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString());
        this.handleModelWsMessage(msg);
      } catch (err) {
        console.error("[python-bridge] Failed to parse/handle model WS message:", err);
      }
    });

    ws.on("close", () => {
      if (this.modelWs === ws) {
        this.modelWs = null;
      }
    });

    ws.on("error", (err) => {
      console.error("[python-bridge] Model WS error:", err.message);
      if (this.modelWs === ws) {
        this.modelWs = null;
      }
    });
  }

  private disconnectModelWs() {
    if (this.modelWs) {
      try {
        this.modelWs.close();
      } catch {
        // ignore
      }
      this.modelWs = null;
    }
  }

  private handleModelWsMessage(msg: Record<string, unknown>) {
    const type = msg.type as string;

    switch (type) {
      case "download_started":
        this._status = "downloading";
        this.broadcastStatus();
        this.broadcastModelEvent(msg);
        break;

      case "download_progress":
        this._status = "downloading";
        this.broadcastModelProgress(msg);
        break;

      case "download_complete":
        this._status = "downloaded";
        this.broadcastStatus();
        this.broadcastModelEvent(msg);
        this.disconnectModelWs();
        break;

      case "download_error":
        this.broadcastModelEvent(msg);
        this.disconnectModelWs();
        this.refreshStatusFromBackend();
        break;

      case "load_started":
        this._status = "loading";
        this.broadcastStatus();
        this.broadcastModelEvent(msg);
        break;

      case "load_complete":
        this._status = "ready";
        this.broadcastStatus();
        this.broadcastModelEvent(msg);
        this.disconnectModelWs();
        this.stopHealthPolling();
        break;

      case "load_error":
        this.broadcastModelEvent(msg);
        this.disconnectModelWs();
        this.refreshStatusFromBackend();
        break;

      case "error":
        this.broadcastModelEvent(msg);
        break;
    }
  }

  private async refreshStatusFromBackend() {
    try {
      const resp = await fetch(HEALTH_URL);
      const data = await resp.json();
      const hStatus = data.status as string;
      if (hStatus === "ready") {
        this._status = "ready";
      } else {
        const mResp = await fetch(MODEL_STATUS_URL);
        const mData = await mResp.json();
        this._status = mData.status as any;
      }
    } catch {
      // keep current status
    }
    this.broadcastStatus();
  }

  private _autoLoadAttempted = false;

  private startHealthPolling() {
    this.healthPoll = setInterval(async () => {
      try {
        const resp = await fetch(HEALTH_URL);
        const data = await resp.json();
        const hStatus = data.status as string;

        let newStatus: typeof this._status;
        if (hStatus === "ready") {
          newStatus = "ready";
        } else if (hStatus === "loading") {
          newStatus = "loading";
        } else {
          newStatus = "no_model";
        }

        if (this._status !== newStatus) {
          if (
            this._status === "starting" ||
            this._status === "stopped" ||
            this._status === "error" ||
            this._status === "no_model" ||
            this._status === "loading"
          ) {
            this._status = newStatus;
            this.broadcastStatus();
          }
        }

        if (hStatus === "ready" && this._status === "ready") {
          this.stopHealthPolling();
        }

        // Auto-load model if it's cached but not loaded yet
        if (hStatus === "no_model" && !this._autoLoadAttempted) {
          this._autoLoadAttempted = true;
          this.tryAutoLoadModel();
        }
      } catch {
        // still booting
      }
    }, 1500);
  }

  private async tryAutoLoadModel() {
    const selectedModel = String(store.get("modelSize") || "large-v3");
    try {
      const statusResp = await fetch(`${MODEL_STATUS_URL}?model=${encodeURIComponent(selectedModel)}`);
      const statusData = await statusResp.json();

      if (statusData.status === "downloaded") {
        console.log(`[python-bridge] Auto-loading cached model: ${selectedModel}`);
        this._status = "loading";
        this.broadcastStatus();
        this.loadModel(selectedModel);
      }
    } catch (err) {
      console.error("[python-bridge] Auto-load check failed:", err);
    }
  }

  private stopHealthPolling() {
    if (this.healthPoll) {
      clearInterval(this.healthPoll);
      this.healthPoll = null;
    }
  }

  private broadcastStatus() {
    for (const win of BrowserWindow.getAllWindows()) {
      try {
        if (!win.isDestroyed()) {
          win.webContents.send("backend-status", this._status);
        }
      } catch (err) {
        console.error("[python-bridge] Failed to broadcast status:", err);
      }
    }
  }

  private broadcastModelProgress(data: Record<string, unknown>) {
    for (const win of BrowserWindow.getAllWindows()) {
      try {
        if (!win.isDestroyed()) {
          win.webContents.send("model-progress", data);
        }
      } catch (err) {
        console.error("[python-bridge] Failed to broadcast progress:", err);
      }
    }
  }

  private broadcastModelEvent(data: Record<string, unknown>) {
    for (const win of BrowserWindow.getAllWindows()) {
      try {
        if (!win.isDestroyed()) {
          win.webContents.send("model-event", data);
        }
      } catch (err) {
        console.error("[python-bridge] Failed to broadcast event:", err);
      }
    }
  }
}
