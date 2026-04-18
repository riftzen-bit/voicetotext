import { useEffect, useState, useCallback, useRef } from "react";
import { getApi, ModelProgress, ModelStatusInfo } from "../lib/ipc";
import { useSettings } from "../hooks/useSettings";
import "../styles/setup.css";

type ModelStatus = "not_downloaded" | "downloading" | "downloaded" | "loading" | "loaded" | "error";

const RING_RADIUS = 62;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function ProgressRing({
  progress,
  label,
  detail,
  tone,
}: {
  progress: number;
  label: string;
  detail?: string;
  tone: "idle" | "active" | "success" | "error";
}) {
  const clamped = Math.max(0, Math.min(1, progress));
  const offset = RING_CIRCUMFERENCE * (1 - clamped);
  return (
    <div className={`setup-ring setup-ring--${tone}`}>
      <svg viewBox="0 0 140 140" width={140} height={140} aria-hidden="true">
        <defs>
          <linearGradient id="ring-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--accent)" />
            <stop offset="100%" stopColor="var(--accent-hover)" />
          </linearGradient>
        </defs>
        <circle
          className="setup-ring-track"
          cx="70"
          cy="70"
          r={RING_RADIUS}
          fill="none"
          strokeWidth="8"
        />
        <circle
          className="setup-ring-fill"
          cx="70"
          cy="70"
          r={RING_RADIUS}
          fill="none"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={RING_CIRCUMFERENCE}
          strokeDashoffset={offset}
          transform="rotate(-90 70 70)"
        />
      </svg>
      <div className="setup-ring-center">
        <div className="setup-ring-label">{label}</div>
        {detail && <div className="setup-ring-detail">{detail}</div>}
      </div>
    </div>
  );
}

