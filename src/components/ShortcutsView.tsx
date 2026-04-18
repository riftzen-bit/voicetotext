import { useState, useEffect, useRef, useCallback } from "react";
import { Info, RotateCcw, Keyboard, Sparkles } from "lucide-react";
import { AppSettings, useSettings } from "../hooks/useSettings";

const MODIFIER_KEYS = new Set(["Control", "Alt", "Shift", "Meta"]);

function isValidHotkey(hotkey: string): boolean {
  if (!hotkey || typeof hotkey !== "string") return false;
  const parts = hotkey.split("+").filter(Boolean);
  if (parts.length === 0) return false;
  const lastPart = parts[parts.length - 1];
  return !MODIFIER_KEYS.has(lastPart);
}

interface Shortcut {
  id: string;
  label: string;
  description: string;
  defaultKey: string;
  category: "recording" | "navigation" | "app";
  configurable: boolean;
}

const HOTKEY_SETTING_MAP: Record<string, keyof AppSettings> = {
  hotkey: "hotkey",
  cancel: "cancelHotkey",
  codeMode: "codeModeHotkey",
};

const SHORTCUTS: Shortcut[] = [
  {
    id: "hotkey",
    label: "Push to Talk / Toggle",
    description: "Start or stop recording",
    defaultKey: "Ctrl+Shift+R",
    category: "recording",
    configurable: true,
  },
  {
    id: "cancel",
    label: "Cancel Recording",
    description: "Cancel current recording without transcribing",
    defaultKey: "Escape",
    category: "recording",
    configurable: true,
  },
  {
    id: "codeMode",
    label: "Toggle Code Mode",
    description: "Skip AI refinement for exact transcription",
    defaultKey: "Ctrl+Shift+C",
    category: "recording",
    configurable: true,
  },
  {
    id: "openSettings",
    label: "Open Settings",
    description: "Open the settings window",
    defaultKey: "Ctrl+,",
    category: "app",
    configurable: false,
  },
  {
    id: "hideOverlay",
    label: "Hide/Show Overlay",
    description: "Toggle the floating indicator visibility",
    defaultKey: "Ctrl+Shift+H",
    category: "app",
    configurable: false,
  },
  {
    id: "quit",
    label: "Quit Application",
    description: "Close the application completely",
    defaultKey: "Ctrl+Q",
    category: "app",
    configurable: false,
  },
];

const CATEGORY_LABELS: Record<string, string> = {
  recording: "Recording",
  navigation: "Navigation",
  app: "Application",
};

function formatKey(key: string): React.ReactNode {
  const parts = key.split("+");
  return (
    <span className="key-combo">
      {parts.map((part, i) => (
        <span key={i}>
          <kbd className="key">{part}</kbd>
          {i < parts.length - 1 && <span className="key-separator">+</span>}
        </span>
      ))}
    </span>
  );
}

