import { BrowserWindow, globalShortcut } from "electron";
import { store } from "./store";
import { WindowTracker } from "./window-tracker";

const MODIFIER_KEYS = new Set(["Control", "Alt", "Shift", "Meta", "Ctrl", "Command", "Super"]);
const VALID_KEY_PATTERN = /^(Ctrl|Alt|Shift|Meta|Command|Super|CommandOrControl|CmdOrCtrl)(\+(Ctrl|Alt|Shift|Meta|Command|Super|CommandOrControl|CmdOrCtrl))*\+[A-Za-z0-9]$|^(Ctrl|Alt|Shift|Meta|Command|Super|CommandOrControl|CmdOrCtrl)(\+(Ctrl|Alt|Shift|Meta|Command|Super|CommandOrControl|CmdOrCtrl))*\+(F[1-9]|F1[0-2]|Space|Tab|Backspace|Delete|Insert|Return|Enter|Up|Down|Left|Right|Home|End|PageUp|PageDown|Escape|Esc|VolumeUp|VolumeDown|VolumeMute|MediaNextTrack|MediaPreviousTrack|MediaStop|MediaPlayPause|PrintScreen|numdec|numadd|numsub|nummult|numdiv|num[0-9])$|^(F[1-9]|F1[0-2]|Escape|Esc|Space|Tab)$/i;

function isValidAccelerator(accelerator: string): boolean {
  if (!accelerator || typeof accelerator !== "string") {
    return false;
  }

  const trimmed = accelerator.trim();
  if (!trimmed) {
    return false;
  }

  // Check if ends with just a modifier (invalid)
  const parts = trimmed.split("+");
  const lastPart = parts[parts.length - 1];
  if (MODIFIER_KEYS.has(lastPart) || lastPart === "") {
    return false;
  }

  // Must have at least one non-modifier key
  return VALID_KEY_PATTERN.test(trimmed);
}

let isRecording = false;
let currentMode: "ptt" | "ttt" = "ptt";
let registeredAccelerator: string | null = null;
let registeredCancelAccelerator: string | null = null;
let registeredCodeModeAccelerator: string | null = null;

let pttLastFireTime = 0;
let pttKeyRepeatDetected = false;
let pttPollInterval: ReturnType<typeof setInterval> | null = null;
const PTT_POLL_MS = 30; // Reduced from 80ms for faster response
const PTT_KEY_REPEAT_GAP_MS = 150; // Reduced from 600ms - faster key repeat detection
const PTT_RELEASE_DETECT_MS = 120; // Reduced from 400ms - faster release detection

let overlayWinRef: BrowserWindow | null = null;

export function registerHotkeyHandlers(overlayWin: BrowserWindow, windowTracker: WindowTracker) {
  overlayWinRef = overlayWin;
  currentMode = (store.get("hotkeyMode") as "ptt" | "ttt") || "ptt";
  const hotkey = (store.get("hotkey") as string) || "CommandOrControl+Shift+R";
  const cancelHotkey = (store.get("cancelHotkey") as string) || "Escape";
  const codeModeHotkey = (store.get("codeModeHotkey") as string) || "CommandOrControl+Shift+C";

  registerGlobalHotkey(hotkey, overlayWin, windowTracker);
  registerCancelHotkey(cancelHotkey);
  registerCodeModeHotkey(codeModeHotkey, overlayWin);

  store.onDidChange("hotkey", (newVal) => {
    if (typeof newVal === "string") {
      unregisterCurrentHotkey();
      registerGlobalHotkey(newVal, overlayWin, windowTracker);
    }
  });

  store.onDidChange("cancelHotkey", (newVal) => {
    if (typeof newVal === "string") {
      unregisterCancelHotkey();
      registerCancelHotkey(newVal);
    }
  });

  store.onDidChange("codeModeHotkey", (newVal) => {
    if (typeof newVal === "string") {
      unregisterCodeModeHotkey();
      registerCodeModeHotkey(newVal, overlayWin);
    }
  });

  store.onDidChange("hotkeyMode", (newVal) => {
    if (newVal === "ptt" || newVal === "ttt") {
      currentMode = newVal;
      overlayWin.webContents.send("hotkey-mode", newVal);
    }
  });
}

