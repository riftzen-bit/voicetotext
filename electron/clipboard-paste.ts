import { clipboard, BrowserWindow, ipcMain } from "electron";
import { exec, execFile } from "node:child_process";
import { store } from "./store";
import { WindowTracker } from "./window-tracker";
import { startClipboardMonitoring } from "./clipboard-monitor";
import { planDelivery } from "../src/lib/clipboard-plan";

export { planDelivery };
export type { DeliveryPlan } from "../src/lib/clipboard-plan";

// How long to wait after issuing the synthetic Ctrl+V before we put the
// user's clipboard back. SendKeys is async and the target app needs to read
// the clipboard during its paste handler. 350 ms covers slow apps (Word,
// Slack) without being visibly sluggish.
const RESTORE_CLIPBOARD_DELAY_MS = 350;

export function registerClipboardHandlers(windowTracker: WindowTracker) {
  ipcMain.on("paste-text", async (_e, text: string) => {
    if (!text) return;

    const plan = planDelivery({
      autoPaste: !!store.get("autoPaste"),
      copyToClipboard: !!store.get("copyToClipboard"),
    });

    if (plan.noop) {
      broadcastPasteStatus({
        type: "paste_status",
        status: "skipped",
        message: "Auto-paste and clipboard copy are both disabled.",
      });
      return;
    }

    let savedClipboard = "";
    if (plan.saveClipboard) {
      try {
        savedClipboard = clipboard.readText();
      } catch {
        savedClipboard = "";
      }
    }

    if (plan.writeTranscript) {
      clipboard.writeText(text);
    }

    if (!plan.simulatePaste) {
      broadcastPasteStatus({
        type: "paste_status",
        status: "copied",
        message: "Transcript copied to clipboard.",
      });
      return;
    }

    const restored = await windowTracker.restoreFocus();
    await new Promise((r) => setTimeout(r, 80));

    try {
      await simulatePaste();
      broadcastPasteStatus({
        type: "paste_status",
        status: "pasted",
        message: restored
          ? "Text pasted into the previously focused app."
          : "Text pasted using the current foreground app.",
      });

      if (plan.startMonitoring) {
        startClipboardMonitoring(text, BrowserWindow.getAllWindows());
      }

      if (plan.restoreClipboard) {
        setTimeout(() => {
          try {
            clipboard.writeText(savedClipboard);
          } catch {
            /* clipboard may be locked by another app; user can copy again */
          }
        }, RESTORE_CLIPBOARD_DELAY_MS);
      }
    } catch (err) {
      // Paste failed — still try to restore the user's clipboard if we
      // overwrote it, otherwise they'd silently lose what they had.
      if (plan.restoreClipboard) {
        try {
          clipboard.writeText(savedClipboard);
        } catch {
          /* ignore */
        }
      }
      const message = err instanceof Error ? err.message : String(err);
      broadcastPasteStatus({
        type: "paste_status",
        status: "error",
        message: `Paste failed: ${message}`,
      });
    }
  });
}

function broadcastPasteStatus(data: Record<string, unknown>) {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send("paste-status", data);
  }
}

function execAsync(command: string): Promise<void> {
  return new Promise((resolve, reject) => {
    exec(command, { windowsHide: true }, (err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
}

function execFileAsync(file: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(file, args, { windowsHide: true }, (err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
}

function powershellEncodedCommand(script: string): string[] {
  const encoded = Buffer.from(script, "utf16le").toString("base64");
  return ["-NoProfile", "-NonInteractive", "-EncodedCommand", encoded];
}

async function simulatePaste() {
  const platform = process.platform;

  if (platform === "win32") {
    await pasteWindows();
  } else if (platform === "darwin") {
    await pasteMac();
  } else {
    await pasteLinux();
  }
}

async function pasteWindows() {
  const script = `
$wshell = New-Object -ComObject wscript.shell
$wshell.SendKeys('^v')
`;
  await execFileAsync("powershell", powershellEncodedCommand(script));
}

async function pasteMac() {
  const script = `
    tell application "System Events"
      keystroke "v" using command down
    end tell
  `;
  await execFileAsync("osascript", ["-e", script]);
}

async function pasteLinux() {
  // Try xdotool first (X11)
  try {
    await execAsync("which xdotool");
    await execAsync("xdotool key ctrl+v");
    return;
  } catch {}

  // Try ydotool (works on both Wayland and X11 via uinput)
  try {
    await execAsync("which ydotool");
    await execAsync("ydotool key 29:1 47:1 47:0 29:0"); // Ctrl down, V down, V up, Ctrl up
    return;
  } catch {}

  // Try wtype (Wayland only, requires wlr-virtual-keyboard protocol)
  try {
    await execAsync("which wtype");
    await execAsync("wtype -M ctrl v -m ctrl");
    return;
  } catch {}

  throw new Error(
    "No paste tool found. Install one of: xdotool (X11), ydotool (Wayland/X11), or wtype (Wayland)."
  );
}