export default function ShortcutsView() {
  const { settings, updateSetting } = useSettings();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingKey, setEditingKey] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isValidKey, setIsValidKey] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const handleEdit = (shortcut: Shortcut) => {
    if (!shortcut.configurable) return;
    setEditingId(shortcut.id);
    setEditingKey("");
    setIsValidKey(false);
    setIsListening(true);
  };

  useEffect(() => {
    if (isListening && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isListening]);

  useEffect(() => {
    if (!isListening) return;

    const handleGlobalMouseDown = (e: MouseEvent) => {
      const overlay = overlayRef.current;
      if (overlay && overlay.contains(e.target as Node)) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
    };

    document.addEventListener("mousedown", handleGlobalMouseDown, true);
    document.addEventListener("click", handleGlobalMouseDown, true);
    document.addEventListener("contextmenu", handleGlobalMouseDown, true);

    return () => {
      document.removeEventListener("mousedown", handleGlobalMouseDown, true);
      document.removeEventListener("click", handleGlobalMouseDown, true);
      document.removeEventListener("contextmenu", handleGlobalMouseDown, true);
    };
  }, [isListening]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!isListening) return;

    e.preventDefault();
    e.stopPropagation();

    const modifiers: string[] = [];
    if (e.ctrlKey) modifiers.push("Ctrl");
    if (e.altKey) modifiers.push("Alt");
    if (e.shiftKey) modifiers.push("Shift");
    if (e.metaKey) modifiers.push("Meta");

    const key = e.key;

    if (MODIFIER_KEYS.has(key)) {
      const partialCombo = modifiers.join("+") + "+";
      setEditingKey(partialCombo);
      setIsValidKey(false);
      return;
    }

    let keyName: string;
    if (key.length === 1) {
      keyName = key.toUpperCase();
    } else if (key === "Escape") {
      keyName = "Escape";
    } else if (key === "Enter") {
      keyName = "Return";
    } else if (key === " ") {
      keyName = "Space";
    } else {
      keyName = key;
    }

    const combo = [...modifiers, keyName].join("+");
    setEditingKey(combo);
    setIsValidKey(isValidHotkey(combo));
  }, [isListening]);

  const handleSave = async () => {
    if (editingId && editingKey && isValidKey) {
      const settingKey = HOTKEY_SETTING_MAP[editingId];
      if (settingKey) {
        await updateSetting(settingKey, editingKey);
      }
    }
    setEditingId(null);
    setEditingKey("");
    setIsListening(false);
    setIsValidKey(false);
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditingKey("");
    setIsListening(false);
    setIsValidKey(false);
  };

  const handleReset = async (shortcut: Shortcut) => {
    const settingKey = HOTKEY_SETTING_MAP[shortcut.id];
    if (settingKey) {
      await updateSetting(settingKey, shortcut.defaultKey);
    }
  };

  const groupedShortcuts = SHORTCUTS.reduce((acc, shortcut) => {
    if (!acc[shortcut.category]) {
      acc[shortcut.category] = [];
    }
    acc[shortcut.category].push(shortcut);
    return acc;
  }, {} as Record<string, Shortcut[]>);

  const getCurrentKey = (shortcut: Shortcut): string => {
    const settingKey = HOTKEY_SETTING_MAP[shortcut.id];
    if (settingKey) {
      const value = settings[settingKey];
      return typeof value === "string" ? value || shortcut.defaultKey : shortcut.defaultKey;
    }
    return shortcut.defaultKey;
  };

  const configurableCount = SHORTCUTS.filter((s) => s.configurable).length;

  return (
    <div className="shortcuts-view feature-view feature-view--wide">
      <header className="feature-hero">
        <span className="feature-medallion tone-graphite" aria-hidden>
          <Keyboard />
        </span>
        <div className="feature-hero-body">
          <span className="feature-hero-eyebrow">
            <Sparkles size={12} strokeWidth={2.5} /> Controls
          </span>
          <h1 className="feature-hero-title">Keyboard Shortcuts</h1>
          <p className="feature-hero-description">
            View every hotkey in one place and re-bind the ones you use most.
            Click a configurable row, then press the combination you want.
          </p>
          <div className="feature-hero-meta">
            <span className="feature-chip accent">
              {configurableCount} configurable
            </span>
            <span className="feature-chip">
              {SHORTCUTS.length} total shortcuts
            </span>
          </div>
        </div>
      </header>

      {Object.entries(groupedShortcuts).map(([category, shortcuts]) => (
        <section key={category} className="feature-card-list shortcut-group">
          <h3 className="feature-section-title">{CATEGORY_LABELS[category]}</h3>
          {shortcuts.map((shortcut) => {
            const isEditing = editingId === shortcut.id;
            const currentKey = getCurrentKey(shortcut);
            const isModified = shortcut.configurable && currentKey !== shortcut.defaultKey;

            return (
              <div
                key={shortcut.id}
                className={`feature-card shortcut-card ${
                  shortcut.configurable ? "interactive" : ""
                } ${isEditing ? "active" : ""}`}
                onClick={() => handleEdit(shortcut)}
              >
                <div className="shortcut-card-main">
                  <div className="shortcut-card-title-row">
                    <h4 className="shortcut-card-title">{shortcut.label}</h4>
                    {isModified && (
                      <span className="feature-chip accent">Modified</span>
                    )}
                    {!shortcut.configurable && (
                      <span className="feature-chip">Fixed</span>
                    )}
                  </div>
                  <p className="shortcut-card-description">{shortcut.description}</p>
                </div>

                <div className="shortcut-card-key">
                  {isEditing ? (
                    <div className="key-editor" ref={overlayRef}>
                      <input
                        ref={inputRef}
                        type="text"
                        className={`feature-input key-input ${
                          editingKey && !isValidKey ? "invalid" : ""
                        } ${isValidKey ? "valid" : ""}`}
                        value={editingKey || "Press keys..."}
                        onKeyDown={handleKeyDown}
                        placeholder="Press keys..."
                        readOnly
                        autoFocus
                      />
                      <div className="key-editor-hint">
                        {!editingKey && "Press a key combination (e.g. Ctrl+Shift+R)"}
                        {editingKey && !isValidKey && "Complete the combination with a non-modifier key"}
                        {isValidKey && "Valid hotkey — click Save to apply"}
                      </div>
                      <div className="key-editor-actions">
                        <button
                          className="feature-btn ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCancel();
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          className="feature-btn primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSave();
                          }}
                          disabled={!isValidKey}
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {formatKey(currentKey)}
                      {shortcut.configurable && isModified && (
                        <button
                          className="feature-icon-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleReset(shortcut);
                          }}
                          title="Reset to default"
                          aria-label="Reset to default"
                        >
                          <RotateCcw />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </section>
      ))}

      <div className="feature-note shortcuts-note">
        <Info size={18} strokeWidth={2} />
        <span>Global hotkeys work even when the app is not focused.</span>
      </div>
    </div>
  );
}