function registerGlobalHotkey(
  accelerator: string,
  overlayWin: BrowserWindow,
  windowTracker: WindowTracker
) {
  try {
    unregisterCurrentHotkey();

    if (!isValidAccelerator(accelerator)) {
      console.error("Invalid hotkey accelerator:", accelerator);
      // Fallback to default
      const fallback = "CommandOrControl+Shift+R";
      if (accelerator !== fallback) {
        store.set("hotkey", fallback);
        return registerGlobalHotkey(fallback, overlayWin, windowTracker);
      }
      return;
    }

    const success = globalShortcut.register(accelerator, () => {
      const now = Date.now();

      if (currentMode === "ttt") {
        if (!isRecording) {
          void windowTracker.recordFocusedWindow();
        }
        isRecording = !isRecording;
        overlayWin.webContents.send("recording-state", isRecording ? "start" : "stop");
        return;
      }

      if (!isRecording) {
        void windowTracker.recordFocusedWindow();
        isRecording = true;
        pttLastFireTime = now;
        pttKeyRepeatDetected = false;
        overlayWin.webContents.send("recording-state", "start");
        startPttPolling(overlayWin);
      } else {
        const gap = now - pttLastFireTime;
        pttLastFireTime = now;

        if (gap < PTT_KEY_REPEAT_GAP_MS) {
          pttKeyRepeatDetected = true;
        } else {
          isRecording = false;
          pttKeyRepeatDetected = false;
          overlayWin.webContents.send("recording-state", "stop");
          stopPttPolling();
        }
      }
    });

    if (!success) {
      console.error("globalShortcut.register returned false for:", accelerator);
      return;
    }

    registeredAccelerator = accelerator;
  } catch (err) {
    console.error("Failed to register hotkey:", accelerator, err);
  }
}

function startPttPolling(overlayWin: BrowserWindow) {
  stopPttPolling();
  pttPollInterval = setInterval(() => {
    if (!isRecording) {
      stopPttPolling();
      return;
    }

    const elapsed = Date.now() - pttLastFireTime;

    if (pttKeyRepeatDetected && elapsed > PTT_RELEASE_DETECT_MS) {
      isRecording = false;
      pttKeyRepeatDetected = false;
      overlayWin.webContents.send("recording-state", "stop");
      stopPttPolling();
    }
  }, PTT_POLL_MS);
}

function stopPttPolling() {
  if (pttPollInterval) {
    clearInterval(pttPollInterval);
    pttPollInterval = null;
  }
}

function unregisterCurrentHotkey() {
  stopPttPolling();
  if (registeredAccelerator) {
    try {
      globalShortcut.unregister(registeredAccelerator);
    } catch {}
    registeredAccelerator = null;
  }
}

function registerCancelHotkey(accelerator: string) {
  try {
    unregisterCancelHotkey();

    if (!isValidAccelerator(accelerator)) {
      console.error("Invalid cancel hotkey accelerator:", accelerator);
      // Fallback to default
      const fallback = "Escape";
      if (accelerator !== fallback) {
        store.set("cancelHotkey", fallback);
        return registerCancelHotkey(fallback);
      }
      return;
    }

    globalShortcut.register(accelerator, () => {
      if (isRecording && overlayWinRef) {
        isRecording = false;
        pttKeyRepeatDetected = false;
        stopPttPolling();
        overlayWinRef.webContents.send("recording-state", "cancel");
      }
    });

    registeredCancelAccelerator = accelerator;
  } catch (err) {
    console.error("Failed to register cancel hotkey:", accelerator, err);
  }
}

function unregisterCancelHotkey() {
  if (registeredCancelAccelerator) {
    try {
      globalShortcut.unregister(registeredCancelAccelerator);
    } catch {}
    registeredCancelAccelerator = null;
  }
}

function registerCodeModeHotkey(accelerator: string, overlayWin: BrowserWindow) {
  try {
    unregisterCodeModeHotkey();

    if (!isValidAccelerator(accelerator)) {
      console.error("Invalid code mode hotkey accelerator:", accelerator);
      // Fallback to default
      const fallback = "CommandOrControl+Shift+C";
      if (accelerator !== fallback) {
        store.set("codeModeHotkey", fallback);
        return registerCodeModeHotkey(fallback, overlayWin);
      }
      return;
    }

    const success = globalShortcut.register(accelerator, () => {
      const currentCodeMode = store.get("codeMode") as boolean;
      const newCodeMode = !currentCodeMode;
      store.set("codeMode", newCodeMode);
      // Notify renderer of code mode change
      overlayWin.webContents.send("code-mode-changed", newCodeMode);
      for (const win of BrowserWindow.getAllWindows()) {
        try {
          if (!win.isDestroyed()) {
            win.webContents.send("settings-changed", store.store);
          }
        } catch {}
      }
    });

    if (!success) {
      console.error("globalShortcut.register returned false for code mode:", accelerator);
      return;
    }

    registeredCodeModeAccelerator = accelerator;
  } catch (err) {
    console.error("Failed to register code mode hotkey:", accelerator, err);
  }
}

function unregisterCodeModeHotkey() {
  if (registeredCodeModeAccelerator) {
    try {
      globalShortcut.unregister(registeredCodeModeAccelerator);
    } catch {}
    registeredCodeModeAccelerator = null;
  }
}

export function unregisterAllHotkeys() {
  stopPttPolling();
  globalShortcut.unregisterAll();
}
