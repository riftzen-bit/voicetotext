import { useCallback, useEffect, useState } from "react";
import { getApi, ModelStatusInfo } from "../../lib/ipc";
import { useSettings } from "../../hooks/useSettings";
import { Section, Row, Segmented, Toggle } from "./primitives";

type PerModelStatus = ModelStatusInfo["status"];

function formatBytes(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${Math.round(mb)} MB`;
}

export default function EngineSection() {
  const { settings, loaded, updateSetting, modelCatalog } = useSettings();
  const [statuses, setStatuses] = useState<Record<string, PerModelStatus>>({});
  const [loadedModel, setLoadedModel] = useState<string | null>(null);
  const [backendStatus, setBackendStatus] = useState("stopped");
  const [runtimeLabel, setRuntimeLabel] = useState("");
  const [downloadingModel, setDownloadingModel] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);

  const refreshStatuses = useCallback(async () => {
    const api = getApi();
    if (!api) return;
    const entries = await Promise.all(
      modelCatalog.map(async (m) => {
        try {
          const info = await api.getModelStatus(m.value);
          return [m.value, info] as const;
        } catch {
          return [m.value, null] as const;
        }
      })
    );
    const next: Record<string, PerModelStatus> = {};
    let currentLoaded: string | null = null;
    let runtimeStr = "";
    for (const [value, info] of entries) {
      if (!info) continue;
      next[value] = info.status;
      if (info.status === "loaded" && info.loaded_model) {
        currentLoaded = info.loaded_model;
        runtimeStr = `${info.device} · ${info.runtime?.compute_type ?? ""}`;
      }
    }
    setStatuses(next);
    setLoadedModel(currentLoaded);
    if (runtimeStr) setRuntimeLabel(runtimeStr);
  }, [modelCatalog]);

  useEffect(() => {
    if (modelCatalog.length === 0) return;
    void refreshStatuses();
  }, [modelCatalog, refreshStatuses]);

  useEffect(() => {
    const api = getApi();
    if (!api) return;
    api.getBackendStatus().then(setBackendStatus);

    const unsubStatus = api.onBackendStatus((s) => {
      setBackendStatus(s);
      if (s === "ready" || s === "downloaded") void refreshStatuses();
    });

    const unsubProg = api.onModelProgress((data) => {
      const p = data.progress as number;
      const file = data.file as string | undefined;
      if (typeof p === "number") setDownloadProgress(p);
      if (file && !downloadingModel) {
        const match = modelCatalog.find((m) => file.toLowerCase().includes(m.value.toLowerCase()));
        if (match) setDownloadingModel(match.value);
      }
    });

    const unsubEvt = api.onModelEvent((data) => {
      const type = data.type as string;
      if (type === "download_complete" || type === "load_complete") {
        setDownloadProgress(null);
        setDownloadingModel(null);
        void refreshStatuses();
      } else if (type === "download_start") {
        const model = data.model as string | undefined;
        if (model) setDownloadingModel(model);
      }
    });

    return () => {
      unsubStatus();
      unsubProg();
      unsubEvt();
    };
  }, [modelCatalog, refreshStatuses, downloadingModel]);

  if (!loaded) return null;

  const api = getApi();

  const currentStatusLabel = (() => {
    if (downloadingModel) {
      const pct = downloadProgress !== null ? Math.round(downloadProgress * 100) : 0;
      return `Downloading ${downloadingModel} · ${pct}%`;
    }
    if (backendStatus === "ready") return "Ready";
    if (backendStatus === "loading") return "Loading model";
    if (backendStatus === "downloading") return "Downloading";
    if (backendStatus === "no_model") return "No model loaded";
    return backendStatus;
  })();

  const statusClass =
    backendStatus === "ready" && !downloadingModel
      ? "is-ready"
      : backendStatus === "loading" || downloadingModel
      ? "is-busy"
      : "";

  const handleDownload = (model: string) => {
    setDownloadingModel(model);
    setDownloadProgress(0);
    api?.startModelDownload(model);
  };

  const handleLoad = async (model: string) => {
    await updateSetting("modelSize", model);
    api?.loadModel(model);
  };

  return (
    <Section
      num="02"
      eyebrow="Engine"
      title="Transcription model"
      lede="VoiceToText runs Whisper locally on your GPU. Download a model, load it into memory, and it stays resident until you switch."
    >
      <div className="status-line">
        <span className={`status-dot ${statusClass}`} />
        <span>{currentStatusLabel}</span>
        {loadedModel && backendStatus === "ready" && !downloadingModel ? (
          <span className="text-muted" style={{ marginLeft: "auto" }}>
            {loadedModel}
            {runtimeLabel ? ` · ${runtimeLabel}` : ""}
          </span>
        ) : null}
      </div>

      {downloadProgress !== null && (
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${downloadProgress * 100}%` }} />
        </div>
      )}

      <div className="subheading">Models</div>

      <div className="list">
        {modelCatalog.map((m, i) => {
          const status = statuses[m.value];
          const isLoaded = status === "loaded";
          const isLoading = status === "loading";
          const isDownloaded = status === "downloaded";
          const isDownloading = downloadingModel === m.value || status === "downloading";
          const isNotDownloaded = status === "not_downloaded" || status === undefined;

          return (
            <div key={m.value} className="list-item">
              <span className="list-item-num">{(i + 1).toString().padStart(2, "0")}</span>
              <div className="list-item-body">
                <div className="list-item-title">
                  {m.label}
                  {isLoaded ? (
                    <span
                      className="text-accent mono"
                      style={{ fontSize: 10, marginLeft: 8, letterSpacing: "0.2em" }}
                    >
                      ACTIVE
                    </span>
                  ) : null}
                  {m.recommended && !isLoaded ? (
                    <span
                      className="text-muted mono"
                      style={{ fontSize: 10, marginLeft: 8, letterSpacing: "0.2em" }}
                    >
                      RECOMMENDED
                    </span>
                  ) : null}
                </div>
                <div className="list-item-sub">
                  {m.description} · {formatBytes(m.size_mb)}
                </div>
              </div>
              <div className="list-item-actions">
                {isLoading && (
                  <button className="btn" disabled>
                    Loading…
                  </button>
                )}
                {isDownloading && !isLoading && (
                  <button className="btn" disabled>
                    {downloadProgress !== null
                      ? `${Math.round(downloadProgress * 100)}%`
                      : "Downloading…"}
                  </button>
                )}
                {isDownloaded && !isLoaded && !isLoading && (
                  <button
                    className="btn btn--primary"
                    onClick={() => void handleLoad(m.value)}
                  >
                    Load
                  </button>
                )}
                {isNotDownloaded && !isDownloading && (
                  <button
                    className="btn btn--primary"
                    onClick={() => handleDownload(m.value)}
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
