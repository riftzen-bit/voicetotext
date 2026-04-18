import { useEffect, useState, useCallback, useRef } from "react";
import { useSettings } from "../hooks/useSettings";
import { useTranscription } from "../hooks/useTranscription";
import { getApi, ModelProgress, ModelStatusInfo } from "../lib/ipc";
import AudioDeviceSelect from "./AudioDeviceSelect";
import HistoryView from "./HistoryView";
import ClipboardHistoryPanel from "./ClipboardHistoryPanel";
import AnalyticsView from "./AnalyticsView";
import PhrasesView from "./PhrasesView";
import KeywordsView from "./KeywordsView";
import ShortcutsView from "./ShortcutsView";
import ExportView from "./ExportView";
import AppearanceView from "./AppearanceView";
import TemplatesView from "./TemplatesView";
import FormattingView from "./FormattingView";
import AboutView from "./AboutView";
import KeywordSuggestionBanner from "./KeywordSuggestionBanner";
import MoreView from "./MoreView";
import { fetchGeminiModels, GeminiModelInfo, UI_LANGUAGES, AiMode } from "../lib/ai";
import { CategoryIcon } from "../assets/icons/CategoryIcon";
import {
  Settings as SettingsGlyph,
  Cpu,
  FileText,
  LayoutGrid,
  Layers,
  Wand2,
  BarChart3,
  MessageSquareText,
  BookMarked,
  Command,
  Download,
  Palette,
  Info,
  ChevronLeft,
  Mic,
  Keyboard,
  Clipboard,
  Copy,
  AlertTriangle,
} from "lucide-react";
import "../styles/settings.css";

type ModelStatus = "not_downloaded" | "downloading" | "downloaded" | "loading" | "loaded" | "error";
type TabType = "general" | "ai" | "templates" | "formatting" | "history" | "analytics" | "phrases" | "keywords" | "shortcuts" | "export" | "appearance" | "about" | "more";

const PIPELINE_MODES: { value: AiMode; label: string; hint: string }[] = [
  { value: "off", label: "Off", hint: "Single-shot polish only. No analyze, adjust, or review." },
  { value: "refine", label: "Refine", hint: "Clean grammar and punctuation in the same language." },
  { value: "translate", label: "Translate", hint: "Rewrite the transcript in your target language." },
  { value: "summarize-translate", label: "Summarize + translate", hint: "Condense the transcript, then translate." },
];

interface TabConfig {
  id: TabType;
  label: string;
  icon: React.ReactNode;
  badge?: number;
  // `primary: true` keeps the tab in the left rail. Everything else is
  // auxiliary and only reachable via the "More" landing page.
  primary?: boolean;
  // One-line blurb shown on the More grid card.
  description?: string;
}

function WindowControls() {
  const [isMaximized, setIsMaximized] = useState(false);
  const api = getApi();

  useEffect(() => {
    if (!api) return;
    api.windowIsMaximized().then(setIsMaximized);
  }, []);

  // macOS renders native traffic lights via titleBarStyle: "hiddenInset".
  // Returning null here avoids double controls; titlebar drag region still
  // works because -webkit-app-region is on .settings-titlebar in CSS.
  if (api?.platform === "darwin") return null;

  const handleMinimize = () => api?.windowMinimize();
  const handleMaximize = () => {
    api?.windowMaximize();
    setIsMaximized(!isMaximized);
  };
  const handleClose = () => api?.windowClose();

  return (
    <div className="window-controls">
      <button className="window-btn minimize" onClick={handleMinimize} title="Minimize">
        <svg width="10" height="1" viewBox="0 0 10 1">
          <rect width="10" height="1" fill="currentColor"/>
        </svg>
      </button>
      <button className="window-btn maximize" onClick={handleMaximize} title={isMaximized ? "Restore" : "Maximize"}>
        {isMaximized ? (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M2 3V8H7V3H2Z" stroke="currentColor" strokeWidth="1"/>
            <path d="M3 2V1H8V6H7" stroke="currentColor" strokeWidth="1"/>
          </svg>
        ) : (
          <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
            <rect x="0.5" y="0.5" width="8" height="8" stroke="currentColor"/>
          </svg>
        )}
      </button>
      <button className="window-btn close" onClick={handleClose} title="Close">
        <svg width="10" height="10" viewBox="0 0 10 10">
          <path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        </svg>
      </button>
    </div>
  );
}

