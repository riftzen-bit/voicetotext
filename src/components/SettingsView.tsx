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
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      ),
    },
    {
      id: "ai",
      label: "Engine",
      primary: true,
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="22" />
        </svg>
      ),
    },
    {
      id: "history",
      label: "Transcript",
      primary: true,
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
      ),
      badge: history.length,
    },
    {
      id: "more",
      label: "More",
      primary: true,
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
        </svg>
      ),
    },
    {
      id: "templates",
      label: "Templates",
      description: "Context prompts that guide AI refinement.",
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <line x1="3" y1="9" x2="21" y2="9" />
          <line x1="9" y1="21" x2="9" y2="9" />
        </svg>
      ),
    },
    {
      id: "formatting",
      label: "Formatting",
      description: "Text cleanup rules applied after transcription.",
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
      ),
    },
    {
      id: "analytics",
      label: "Analytics",
      description: "Usage stats, language breakdown, activity charts.",
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="20" x2="18" y2="10" />
          <line x1="12" y1="20" x2="12" y2="4" />
          <line x1="6" y1="20" x2="6" y2="14" />
        </svg>
      ),
    },
    {
      id: "phrases",
      label: "Phrases",
      description: "Saved snippets you can paste by voice command.",
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="8" y1="6" x2="21" y2="6" />
          <line x1="8" y1="12" x2="21" y2="12" />
          <line x1="8" y1="18" x2="21" y2="18" />
          <line x1="3" y1="6" x2="3.01" y2="6" />
          <line x1="3" y1="12" x2="3.01" y2="12" />
          <line x1="3" y1="18" x2="3.01" y2="18" />
        </svg>
      ),
    },
    {
      id: "keywords",
      label: "Keywords",
      description: "Vocabulary corrections applied to every transcript.",
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 9h16" />
          <path d="M4 15h16" />
          <path d="M10 3L8 21" />
          <path d="M16 3l-2 18" />
        </svg>
      ),
    },
    {
      id: "shortcuts",
      label: "Shortcuts",
      description: "Global hotkey and command bindings.",
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="4" width="20" height="16" rx="2" ry="2" />
          <path d="M6 8h.001" />
          <path d="M10 8h.001" />
          <path d="M14 8h.001" />
          <path d="M18 8h.001" />
          <path d="M8 12h.001" />
          <path d="M12 12h.001" />
          <path d="M16 12h.001" />
          <path d="M7 16h10" />
        </svg>
      ),
    },
    {
      id: "export",
      label: "Export",
      description: "Save transcripts to file in various formats.",
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
      ),
    },
    {
      id: "appearance",
      label: "Appearance",
      description: "Theme, overlay, font, and visual tweaks.",
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
      ),
    },
    {
      id: "about",
      label: "About",
      description: "Version info, credits, and licenses.",
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
      ),
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
          <div className="brand-mark" />
          <span className="brand-name">VoiceToText</span>
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
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ transform: sidebarCollapsed ? "rotate(180deg)" : "none" }}
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
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
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="15 18 9 12 15 6" />
                </svg>
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
                    className={`toggle-switch ${settings.autoPaste ? "active" : ""}`}
                    onClick={() => updateSetting("autoPaste", !settings.autoPaste)}
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
                    <span className="field-hint">AI model for refinement</span>
                  </div>
                  <select
                    className="form-select"
                    value={settings.geminiModel}
                    onChange={(e) => updateSetting("geminiModel", e.target.value)}
                  >
                    <optgroup label="Latest (Recommended)">
                      <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                      <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                      <option value="gemini-2.5-flash-lite">Gemini 2.5 Flash Lite</option>
                    </optgroup>
                    <optgroup label="Preview Models">
                      <option value="gemini-3.1-flash-lite-preview">Gemini 3.1 Flash Lite (Preview)</option>
                      <option value="gemini-3-pro-preview">Gemini 3 Pro (Preview)</option>
                      <option value="gemini-3-flash-preview">Gemini 3 Flash (Preview)</option>
                    </optgroup>
                  </select>
                </div>
              </section>
            </div>
          )}

          {activeTab === "templates" && (
            <div className="settings-panel">
              <TemplatesView />
            </div>
          )}

          {activeTab === "formatting" && (
            <div className="settings-panel">
              <FormattingView />
            </div>
          )}

          {activeTab === "history" && (
            <div className="settings-panel" style={{ maxWidth: "100%" }}>
              <HistoryView entries={history} onClear={clearHistory} onCopy={handleCopy} onUpdate={updateEntry} onDelete={deleteEntry} />
              <div style={{ marginTop: "24px", borderTop: "1px solid var(--border)", paddingTop: "24px" }}>
                <ClipboardHistoryPanel />
              </div>
            </div>
          )}

          {activeTab === "analytics" && (
            <div className="settings-panel" style={{ maxWidth: "100%" }}>
              <AnalyticsView entries={history} />
            </div>
          )}

          {activeTab === "phrases" && (
            <div className="settings-panel" style={{ maxWidth: "100%" }}>
              <PhrasesView />
            </div>
          )}

          {activeTab === "keywords" && (
            <div className="settings-panel" style={{ maxWidth: "100%" }}>
              <KeywordsView />
            </div>
          )}

          {activeTab === "shortcuts" && (
            <div className="settings-panel">
              <ShortcutsView />
            </div>
          )}

          {activeTab === "export" && (
            <div className="settings-panel">
              <ExportView entries={history} />
            </div>
          )}

          {activeTab === "appearance" && (
            <div className="settings-panel">
              <AppearanceView />
            </div>
          )}

          {activeTab === "about" && (
            <div className="settings-panel">
              <AboutView />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
