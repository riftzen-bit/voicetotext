import { useState, useEffect, useRef, useCallback } from "react";
import { AppSettings, useSettings } from "../hooks/useSettings";

const MODIFIER_KEYS = new Set(["Control", "Alt", "Shift", "Meta"]);

function isValidHotkey(hotkey: string): boolean {
  if (!hotkey || typeof hotkey !== "string") return false;
  const parts = hotkey.split("+").filter(Boolean);
  if (parts.length === 0) return false;
  const lastPart = parts[parts.length - 1];
  // Last part must NOT be a modifier
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

// Maps shortcut IDs to their corresponding AppSettings keys
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

  // Focus input when listening starts
  useEffect(() => {
    if (isListening && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isListening]);

  // Block mouse clicks during key detection by capturing pointer events
  useEffect(() => {
    if (!isListening) return;

    const handleGlobalMouseDown = (e: MouseEvent) => {
      // Allow clicks on the overlay (which contains Cancel/Save buttons)
      const overlay = overlayRef.current;
      if (overlay && overlay.contains(e.target as Node)) {
        return;
      }
      // Block all other mouse events
      e.preventDefault();
      e.stopPropagation();
    };

    // Capture phase to intercept before other handlers
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

    // If only modifier keys are pressed, show them but mark as incomplete
    if (MODIFIER_KEYS.has(key)) {
      const partialCombo = modifiers.join("+") + "+";
      setEditingKey(partialCombo);
      setIsValidKey(false);
      return;
    }

    // Map special key names to Electron accelerator format
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

  // Group shortcuts by category
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

  return (
    <div className="shortcuts-view">
      <h2 className="section-header">Keyboard Shortcuts</h2>
      <p className="section-description">
        View and customize keyboard shortcuts. Click on a configurable shortcut to change it.
      </p>

      {Object.entries(groupedShortcuts).map(([category, shortcuts]) => (
        <div key={category} className="shortcuts-group">
          <h3 className="subsection-header">{CATEGORY_LABELS[category]}</h3>
          <div className="shortcuts-list">
            {shortcuts.map((shortcut) => {
              const isEditing = editingId === shortcut.id;
              const currentKey = getCurrentKey(shortcut);
              const isModified = shortcut.configurable && currentKey !== shortcut.defaultKey;

              return (
                <div
                  key={shortcut.id}
                  className={`shortcut-row ${shortcut.configurable ? "configurable" : ""} ${isEditing ? "editing" : ""}`}
                  onClick={() => handleEdit(shortcut)}
                >
                  <div className="shortcut-info">
                    <div className="shortcut-label">
                      {shortcut.label}
                      {isModified && <span className="modified-badge">Modified</span>}
                    </div>
                    <div className="shortcut-description">{shortcut.description}</div>
                  </div>

                  <div className="shortcut-key">
                    {isEditing ? (
                      <div className="key-editor" ref={overlayRef}>
                        <input
                          ref={inputRef}
                          type="text"
                          className={`form-input key-input ${editingKey && !isValidKey ? "invalid" : ""} ${isValidKey ? "valid" : ""}`}
                          value={editingKey || "Press keys..."}
                          onKeyDown={handleKeyDown}
                          placeholder="Press keys..."
                          readOnly
                          autoFocus
                        />
                        <div className="key-editor-hint">
                          {!editingKey && "Press a key combination (e.g. Ctrl+Shift+R)"}
                          {editingKey && !isValidKey && "Complete the combination with a non-modifier key"}
                          {isValidKey && "Valid hotkey - click Save to apply"}
                        </div>
                        <div className="key-editor-actions">
                          <button className="btn btn-sm" onClick={(e) => { e.stopPropagation(); handleCancel(); }}>
                            Cancel
                          </button>
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={(e) => { e.stopPropagation(); handleSave(); }}
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
                            className="reset-btn"
                            onClick={(e) => { e.stopPropagation(); handleReset(shortcut); }}
                            title="Reset to default"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                              <path d="M3 3v5h5" />
                            </svg>
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <div className="shortcuts-note">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
        <span>Global hotkeys work even when the app is not focused.</span>
      </div>
    </div>
  );
}
