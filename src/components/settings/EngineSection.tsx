import { useEffect, useState } from "react";
import { getApi, ModelStatusInfo } from "../../lib/ipc";
import { useSettings } from "../../hooks/useSettings";
import { Section, Row, Segmented, Toggle } from "./primitives";

function formatBytes(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${Math.round(mb)} MB`;
}

export default function EngineSection() {
  const { settings, loaded, updateSetting, modelCatalog } = useSettings();
  const [status, setStatus] = useState<ModelStatusInfo | null>(null);
  const [backendStatus, setBackendStatus] = useState("stopped");
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const [downloadLabel, setDownloadLabel] = useState("");

  useEffect(() => {
    const api = getApi();
    if (!api) return;

    api.getModelStatus().then(setStatus).catch(() => {});
    api.getBackendStatus().then(setBackendStatus);

    const unsubStatus = api.onBackendStatus((s) => setBackendStatus(s));
    const unsubProg = api.onModelProgress((data) => {
      const p = data.progress as number;
      if (typeof p === "number") {
        setDownloadProgress(p);
        setDownloadLabel(`Downloading ${Math.round(p * 100)}%`);
      }
    });
    const unsubEvt = api.onModelEvent((data) => {
      const type = data.type as string;
      if (type === "load_complete") {
        setDownloadProgress(null);
        setDownloadLabel("");
        api.getModelStatus().then(setStatus).catch(() => {});
      } else if (type === "download_complete") {
        setDownloadProgress(null);
        setDownloadLabel("Downloaded");
        api.getModelStatus().then(setStatus).catch(() => {});
      }
    });

    return () => {
      unsubStatus();
      unsubProg();
      unsubEvt();
    };
  }, []);

  if (!loaded) return null;

  const api = getApi();

  const currentStatusLabel = (() => {
    if (downloadLabel) return downloadLabel;
    if (backendStatus === "ready") return "Ready";
    if (backendStatus === "loading") return "Loading model";
    if (backendStatus === "downloading") return "Downloading";
    if (backendStatus === "no_model") return "No model loaded";
    return backendStatus;
  })();

  const statusClass =
    backendStatus === "ready"
      ? "is-ready"
      : backendStatus === "loading" || backendStatus === "downloading"
      ? "is-busy"
      : "";

  return (
    <Section
      num="02"
      eyebrow="Engine"
      title="Transcription model"
      lede="VoiceToText runs Whisper locally on your GPU. Pick a model, choose a speed profile, and tell it what language to expect."
    >
      <div className="status-line">
        <span className={`status-dot ${statusClass}`} />
        <span>{currentStatusLabel}</span>
        {status?.loaded_model && backendStatus === "ready" ? (
          <span className="text-muted" style={{ marginLeft: "auto" }}>
            {status.loaded_model} · {status.device} · {status.runtime?.compute_type}
          </span>
        ) : null}
      </div>

      {downloadProgress !== null && (
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${downloadProgress * 100}%` }} />
        </div>
      )}

      <div className="subheading">Model</div>

      <div className="list">
        {modelCatalog.map((m, i) => {
          const isActive = settings.modelSize === m.value;
          const isLoaded = status?.loaded_model === m.value;
          return (
            <div key={m.value} className="list-item">
              <span className="list-item-num">{(i + 1).toString().padStart(2, "0")}</span>
              <div className="list-item-body">
                <div className="list-item-title">
                  {m.label}
                  {isLoaded ? (
                    <span className="text-accent mono" style={{ fontSize: 10, marginLeft: 8, letterSpacing: "0.2em" }}>
                      ACTIVE
                    </span>
                  ) : null}
                </div>
                <div className="list-item-sub">
                  {m.description} · {formatBytes(m.size_mb)}
                </div>
              </div>
              <div className="list-item-actions">
                {!isActive && (
                  <button
                    className="btn"
                    onClick={() => {
                      updateSetting("modelSize", m.value);
                      api?.loadModel(m.value);
                    }}
                  >
                    Use
                  </button>
                )}
                {isActive && !isLoaded && (
                  <button
                    className="btn btn--primary"
                    onClick={() => api?.startModelDownload(m.value)}
                  >
                    Download
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="subheading">Profile</div>

      <Row label="Accuracy / speed" hint="Fast trades precision for latency; Accurate is slower but tighter.">
        <Segmented
          value={settings.transcriptionProfile}
          options={[
            { value: "fast", label: "Fast" },
            { value: "balanced", label: "Balanced" },
            { value: "accurate", label: "Accurate" },
          ]}
          onChange={(v) => updateSetting("transcriptionProfile", v)}
        />
      </Row>

      <Row label="Language" hint="Force a language or let Whisper detect.">
        <select
          className="select-input"
          value={settings.languageHint}
          onChange={(e) => updateSetting("languageHint", e.target.value)}
        >
          <option value="auto">Auto-detect</option>
          <option value="en">English</option>
          <option value="vi">Vietnamese</option>
          <option value="zh">Chinese</option>
          <option value="ja">Japanese</option>
          <option value="ko">Korean</option>
          <option value="es">Spanish</option>
          <option value="fr">French</option>
          <option value="de">German</option>
          <option value="pt">Portuguese</option>
          <option value="ru">Russian</option>
        </select>
      </Row>

      <Row label="Adaptive model" hint="Switch models automatically based on system load.">
        <Toggle
          checked={!!settings.adaptiveModelEnabled}
          onChange={(v) => updateSetting("adaptiveModelEnabled", v)}
        />
      </Row>
    </Section>
  );
}