export default function SettingsView() {
  const { settings, loaded, updateSetting, modelCatalog } = useSettings();
  const { history, clearHistory, updateEntry, deleteEntry, backendStatus, pasteStatus } = useTranscription(false);

  const [activeTab, setActiveTab] = useState<TabType>("general");
  const [modelStatus, setModelStatus] = useState<ModelStatus>("not_downloaded");
  const [modelDevice, setModelDevice] = useState("cpu");
  const [dlProgress, setDlProgress] = useState(0);
  const [dlDownloaded, setDlDownloaded] = useState(0);
  const [dlTotal, setDlTotal] = useState(0);
  const [dlSpeed, setDlSpeed] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
  const [runtimeIssue, setRuntimeIssue] = useState("");
  const [profileLabel, setProfileLabel] = useState("");

  // Live Gemini catalog: fetched on demand via the backend proxy so we never
  // ship hardcoded model IDs that might be retired by Google. null = not yet
  // fetched; [] = fetched but API returned nothing (show hardcoded fallback).
  const [geminiModels, setGeminiModels] = useState<GeminiModelInfo[] | null>(null);
  const [geminiModelsError, setGeminiModelsError] = useState<string>("");
  const [geminiModelsLoading, setGeminiModelsLoading] = useState(false);

  const loadGeminiModels = useCallback(async (force = false) => {
    if (!settings.geminiApiKey) {
      setGeminiModelsError("Enter an API key first");
      return;
    }
    setGeminiModelsLoading(true);
    setGeminiModelsError("");
    try {
      const models = await fetchGeminiModels(settings.geminiApiKey, force);
      setGeminiModels(models);
    } catch (e) {
      setGeminiModelsError(e instanceof Error ? e.message : "Failed to load models");
    } finally {
      setGeminiModelsLoading(false);
    }
  }, [settings.geminiApiKey]);

  // Sidebar state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem("vtt-sidebar-collapsed");
    return saved === "true";
  });
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem("vtt-sidebar-width");
    return saved ? parseInt(saved, 10) : 200;
  });
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);

  // Persist sidebar state
  useEffect(() => {
    localStorage.setItem("vtt-sidebar-collapsed", String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  useEffect(() => {
    localStorage.setItem("vtt-sidebar-width", String(sidebarWidth));
  }, [sidebarWidth]);

  // Sidebar resize handlers
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = Math.min(Math.max(e.clientX, 160), 320);
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = "ew-resize";
    document.body.style.userSelect = "none";

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing]);

  const tabs: TabConfig[] = [
    {
      id: "general",
      label: "System",
      primary: true,
      icon: <CategoryIcon icon={SettingsGlyph} color="graphite" />,
    },
    {
      id: "ai",
      label: "Engine",
      primary: true,
      icon: <CategoryIcon icon={Cpu} color="indigo" />,
    },
    {
      id: "history",
      label: "Transcript",
      primary: true,
      icon: <CategoryIcon icon={FileText} color="green" />,
      badge: history.length,
    },
    {
      id: "more",
      label: "More",
      primary: true,
      icon: <CategoryIcon icon={LayoutGrid} color="purple" />,
    },
    {
      id: "templates",
      label: "Templates",
      description: "Context prompts that guide AI refinement.",
      icon: <CategoryIcon icon={Layers} color="blue" />,
    },
    {
      id: "formatting",
      label: "Formatting",
      description: "Text cleanup rules applied after transcription.",
      icon: <CategoryIcon icon={Wand2} color="pink" />,
    },
    {
      id: "analytics",
      label: "Analytics",
      description: "Usage stats, language breakdown, activity charts.",
      icon: <CategoryIcon icon={BarChart3} color="orange" />,
    },
    {
      id: "phrases",
      label: "Phrases",
      description: "Saved snippets you can paste by voice command.",
      icon: <CategoryIcon icon={MessageSquareText} color="teal" />,
    },
    {
      id: "keywords",
      label: "Keywords",
      description: "Vocabulary corrections applied to every transcript.",
      icon: <CategoryIcon icon={BookMarked} color="brown" />,
    },
    {
      id: "shortcuts",
      label: "Shortcuts",
      description: "Global hotkey and command bindings.",
      icon: <CategoryIcon icon={Command} color="cyan" />,
    },
    {
      id: "export",
      label: "Export",
      description: "Save transcripts to file in various formats.",
      icon: <CategoryIcon icon={Download} color="yellow" />,
    },
    {
      id: "appearance",
      label: "Appearance",
      description: "Theme, overlay, font, and visual tweaks.",
      icon: <CategoryIcon icon={Palette} color="red" />,
    },
    {
      id: "about",
      label: "About",
      description: "Version info, credits, and licenses.",
      icon: <CategoryIcon icon={Info} color="graphite" />,
    },
  ];

  const primaryTabs = tabs.filter((t) => t.primary);
  const auxiliaryTabs = tabs.filter((t) => !t.primary);
  const auxiliaryIds = new Set(auxiliaryTabs.map((t) => t.id));
  const activeTabMeta = tabs.find((t) => t.id === activeTab);

  const fetchModelStatus = useCallback(async () => {
    const api = getApi();
    if (!api) return;
    try {
      const info = await api.getModelStatus(settings.modelSize) as unknown as ModelStatusInfo;
      setModelStatus(info.status);
      setModelDevice(info.device || "cpu");
      setRuntimeIssue(info.runtime?.runtime_issue || "");
      setProfileLabel(
        `${info.transcription?.profile || settings.transcriptionProfile} / ${info.transcription?.language || settings.languageHint || "auto"}`
      );
      if (info.size_mb) setDlTotal(info.size_mb);
    } catch {
      // backend not ready
    }
  }, [settings.modelSize]);

  useEffect(() => {
    if (!loaded) return;
    fetchModelStatus();
    const iv = setInterval(fetchModelStatus, 4000);
    return () => clearInterval(iv);
  }, [loaded, fetchModelStatus]);

  useEffect(() => {
    const api = getApi();
    if (!api) return;

    const unsubProgress = api.onModelProgress((data: Record<string, unknown>) => {
      const d = data as unknown as ModelProgress;
      setModelStatus("downloading");
      setDlProgress(d.progress);
      setDlDownloaded(d.downloaded_mb);
      setDlTotal(d.total_mb);
      setDlSpeed(d.speed_mbps);
    });

    const unsubEvent = api.onModelEvent((data: Record<string, unknown>) => {
      const type = data.type as string;
      if (type === "download_complete") {
        setModelStatus("downloaded");
        setDlProgress(1);
      } else if (type === "download_error") {
        setModelStatus("error");
        setErrorMsg(String(data.message || "Download failed"));
      } else if (type === "load_started") {
        setModelStatus("loading");
      } else if (type === "load_complete") {
        setModelStatus("loaded");
      } else if (type === "load_error") {
        setModelStatus("error");
        setErrorMsg(String(data.message || "Load failed"));
      }
    });

    const unsubBackend = api.onBackendStatus((s: string) => {
      if (s === "ready") setModelStatus("loaded");
    });

    return () => {
      unsubProgress();
      unsubEvent();
      unsubBackend();
    };
  }, []);

  if (!loaded) return null;

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const handleDownload = () => {
    const api = getApi();
    if (!api) return;
    setModelStatus("downloading");
    setDlProgress(0);
    setDlDownloaded(0);
    setErrorMsg("");
    api.startModelDownload(settings.modelSize);
  };

  const handleLoad = () => {
    const api = getApi();
    if (!api) return;
    setModelStatus("loading");
    setErrorMsg("");
    api.loadModel(settings.modelSize);
  };

  const progressPct = Math.round(dlProgress * 100);

  const getStatusBadge = () => {
    switch (modelStatus) {
      case "loaded":
        return { className: "ready", label: `Ready / ${modelDevice.toUpperCase()}` };
      case "loading":
        return { className: "loading", label: "Loading..." };
      case "downloading":
        return { className: "loading", label: `${progressPct}%` };
      case "downloaded":
        return { className: "", label: "Cached" };
      case "error":
        return { className: "error", label: "Error" };
      default:
        return { className: "", label: "Not Downloaded" };
    }
  };

  const statusBadge = getStatusBadge();

  return (
    <div className="settings-root">
      <KeywordSuggestionBanner />
      <div className="settings-titlebar">
        <div className="titlebar-brand">
          <span className="brand-mark" aria-hidden>
            <Mic size={12} strokeWidth={2.5} />
          </span>
          <span className="brand-name">VoiceToText</span>
        </div>
        <div className="titlebar-status" role="group" aria-label="Live status">
          <button
            type="button"
            className={`status-chip mic ${settings.audioDevice ? "ok" : "warn"}`}
            onClick={() => setActiveTab("general")}
            title="Microphone"
          >
            <span className="chip-dot" />
            <span className="chip-label">Mic</span>
            <span className="chip-value">
              {settings.audioDevice
                ? String(settings.audioDevice).slice(0, 14)
                : "Default"}
            </span>
          </button>
          <button
            type="button"
            className={`status-chip model ${
              modelStatus === "loaded"
                ? "ok"
                : modelStatus === "error"
                ? "err"
                : "warn"
            }`}
            onClick={() => setActiveTab("ai")}
            title="Local transcription model"
          >
            <span className="chip-dot" />
            <span className="chip-label">Model</span>
            <span className="chip-value">
              {modelStatus === "loaded"
                ? `${settings.modelSize} · ${modelDevice.toUpperCase()}`
                : statusBadge.label}
            </span>
          </button>
          <button
            type="button"
            className={`status-chip ai ${
              settings.useGemini && settings.geminiApiKey ? "ok" : "off"
            }`}
            onClick={() => setActiveTab("ai")}
            title="Cloud refinement"
          >
            <span className="chip-dot" />
            <span className="chip-label">AI</span>
            <span className="chip-value">
              {settings.useGemini && settings.geminiApiKey
                ? String(settings.geminiModel || "Gemini").replace(/^gemini-/, "")
                : "Off"}
            </span>
          </button>
        </div>
        <WindowControls />
      </div>

      <div className="settings-layout">
        <nav
          ref={sidebarRef}
          className={`settings-nav ${sidebarCollapsed ? "collapsed" : ""}`}
          style={{ width: sidebarCollapsed ? 56 : sidebarWidth }}
        >
          <button
            className="sidebar-toggle"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <ChevronLeft
              size={16}
              strokeWidth={2}
              style={{ transform: sidebarCollapsed ? "rotate(180deg)" : "none" }}
            />
          </button>

          <div className="nav-items">
            {primaryTabs.map((tab) => {
              // The "More" rail entry highlights whenever an auxiliary page
              // is open, so the user can see at a glance that they're inside
              // the More section regardless of which sub-page is rendered.
              const isActive =
                activeTab === tab.id ||
                (tab.id === "more" && auxiliaryIds.has(activeTab));
              return (
                <button
                  key={tab.id}
                  className={`nav-item ${isActive ? "active" : ""}`}
                  onClick={() => setActiveTab(tab.id)}
                  title={sidebarCollapsed ? tab.label : undefined}
                >
                  <span className="nav-icon">{tab.icon}</span>
                  <span className="nav-label">{tab.label}</span>
                  {tab.badge !== undefined && tab.badge > 0 && (
                    <span className="nav-badge">{tab.badge}</span>
                  )}
                </button>
              );
            })}
          </div>

          {!sidebarCollapsed && (
            <div
              className="sidebar-resize-handle"
              onMouseDown={handleResizeStart}
            />
          )}
        </nav>

        <main className="settings-content">
          {auxiliaryIds.has(activeTab) && (
            <nav className="settings-breadcrumb" aria-label="Breadcrumb">
              <button
                type="button"
                className="breadcrumb-link"
                onClick={() => setActiveTab("more")}
              >
                <ChevronLeft size={14} strokeWidth={2} />
                More
              </button>
              <span className="breadcrumb-sep">/</span>
              <span className="breadcrumb-current">{activeTabMeta?.label}</span>
            </nav>
          )}

          {activeTab === "more" && (
            <MoreView
              items={auxiliaryTabs.map((t) => ({
                id: t.id,
                label: t.label,
                description: t.description || "",
                icon: t.icon,
              }))}
              onNavigate={(id) => setActiveTab(id as TabType)}
            />
          )}

          {activeTab === "general" && (
            <div className="settings-panel settings-panel--capture">
              <section className="capture-hero">
                <div className="capture-hero-head">
                  <div className="capture-hero-titles">
                    <span className="capture-hero-eyebrow">Capture</span>
                    <h2 className="capture-hero-title">Voice input</h2>
                    <p className="capture-hero-sub">
                      Hold the shortcut to record, release to transcribe. Switch to Toggle
                      if you prefer starting and stopping with two presses.
                    </p>
                  </div>
                  <div
                    className="capture-mode-segmented"
                    role="tablist"
                    aria-label="Activation mode"
                  >
                    <button
                      type="button"
                      role="tab"
                      aria-selected={settings.hotkeyMode === "ptt"}
                      className={`capture-mode-pill ${settings.hotkeyMode === "ptt" ? "active" : ""}`}
                      onClick={() => updateSetting("hotkeyMode", "ptt")}
                    >
                      Hold to talk
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={settings.hotkeyMode === "ttt"}
                      className={`capture-mode-pill ${settings.hotkeyMode === "ttt" ? "active" : ""}`}
                      onClick={() => updateSetting("hotkeyMode", "ttt")}
                    >
                      Toggle
                    </button>
                  </div>
                </div>

                <div className="capture-hotkey-row">
                  <span className="capture-hotkey-label">
                    <Keyboard size={13} strokeWidth={2} />
                    Global shortcut
                  </span>
                  <div className="capture-hotkey-display" aria-hidden>
                    {settings.hotkey
                      ? settings.hotkey
                          .split("+")
                          .map((s) => s.trim())
                          .filter(Boolean)
                          .flatMap((key, i, arr) =>
                            i < arr.length - 1
                              ? [
                                  <kbd key={`k-${i}`} className="capture-key">{key}</kbd>,
                                  <span key={`p-${i}`} className="capture-hotkey-plus">+</span>,
                                ]
                              : [<kbd key={`k-${i}`} className="capture-key">{key}</kbd>]
                          )
                      : <span className="capture-hotkey-empty">Not set</span>}
                  </div>
                  <input
                    className="capture-hotkey-input"
                    value={settings.hotkey}
                    onChange={(e) => updateSetting("hotkey", e.target.value)}
                    placeholder="Ctrl+Shift+R"
                    aria-label="Global hotkey"
                    spellCheck={false}
                  />
                </div>
              </section>

              <section className="capture-input-card">
                <div className="capture-input-head">
                  <span className="capture-input-icon" aria-hidden>
                    <Mic size={16} strokeWidth={2} />
                  </span>
                  <div>
                    <span className="capture-input-title">Microphone</span>
                    <span className="capture-input-hint">Audio input device used for recording</span>
                  </div>
                </div>
                <AudioDeviceSelect
                  value={settings.audioDevice}
                  onChange={(v) => updateSetting("audioDevice", v)}
                />
              </section>

              <section className="capture-output-grid" aria-label="Output behaviour">
                <button
                  type="button"
                  role="switch"
                  aria-checked={!!settings.autoPaste}
                  className={`capture-output-card ${settings.autoPaste ? "on" : ""}`}
                  onClick={() => updateSetting("autoPaste", !settings.autoPaste)}
                >
                  <span className="capture-output-icon" aria-hidden>
                    <Clipboard size={15} strokeWidth={2} />
                  </span>
                  <span className="capture-output-body">
                    <span className="capture-output-title">Auto-paste</span>
                    <span className="capture-output-hint">
                      Drop the transcript into the focused window as soon as it's ready.
                    </span>
                  </span>
                  <span
                    className={`toggle-switch ${settings.autoPaste ? "active" : ""}`}
                    aria-hidden
                  />
                </button>

                <button
                  type="button"
                  role="switch"
                  aria-checked={!!settings.copyToClipboard}
                  className={`capture-output-card ${settings.copyToClipboard ? "on" : ""}`}
                  onClick={() =>
                    updateSetting("copyToClipboard", !settings.copyToClipboard)
                  }
                >
                  <span className="capture-output-icon" aria-hidden>
                    <Copy size={15} strokeWidth={2} />
                  </span>
                  <span className="capture-output-body">
                    <span className="capture-output-title">Keep on clipboard</span>
                    <span className="capture-output-hint">
                      Leave the transcript on your clipboard. Off restores what you had
                      copied before recording.
                    </span>
                  </span>
                  <span
                    className={`toggle-switch ${settings.copyToClipboard ? "active" : ""}`}
                    aria-hidden
                  />
                </button>
              </section>

              {pasteStatus && (
                <section className="capture-alert" role="alert">
                  <AlertTriangle size={16} strokeWidth={2} />
                  <div className="capture-alert-body">
                    <strong>Paste diagnostic</strong>
                    <p>{pasteStatus.message}</p>
                  </div>
                </section>
              )}
            </div>
          )}

          {activeTab === "ai" && (
            <div className="settings-panel settings-panel--engine">
              <section className="engine-hero">
                <div className="engine-hero-head">
                  <div className="engine-hero-titles">
                    <span className="engine-hero-eyebrow">Local engine</span>
                    <h2 className="engine-hero-title">On-device transcription</h2>
                    <p className="engine-hero-sub">
                      Whisper runs entirely on your machine. Audio never leaves the device,
                      no cloud round-trip required.
                    </p>
                  </div>
                  <div
                    className={`engine-hero-badge ${statusBadge.className || "idle"}`}
                    title={profileLabel || undefined}
                  >
                    <span className="engine-status-dot" />
                    <span className="engine-status-label">{statusBadge.label}</span>
                  </div>
                </div>

                <div className="engine-hero-stats" role="list">
                  <div className="engine-stat" role="listitem">
                    <span className="engine-stat-label">Model</span>
                    <span className="engine-stat-value">{settings.modelSize}</span>
                  </div>
                  <div className="engine-stat" role="listitem">
                    <span className="engine-stat-label">Device</span>
                    <span className="engine-stat-value">{modelDevice.toUpperCase()}</span>
                  </div>
                  <div className="engine-stat engine-stat--wide" role="listitem">
                    <span className="engine-stat-label">Profile</span>
                    <span className="engine-stat-value engine-stat-value--sm">
                      {profileLabel || "—"}
                    </span>
                  </div>
                </div>

                <div className="engine-hero-grid">
                  <label className="engine-field">
                    <span className="engine-field-label">Whisper model</span>
                    <span className="engine-field-hint">
                      Larger models are more accurate but slower to run.
                    </span>
                    <select
                      className="form-select engine-select"
                      value={settings.modelSize}
                      onChange={(e) => {
                        updateSetting("modelSize", e.target.value);
                        setDlProgress(0);
                        setDlDownloaded(0);
                        setErrorMsg("");
                      }}
                      disabled={modelStatus === "downloading" || modelStatus === "loading"}
                    >
                      {modelCatalog.map((model) => (
                        <option key={model.value} value={model.value}>
                          {model.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="engine-field">
                    <span className="engine-field-label">Input language</span>
                    <span className="engine-field-hint">
                      Narrow recognition to one language or leave it on auto-detect.
                    </span>
                    <select
                      className="form-select engine-select"
                      value={settings.languageHint}
                      onChange={(e) => updateSetting("languageHint", e.target.value)}
                    >
                      <option value="auto">Auto-detect</option>
                      <option value="vi">Vietnamese</option>
                      <option value="en">English</option>
                      <option value="ja">Japanese</option>
                      <option value="ko">Korean</option>
                      <option value="zh">Chinese</option>
                      <option value="fr">French</option>
                      <option value="de">German</option>
                      <option value="es">Spanish</option>
                    </select>
                  </label>
                </div>

                {(modelStatus === "not_downloaded" ||
                  modelStatus === "error" ||
                  modelStatus === "downloaded") && (
                  <div className="engine-hero-actions">
                    {(modelStatus === "not_downloaded" || modelStatus === "error") && (
                      <button className="engine-btn primary" onClick={handleDownload}>
                        Download model
                      </button>
                    )}
                    {modelStatus === "downloaded" && (
                      <button className="engine-btn primary" onClick={handleLoad}>
                        Load model
                      </button>
                    )}
                  </div>
                )}

                {modelStatus === "downloading" && (
                  <div className="engine-progress">
                    <div className="engine-progress-track">
                      <div
                        className="engine-progress-fill"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                    <div className="engine-progress-stats">
                      <span>
                        {dlDownloaded.toFixed(1)} / {dlTotal.toFixed(1)} MB ·{" "}
                        {progressPct}%
                      </span>
                      {dlSpeed > 0 && <span>{dlSpeed.toFixed(1)} MB/s</span>}
                    </div>
                  </div>
                )}

                {modelStatus === "loading" && (
                  <div className="engine-progress">
                    <div className="engine-progress-track">
                      <div className="engine-progress-fill indeterminate" />
                    </div>
                    <div className="engine-progress-stats">
                      <span>Loading model into memory…</span>
                    </div>
                  </div>
                )}

                {errorMsg && modelStatus === "error" && (
                  <div className="capture-alert" role="alert">
                    <AlertTriangle size={16} strokeWidth={2} />
                    <div className="capture-alert-body">
                      <strong>Model error</strong>
                      <p>{errorMsg}</p>
                    </div>
                  </div>
                )}

                {runtimeIssue && (
                  <div className="capture-alert" role="alert">
                    <AlertTriangle size={16} strokeWidth={2} />
                    <div className="capture-alert-body">
                      <strong>Runtime warning</strong>
                      <p>{runtimeIssue}</p>
                    </div>
                  </div>
                )}
              </section>

              <section className={`cloud-card ${settings.useGemini ? "on" : "off"}`}>
                <header className="cloud-head">
                  <div className="cloud-head-text">
                    <span className="cloud-eyebrow">Cloud refinement</span>
                    <h2 className="cloud-title">AI polish with Gemini</h2>
                    <p className="cloud-sub">
                      Post-process each transcript through Google Gemini to fix grammar,
                      apply templates, and translate. Connect a free key — only the text
                      you record is sent, never the audio.
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={!!settings.useGemini}
                    aria-label="Enable AI refinement"
                    className={`toggle-switch cloud-toggle ${settings.useGemini ? "active" : ""}`}
                    onClick={() => updateSetting("useGemini", !settings.useGemini)}
                  />
                </header>

                <div
                  className={`cloud-body ${settings.useGemini ? "" : "disabled"}`}
                  aria-hidden={!settings.useGemini}
                >
                  <label className="engine-field">
                    <span className="engine-field-label">API key</span>
                    <span className="engine-field-hint">
                      <a
                        href="https://aistudio.google.com/app/apikey"
                        target="_blank"
                        rel="noreferrer"
                      >
                        Get a free key from Google AI Studio →
                      </a>
                    </span>
                    <input
                      className="form-input engine-input"
                      type="password"
                      value={settings.geminiApiKey}
                      onChange={(e) => updateSetting("geminiApiKey", e.target.value)}
                      placeholder="Paste your Gemini API key"
                      spellCheck={false}
                      autoComplete="off"
                    />
                  </label>

                  <label className="engine-field">
                    <span className="engine-field-label">Gemini model</span>
                    <span className="engine-field-hint">
                      {geminiModels === null
                        ? "Click Refresh to load the live model list from Google."
                        : `${geminiModels.length} model${geminiModels.length === 1 ? "" : "s"} available.`}
                    </span>
                    <div className="cloud-model-row">
                      <select
                        className="form-select engine-select"
                        value={settings.geminiModel}
                        onChange={(e) => updateSetting("geminiModel", e.target.value)}
                      >
                        {geminiModels && geminiModels.length > 0 ? (
                          geminiModels.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.displayName} ({m.id})
                            </option>
                          ))
                        ) : (
                          <>
                            <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                            <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                            <option value="gemini-2.5-flash-lite">
                              Gemini 2.5 Flash Lite
                            </option>
                            <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                          </>
                        )}
                      </select>
                      <button
                        type="button"
                        className="engine-btn"
                        onClick={() => loadGeminiModels(true)}
                        disabled={geminiModelsLoading || !settings.geminiApiKey}
                        title="Re-query Google for the latest model list"
                      >
                        {geminiModelsLoading ? "Loading…" : "Refresh"}
                      </button>
                    </div>
                  </label>

                  {geminiModelsError && (
                    <div className="capture-alert" role="alert">
                      <AlertTriangle size={16} strokeWidth={2} />
                      <div className="capture-alert-body">
                        <strong>Model load failed</strong>
                        <p>{geminiModelsError}</p>
                      </div>
                    </div>
                  )}
                </div>
              </section>

              <section className={`pipeline-card ${settings.useGemini ? "" : "disabled"}`}>
                <header className="pipeline-head">
                  <span className="pipeline-eyebrow">Pipeline</span>
                  <h2 className="pipeline-title">Three-step refinement</h2>
                  <p className="pipeline-sub">
                    Analyze entities and intent, adjust the transcript in your target
                    language, then review the draft before it lands in the focused window.
                  </p>
                </header>

                <div
                  className="pipeline-mode-grid"
                  role="radiogroup"
                  aria-label="Pipeline mode"
                >
                  {PIPELINE_MODES.map((m) => {
                    const active = settings.aiMode === m.value;
                    return (
                      <button
                        key={m.value}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        className={`pipeline-mode-card ${active ? "active" : ""}`}
                        onClick={() => updateSetting("aiMode", m.value)}
                        disabled={!settings.useGemini}
                      >
                        <span className="pipeline-mode-body">
                          <span className="pipeline-mode-title">{m.label}</span>
                          <span className="pipeline-mode-hint">{m.hint}</span>
                        </span>
                        <span
                          className={`pipeline-mode-radio ${active ? "on" : ""}`}
                          aria-hidden
                        />
                      </button>
                    );
                  })}
                </div>

                <label className="engine-field pipeline-lang">
                  <span className="engine-field-label">Output language</span>
                  <span className="engine-field-hint">
                    Target language the refined text will be delivered in.
                  </span>
                  <select
                    className="form-select engine-select"
                    value={settings.uiLanguage}
                    onChange={(e) => updateSetting("uiLanguage", e.target.value)}
                    disabled={!settings.useGemini}
                  >
                    {UI_LANGUAGES.map((l) => (
                      <option key={l.code} value={l.code}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                </label>
              </section>
            </div>
          )}

          {activeTab === "templates" && <TemplatesView />}

          {activeTab === "formatting" && <FormattingView />}

          {activeTab === "history" && (
            <div className="settings-panel settings-panel--transcript">
              <HistoryView
                entries={history}
                onClear={clearHistory}
                onCopy={handleCopy}
                onUpdate={updateEntry}
                onDelete={deleteEntry}
              />
              <ClipboardHistoryPanel />
            </div>
          )}

          {activeTab === "analytics" && <AnalyticsView entries={history} />}

          {activeTab === "phrases" && <PhrasesView />}

          {activeTab === "keywords" && <KeywordsView />}

          {activeTab === "shortcuts" && <ShortcutsView />}

          {activeTab === "export" && <ExportView entries={history} />}

          {activeTab === "appearance" && <AppearanceView />}

          {activeTab === "about" && <AboutView />}
        </main>
      </div>
    </div>
  );
}
