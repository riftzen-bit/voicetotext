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
} from "lucide-react";
import "../styles/settings.css";

type ModelStatus = "not_downloaded" | "downloading" | "downloaded" | "loading" | "loaded" | "error";
type TabType = "general" | "ai" | "templates" | "formatting" | "history" | "analytics" | "phrases" | "keywords" | "shortcuts" | "export" | "appearance" | "about" | "more";

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
            <div className="settings-panel">
              <section className="settings-section">
                <h2 className="section-header">Workflow</h2>

                <div className="field-row">
                  <div className="field-info">
                    <span className="field-label">Activation Mode</span>
                    <span className="field-hint">How recording is triggered</span>
                  </div>
                  <select
                    className="form-select"
                    value={settings.hotkeyMode}
                    onChange={(e) => updateSetting("hotkeyMode", e.target.value as "ptt" | "ttt")}
                  >
                    <option value="ptt">Hold to Talk</option>
                    <option value="ttt">Toggle Mode</option>
                  </select>
                </div>

                <div className="field-row">
                  <div className="field-info">
                    <span className="field-label">Global Hotkey</span>
                    <span className="field-hint">Keyboard shortcut</span>
                  </div>
                  <input
                    className="form-input"
                    value={settings.hotkey}
                    onChange={(e) => updateSetting("hotkey", e.target.value)}
                    placeholder="Ctrl+Shift+R"
                  />
                </div>

                <div className="field-row">
                  <div className="field-info">
                    <span className="field-label">Auto-paste</span>
                    <span className="field-hint">Insert text into active window</span>
                  </div>
                  <div
                    role="switch"
                    aria-checked={!!settings.autoPaste}
                    aria-label="Auto-paste"
                    className={`toggle-switch ${settings.autoPaste ? "active" : ""}`}
                    onClick={() => updateSetting("autoPaste", !settings.autoPaste)}
                  />
                </div>

                <div className="field-row">
                  <div className="field-info">
                    <span className="field-label">Copy to clipboard</span>
                    <span className="field-hint">
                      Keep transcript on clipboard. Off preserves what you had
                      copied before recording.
                    </span>
                  </div>
                  <div
                    role="switch"
                    aria-checked={!!settings.copyToClipboard}
                    aria-label="Copy to clipboard"
                    className={`toggle-switch ${settings.copyToClipboard ? "active" : ""}`}
                    onClick={() =>
                      updateSetting("copyToClipboard", !settings.copyToClipboard)
                    }
                  />
                </div>
              </section>

              <section className="settings-section">
                <h2 className="section-header">Hardware</h2>

                <div className="field-row">
                  <div className="field-info">
                    <span className="field-label">Microphone</span>
                    <span className="field-hint">Audio input device</span>
                  </div>
                  <AudioDeviceSelect
                    value={settings.audioDevice}
                    onChange={(v) => updateSetting("audioDevice", v)}
                  />
                </div>
              </section>

              {pasteStatus && (
                <section className="settings-section">
                  <h2 className="section-header">Diagnostics</h2>
                  <div className="error-message">{pasteStatus.message}</div>
                </section>
              )}
            </div>
          )}

          {activeTab === "ai" && (
            <div className="settings-panel">
              <section className="settings-section">
                <h2 className="section-header">Local Engine</h2>

                <div className="field-row">
                  <div className="field-info">
                    <span className="field-label">Model</span>
                    <span className="field-hint">Whisper variant for transcription</span>
                  </div>
                  <select
                    className="form-select"
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
                </div>

                <div className="field-row">
                  <div className="field-info">
                    <span className="field-label">Language</span>
                    <span className="field-hint">Target language for recognition</span>
                  </div>
                  <select
                    className="form-select"
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
                </div>

                <div className="field-row">
                  <div className="field-info">
                    <span className="field-label">Status</span>
                    <span className="field-hint">{profileLabel}</span>
                  </div>
                  <div className="status-actions">
                    <span className={`status-badge ${statusBadge.className}`}>
                      {statusBadge.label}
                    </span>
                    {(modelStatus === "not_downloaded" || modelStatus === "error") && (
                      <button className="btn btn-primary" onClick={handleDownload}>
                        Download
                      </button>
                    )}
                    {modelStatus === "downloaded" && (
                      <button className="btn btn-primary" onClick={handleLoad}>
                        Load
                      </button>
                    )}
                  </div>
                </div>

                {modelStatus === "downloading" && (
                  <div className="progress-container">
                    <div className="progress-track">
                      <div className="progress-fill" style={{ width: `${progressPct}%` }} />
                    </div>
                    <div className="progress-stats">
                      <span>{dlDownloaded.toFixed(1)} / {dlTotal.toFixed(1)} MB</span>
                      {dlSpeed > 0 && <span>{dlSpeed.toFixed(1)} MB/s</span>}
                    </div>
                  </div>
                )}

                {modelStatus === "loading" && (
                  <div className="progress-container">
                    <div className="progress-track">
                      <div className="progress-fill indeterminate" />
                    </div>
                  </div>
                )}

                {errorMsg && modelStatus === "error" && (
                  <div className="error-message">{errorMsg}</div>
                )}

                {runtimeIssue && <div className="error-message">{runtimeIssue}</div>}
              </section>

              <section className="settings-section">
                <h2 className="section-header">Cloud Refinement</h2>
                <p className="section-description">
                  Connect a Gemini API key to automatically refine grammar and punctuation before pasting.
                </p>

                <div className="field-row">
                  <div className="field-info">
                    <span className="field-label">Enable Refinement</span>
                    <span className="field-hint">Post-process with AI</span>
                  </div>
                  <div
                    className={`toggle-switch ${settings.useGemini ? "active" : ""}`}
                    onClick={() => updateSetting("useGemini", !settings.useGemini)}
                  />
                </div>

                <div className="field-row" style={{ opacity: settings.useGemini ? 1 : 0.4, pointerEvents: settings.useGemini ? 'auto' : 'none' }}>
                  <div className="field-info">
                    <span className="field-label">API Key</span>
                    <span className="field-hint">
                      <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer">
                        Get a free key
                      </a>
                    </span>
                  </div>
                  <input
                    className="form-input"
                    type="password"
                    value={settings.geminiApiKey}
                    onChange={(e) => updateSetting("geminiApiKey", e.target.value)}
                    placeholder="Enter API key"
                  />
                </div>

                <div className="field-row" style={{ opacity: settings.useGemini ? 1 : 0.4, pointerEvents: settings.useGemini ? 'auto' : 'none' }}>
                  <div className="field-info">
                    <span className="field-label">Gemini Model</span>
                    <span className="field-hint">
                      {geminiModels === null
                        ? "Click 'Load models' to fetch the live list from Google"
                        : `${geminiModels.length} available`}
                    </span>
                  </div>
                  <div className="status-actions">
                    <select
                      className="form-select"
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
                          <option value="gemini-2.5-flash-lite">Gemini 2.5 Flash Lite</option>
                          <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                        </>
                      )}
                    </select>
                    <button
                      className="btn"
                      onClick={() => loadGeminiModels(true)}
                      disabled={geminiModelsLoading || !settings.geminiApiKey}
                      title="Re-query Google for the latest model list"
                    >
                      {geminiModelsLoading ? "Loading…" : "Load models"}
                    </button>
                  </div>
                </div>

                {geminiModelsError && (
                  <div className="error-message">{geminiModelsError}</div>
                )}
              </section>

              <section
                className="settings-section"
                style={{ opacity: settings.useGemini ? 1 : 0.4, pointerEvents: settings.useGemini ? "auto" : "none" }}
              >
                <h2 className="section-header">Pipeline</h2>
                <p className="section-description">
                  Two-step analyze-and-adjust flow. The first pass pulls out entities and intent in the
                  source language; the second rewrites the transcript in the target language using those
                  facts as anchors so names and numbers stay stable.
                </p>

                <div className="field-row">
                  <div className="field-info">
                    <span className="field-label">Mode</span>
                    <span className="field-hint">How to transform the transcript</span>
                  </div>
                  <select
                    className="form-select"
                    value={settings.aiMode}
                    onChange={(e) => updateSetting("aiMode", e.target.value as AiMode)}
                  >
                    <option value="off">Off (single-shot polish)</option>
                    <option value="refine">Refine (clean up, same language)</option>
                    <option value="translate">Translate to target language</option>
                    <option value="summarize-translate">Summarize + Translate</option>
                  </select>
                </div>

                <div className="field-row">
                  <div className="field-info">
                    <span className="field-label">Output Language</span>
                    <span className="field-hint">Target language for refined text</span>
                  </div>
                  <select
                    className="form-select"
                    value={settings.uiLanguage}
                    onChange={(e) => updateSetting("uiLanguage", e.target.value)}
                  >
                    {UI_LANGUAGES.map((l) => (
                      <option key={l.code} value={l.code}>{l.label}</option>
                    ))}
                  </select>
                </div>
              </section>
            </div>
          )}

          {activeTab === "templates" && <TemplatesView />}

          {activeTab === "formatting" && <FormattingView />}

          {activeTab === "history" && (
            <div className="settings-panel" style={{ maxWidth: "100%" }}>
              <HistoryView entries={history} onClear={clearHistory} onCopy={handleCopy} onUpdate={updateEntry} onDelete={deleteEntry} />
              <div style={{ marginTop: "24px", borderTop: "1px solid var(--border)", paddingTop: "24px" }}>
                <ClipboardHistoryPanel />
              </div>
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
