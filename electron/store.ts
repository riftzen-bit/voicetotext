import { app } from "electron";
import path from "node:path";
import fs from "node:fs";

type StoreListener = (newVal: unknown) => void;

// Hotkey validation for settings migration
const MODIFIER_KEYS = new Set(["Control", "Alt", "Shift", "Meta", "Ctrl", "Command", "Super"]);
const VALID_HOTKEY_PATTERN = /^(Ctrl|Alt|Shift|Meta|Command|Super|CommandOrControl|CmdOrCtrl)(\+(Ctrl|Alt|Shift|Meta|Command|Super|CommandOrControl|CmdOrCtrl))*\+[A-Za-z0-9]$|^(Ctrl|Alt|Shift|Meta|Command|Super|CommandOrControl|CmdOrCtrl)(\+(Ctrl|Alt|Shift|Meta|Command|Super|CommandOrControl|CmdOrCtrl))*\+(F[1-9]|F1[0-2]|Space|Tab|Backspace|Delete|Insert|Return|Enter|Up|Down|Left|Right|Home|End|PageUp|PageDown|Escape|Esc|VolumeUp|VolumeDown|VolumeMute|MediaNextTrack|MediaPreviousTrack|MediaStop|MediaPlayPause|PrintScreen)$|^(F[1-9]|F1[0-2]|Escape|Esc|Space|Tab)$/i;

function isValidHotkey(value: unknown): boolean {
  if (typeof value !== "string" || !value.trim()) return false;
  const parts = value.split("+").filter(Boolean);
  if (parts.length === 0) return false;
  const lastPart = parts[parts.length - 1];
  if (MODIFIER_KEYS.has(lastPart) || lastPart === "") return false;
  return VALID_HOTKEY_PATTERN.test(value);
}

const listeners = new Map<string, Set<StoreListener>>();

const DEFAULTS: Record<string, unknown> = {
  hotkeyMode: "ptt",
  hotkey: "CommandOrControl+Shift+R",
  cancelHotkey: "Escape",
  autoPaste: true,
  audioDevice: "default",
  modelSize: "large-v3",
  transcriptionProfile: "balanced",
  languageHint: "auto",
  overlayPosition: { x: -1, y: -1 },
  useGemini: false,
  geminiApiKey: "",
  geminiModel: "gemini-2.5-flash",
  // Audio enhancement settings
  noiseGateEnabled: true,
  noiseGateThresholdDb: -40,
  audioNormalizeEnabled: true,
  audioNormalizeTargetDb: -3,
  // Appearance settings - persisted to local storage
  appearance: {
    theme: "system",
    accentColor: "gold",
    overlaySize: "normal",
    overlayPosition: "top-right",
    overlayOpacity: 100,
    showOverlayTooltip: true,
    animationsEnabled: true,
    reducedMotion: false,
  },
  // Context templates for AI refinement
  contextTemplates: [] as Array<{
    id: string;
    name: string;
    prompt: string;
    order: number;
  }>,
  activeTemplateId: null as string | null,
  // Code mode - skip AI refinement for code dictation
  codeMode: false,
  codeModeHotkey: "CommandOrControl+Shift+C",
  // Adaptive model selection
  adaptiveModelEnabled: false,
  lastSystemMetrics: null as Record<string, unknown> | null,
};

let data: Record<string, unknown> = { ...DEFAULTS };
let filePath = "";

function getFilePath(): string {
  if (!filePath) {
    filePath = path.join(app.getPath("userData"), "settings.json");
  }
  return filePath;
}

function load(): void {
  try {
    const raw = fs.readFileSync(getFilePath(), "utf-8");
    const parsed = JSON.parse(raw);
    data = { ...DEFAULTS, ...parsed };
  } catch {
    data = { ...DEFAULTS };
  }

  // Validate and fix invalid hotkeys on startup
  let needsSave = false;

  if (!isValidHotkey(data.hotkey)) {
    console.warn(`Invalid hotkey "${data.hotkey}" detected, resetting to default`);
    data.hotkey = DEFAULTS.hotkey;
    needsSave = true;
  }

  if (!isValidHotkey(data.cancelHotkey)) {
    console.warn(`Invalid cancelHotkey "${data.cancelHotkey}" detected, resetting to default`);
    data.cancelHotkey = DEFAULTS.cancelHotkey;
    needsSave = true;
  }

  if (needsSave) {
    save();
  }
}

function save(): void {
  try {
    const dir = path.dirname(getFilePath());
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(getFilePath(), JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to save settings:", err);
  }
}

export const store = {
  init() {
    load();
  },

  get store(): Record<string, unknown> {
    return { ...data };
  },

  get(key: string): unknown {
    return data[key];
  },

  set(key: string, value: unknown): void {
    // Validate hotkey values before saving
    if (key === "hotkey" || key === "cancelHotkey") {
      if (!isValidHotkey(value)) {
        console.warn(`Attempted to save invalid ${key}: "${value}", ignoring`);
        return;
      }
    }

    data[key] = value;
    save();
    const keyListeners = listeners.get(key);
    if (keyListeners) {
      for (const cb of keyListeners) {
        try {
          cb(value);
        } catch (err) {
          console.error(`Store listener failed for ${key}:`, err);
        }
      }
    }
  },

  onDidChange(key: string, cb: (newVal: unknown) => void) {
    let keyListeners = listeners.get(key);
    if (!keyListeners) {
      keyListeners = new Set();
      listeners.set(key, keyListeners);
    }
    keyListeners.add(cb);

    return () => {
      const currentListeners = listeners.get(key);
      if (!currentListeners) {
        return;
      }
      currentListeners.delete(cb);
      if (currentListeners.size === 0) {
        listeners.delete(key);
      }
    };
  },
};