export default function SetupView() {
  const { settings, loaded, updateSetting, modelCatalog, defaultModel } = useSettings();
  const [status, setStatus] = useState<ModelStatus>("not_downloaded");
  const [device, setDevice] = useState("cpu");
  const [progress, setProgress] = useState(0);
  const [downloadedMb, setDownloadedMb] = useState(0);
  const [totalMb, setTotalMb] = useState(0);
  const [speedMbps, setSpeedMbps] = useState(0);
  const [currentFile, setCurrentFile] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [runtimeIssue, setRuntimeIssue] = useState("");
  const statusPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const selectedModel = settings.modelSize || defaultModel;

  const fetchStatus = useCallback(async (model?: string) => {
    const api = getApi();
    if (!api) return;
    try {
      const info = await api.getModelStatus(model || selectedModel) as unknown as ModelStatusInfo;
      setStatus(info.status);
      setDevice(info.device || "cpu");
      setRuntimeIssue(info.runtime?.runtime_issue || "");
      if (info.size_mb) setTotalMb(info.size_mb);
    } catch {
      /* backend not ready yet */
    }
  }, [selectedModel]);

  useEffect(() => {
    if (!loaded) return;
    fetchStatus();
    statusPollRef.current = setInterval(() => {
      fetchStatus();
    }, 3000);
    return () => {
      if (statusPollRef.current) clearInterval(statusPollRef.current);
    };
  }, [fetchStatus, loaded]);

  useEffect(() => {
    const api = getApi();
    if (!api) return;

    const unsubProgress = api.onModelProgress((data: Record<string, unknown>) => {
      const d = data as unknown as ModelProgress;
      setStatus("downloading");
      setProgress(d.progress);
      setDownloadedMb(d.downloaded_mb);
      setTotalMb(d.total_mb);
      setSpeedMbps(d.speed_mbps);
      setCurrentFile(d.file || "");
    });

    const unsubEvent = api.onModelEvent((data: Record<string, unknown>) => {
      const type = data.type as string;
      if (type === "download_complete") {
        setStatus("downloaded");
        setProgress(1);
      } else if (type === "download_error") {
        setStatus("error");
        setErrorMsg(String(data.message || "Download failed"));
      } else if (type === "load_started") {
        setStatus("loading");
      } else if (type === "load_complete") {
        setStatus("loaded");
      } else if (type === "load_error") {
        setStatus("error");
        setErrorMsg(String(data.message || "Failed to load model"));
      }
    });

    const unsubBackend = api.onBackendStatus((s: string) => {
      if (s === "ready") setStatus("loaded");
    });

    return () => {
      unsubProgress();
      unsubEvent();
      unsubBackend();
    };
  }, []);

  const handleDownload = () => {
    const api = getApi();
    if (!api) return;
    setStatus("downloading");
    setProgress(0);
    setDownloadedMb(0);
    setErrorMsg("");
    api.startModelDownload(selectedModel);
  };

  const handleLoad = () => {
    const api = getApi();
    if (!api) return;
    setStatus("loading");
    setErrorMsg("");
    api.loadModel(selectedModel);
  };

  const handleModelChange = (model: string) => {
    void updateSetting("modelSize", model);
    setProgress(0);
    setDownloadedMb(0);
    setErrorMsg("");
    fetchStatus(model);
  };

  const selectedOption = modelCatalog.find((o) => o.value === selectedModel);
  const progressPct = Math.round(progress * 100);

  const formatEta = () => {
    if (speedMbps <= 0 || totalMb <= 0) return "--";
    const remainMb = totalMb - downloadedMb;
    const secs = remainMb / speedMbps;
    if (secs < 60) return `${Math.round(secs)}s`;
    const mins = Math.floor(secs / 60);
    const remSecs = Math.round(secs % 60);
    return `${mins}m ${remSecs}s`;
  };

  if (!loaded) return null;

  const ringTone: "idle" | "active" | "success" | "error" =
    status === "error" ? "error"
    : status === "loaded" ? "success"
    : status === "downloading" || status === "loading" ? "active"
    : "idle";

  const ringProgress =
    status === "loaded" || status === "downloaded" ? 1
    : status === "loading" ? 0.85
    : status === "downloading" ? progress
    : 0;

  const ringLabel =
    status === "downloading" ? `${progressPct}%`
    : status === "loading" ? "Load"
    : status === "loaded" ? "Ready"
    : status === "downloaded" ? "Dl·ok"
    : status === "error" ? "Error"
    : "0%";

  const ringDetail =
    status === "downloading"
      ? `${downloadedMb.toFixed(0)} / ${totalMb.toFixed(0)} MB`
      : status === "loaded"
      ? device.toUpperCase()
      : status === "error"
      ? "Retry"
      : undefined;

  return (
    <div className="setup-root">
      <div className="setup-titlebar">
        <span className="setup-title">VoiceToText Setup</span>
      </div>

      <div className="setup-body">
        <section className="setup-card glass-surface">
          <header className="setup-card-header">
            <div>
              <div className="setup-card-eyebrow">Whisper model</div>
              <h1 className="setup-card-title">
                {selectedOption?.label ?? "Select model"}
              </h1>
              {selectedOption && (
                <p className="setup-card-desc">{selectedOption.description}</p>
              )}
            </div>
            <div className="setup-card-size">
              {selectedOption ? `${(selectedOption.size_mb / 1024).toFixed(1)} GB` : "—"}
            </div>
          </header>

          <div className="setup-ring-row">
            <ProgressRing
              progress={ringProgress}
              label={ringLabel}
              detail={ringDetail}
              tone={ringTone}
            />

            <div className="setup-ring-side">
              <label className="setup-field-label" htmlFor="setup-model">
                Model
              </label>
              <select
                id="setup-model"
                className="setup-select"
                value={selectedModel}
                onChange={(e) => handleModelChange(e.target.value)}
                disabled={status === "downloading" || status === "loading"}
              >
                {modelCatalog.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>

              <div className="setup-meta-row">
                <span className="setup-meta-label">Device</span>
                <span className="setup-meta-value">{device.toUpperCase()}</span>
              </div>

              {status === "downloading" && (
                <div className="setup-meta-row">
                  <span className="setup-meta-label">Speed</span>
                  <span className="setup-meta-value">
                    {speedMbps > 0 ? `${speedMbps.toFixed(1)} MB/s · ETA ${formatEta()}` : "--"}
                  </span>
                </div>
              )}

              {runtimeIssue && (
                <div className="setup-runtime-note">{runtimeIssue}</div>
              )}
            </div>
          </div>

          <footer className="setup-card-footer">
            {status === "not_downloaded" && (
              <button className="setup-btn primary" onClick={handleDownload}>
                Download model
              </button>
            )}
            {status === "downloading" && currentFile && (
              <div className="setup-download-file">{currentFile}</div>
            )}
            {status === "downloaded" && (
              <button className="setup-btn primary" onClick={handleLoad}>
                Load into {device.toUpperCase()}
              </button>
            )}
            {status === "loading" && (
              <div className="setup-loading-note">Loading into {device.toUpperCase()}…</div>
            )}
            {status === "loaded" && (
              <div className="setup-ready-info">
                Model loaded. You can close this window.
              </div>
            )}
            {status === "error" && (
              <>
                {errorMsg && <div className="setup-error-msg">{errorMsg}</div>}
                <button className="setup-btn primary" onClick={handleDownload}>
                  Retry download
                </button>
              </>
            )}
          </footer>
        </section>
      </div>

      <div className="setup-footer">VoiceToText · v0.2.0</div>
    </div>
  );
}
