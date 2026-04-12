import { useEffect, useState, useCallback, useRef } from "react";
import { getApi, ModelProgress, ModelStatusInfo } from "../lib/ipc";
import { useSettings } from "../hooks/useSettings";
import "../styles/setup.css";

type ModelStatus = "not_downloaded" | "downloading" | "downloaded" | "loading" | "loaded" | "error";

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
      // backend not ready yet
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

  return (
    <div className="setup-root">
      <div className="setup-titlebar">
        <span className="setup-title">VoiceToText</span>
      </div>

      <div className="setup-body">
        <div className="setup-label">Whisper Model</div>

        <div className="setup-model-row">
          <select
            className="setup-model-select"
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
          <span className="setup-model-size">
            {selectedOption ? `${(selectedOption.size_mb / 1024).toFixed(1)} GB` : "-"}
          </span>
        </div>

        {selectedOption && (
          <div className="setup-model-desc">{selectedOption.description}</div>
        )}

        <div className="setup-device-row">
          <span className="setup-device-label">Device</span>
          <span className="setup-device-value">{device.toUpperCase()}</span>
        </div>

        {runtimeIssue && (
          <div className="setup-model-desc">{runtimeIssue}</div>
        )}

        <div className="setup-divider" />

        {status === "not_downloaded" && (
          <div className="setup-action-area">
            <div className="setup-status-line">
              <span className="setup-status-dot not-downloaded" />
              <span>Not downloaded</span>
            </div>
            <button className="setup-btn primary" onClick={handleDownload}>
              Download Model
            </button>
          </div>
        )}

        {status === "downloading" && (
          <div className="setup-action-area">
            {currentFile && (
              <div className="setup-download-file">{currentFile}</div>
            )}
            <div className="setup-progress-track">
              <div
                className="setup-progress-fill"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className="setup-progress-stats">
              <span className="setup-progress-pct">{progressPct}%</span>
              <span className="setup-progress-detail">
                {downloadedMb.toFixed(1)} / {totalMb.toFixed(1)} MB
              </span>
              <span className="setup-progress-speed">
                {speedMbps > 0 ? `${speedMbps.toFixed(1)} MB/s` : "-"}
              </span>
              <span className="setup-progress-eta">ETA {formatEta()}</span>
            </div>
          </div>
        )}

        {status === "downloaded" && (
          <div className="setup-action-area">
            <div className="setup-status-line">
              <span className="setup-status-dot downloaded" />
              <span>Downloaded</span>
            </div>
            <button className="setup-btn primary" onClick={handleLoad}>
              Load Model
            </button>
          </div>
        )}

        {status === "loading" && (
          <div className="setup-action-area">
            <div className="setup-status-line">
              <span className="setup-status-dot loading" />
              <span>Loading into {device.toUpperCase()}</span>
            </div>
            <div className="setup-loading-bar">
              <div className="setup-loading-bar-inner" />
            </div>
          </div>
        )}

        {status === "loaded" && (
          <div className="setup-action-area">
            <div className="setup-status-line">
              <span className="setup-status-dot ready" />
              <span>Ready ({device.toUpperCase()})</span>
            </div>
            <div className="setup-ready-info">
              Model loaded. You can close this window.
            </div>
          </div>
        )}

        {status === "error" && (
          <div className="setup-action-area">
            <div className="setup-status-line">
              <span className="setup-status-dot error" />
              <span>Error</span>
            </div>
            {errorMsg && <div className="setup-error-msg">{errorMsg}</div>}
            <button className="setup-btn primary" onClick={handleDownload}>
              Retry Download
            </button>
          </div>
        )}
      </div>

      <div className="setup-footer">
        VoiceToText v0.1.0
      </div>
    </div>
  );
}
