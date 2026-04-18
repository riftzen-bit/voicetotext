import { useEffect, useState } from "react";
import { getApi } from "../../lib/ipc";

const APP_VERSION = "0.4.0";

export default function AboutSection() {
  const [backendStatus, setBackendStatus] = useState("unknown");
  const [platform, setPlatform] = useState("");

  useEffect(() => {
    const api = getApi();
    if (!api) return;
    api.getBackendStatus().then(setBackendStatus);
    const unsub = api.onBackendStatus(setBackendStatus);
    if (typeof navigator !== "undefined") {
      setPlatform(navigator.platform || "");
    }
    return () => unsub();
  }, []);

  return (
    <section className="section">
      <div className="about-hero">
        <div className="about-mark">Local · Offline · Yours</div>
        <h1 className="about-name">VoiceToText</h1>
        <div className="about-version">
          Version {APP_VERSION} · build {APP_VERSION.replace(/\./g, "")}
        </div>
      </div>

      <dl className="about-meta">
        <dt>Engine</dt>
        <dd>faster-whisper · large-v3</dd>
        <dt>Transport</dt>
        <dd className="mono">ws://127.0.0.1:8769</dd>
        <dt>Backend</dt>
        <dd>{backendStatus}</dd>
        <dt>Platform</dt>
        <dd>{platform || "unknown"}</dd>
        <dt>License</dt>
        <dd>MIT</dd>
      </dl>

      <div className="subheading">Principles</div>

      <p style={{ fontSize: 13, lineHeight: 1.7, color: "var(--text-secondary)", marginBottom: 16 }}>
        Audio never leaves this device. Transcription happens on your GPU. Only if
        you explicitly enable Gemini refinement does the final text get sent to
        Google, and even then, the raw audio stays local.
      </p>
      <p style={{ fontSize: 13, lineHeight: 1.7, color: "var(--text-secondary)" }}>
        The interface is intentionally quiet: a single accent, no glows, no
        ambient color. Keyboards and microphones are the tools — the UI should
        get out of the way.
      </p>
    </section>
  );
}
