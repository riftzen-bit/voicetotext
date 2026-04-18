import { useState, useEffect } from "react";
import {
  Mic,
  Clipboard,
  Sparkles,
  Lock,
  Code2,
  Globe,
  Star,
  Copy,
  Check,
  Info,
  ExternalLink,
} from "lucide-react";

interface SystemInfo {
  platform: string;
  arch: string;
  electronVersion: string;
  nodeVersion: string;
}

const FEATURES: { Icon: typeof Mic; title: string; hint: string }[] = [
  {
    Icon: Mic,
    title: "Push-to-talk recording",
    hint: "Hold the hotkey to record, release to transcribe.",
  },
  {
    Icon: Clipboard,
    title: "Auto-paste",
    hint: "Drop the transcript into the focused app automatically.",
  },
  {
    Icon: Sparkles,
    title: "AI refinement",
    hint: "Optional Gemini polish for grammar, tone, and templates.",
  },
  {
    Icon: Lock,
    title: "100% local transcription",
    hint: "Whisper runs on your device — audio never leaves.",
  },
];

const RESOURCES: { Icon: typeof Code2; label: string; url: string }[] = [
  { Icon: Code2, label: "GitHub repository", url: "https://github.com" },
  { Icon: Globe, label: "Whisper by OpenAI", url: "https://openai.com/research/whisper" },
  { Icon: Star, label: "Google Gemini", url: "https://ai.google.dev" },
];

export default function AboutView() {
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const info: SystemInfo = {
      platform: navigator.platform || "Unknown",
      arch: navigator.userAgent.includes("x64") ? "x64" : "x86",
      electronVersion: "34.0.0",
      nodeVersion: "20.x",
    };
    setSystemInfo(info);
  }, []);

  const handleCopySystemInfo = async () => {
    if (!systemInfo) return;
    const info = `VoiceToText v0.2.0
Platform: ${systemInfo.platform}
Architecture: ${systemInfo.arch}
Electron: ${systemInfo.electronVersion}
User Agent: ${navigator.userAgent}`;
    try {
      await navigator.clipboard.writeText(info);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const openLink = (url: string) => {
    window.open(url, "_blank");
  };

  return (
    <div className="about-view feature-view feature-view--wide">
      <header className="feature-hero">
        <span className="feature-medallion tone-blue" aria-hidden>
          <Mic />
        </span>
        <div className="feature-hero-body">
          <span className="feature-hero-eyebrow">
            <Sparkles size={12} strokeWidth={2.5} /> About
          </span>
          <h1 className="feature-hero-title">VoiceToText</h1>
          <p className="feature-hero-description">
            Local voice-to-text with Whisper V3. Push to talk, auto-paste,
            optional AI polish. Your audio never leaves the device.
          </p>
          <div className="feature-hero-meta">
            <span className="feature-chip accent">Version 0.2.0</span>
            <span className="feature-chip">MIT licensed</span>
          </div>
        </div>
      </header>

      <section className="feature-card feature-card--flat">
        <h3 className="feature-section-title">Features</h3>
        <div className="about-feature-grid">
          {FEATURES.map(({ Icon, title, hint }) => (
            <div key={title} className="about-feature">
              <span className="about-feature-icon" aria-hidden>
                <Icon />
              </span>
              <div className="about-feature-body">
                <span className="about-feature-title">{title}</span>
                <span className="about-feature-hint">{hint}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="feature-card feature-card--flat">
        <h3 className="feature-section-title">
          <Info size={18} strokeWidth={2} /> System information
        </h3>
        {systemInfo && (
          <div className="about-info-grid">
            <div className="about-info-row">
              <span className="about-info-label">Platform</span>
              <span className="about-info-value">{systemInfo.platform}</span>
            </div>
            <div className="about-info-row">
              <span className="about-info-label">Architecture</span>
              <span className="about-info-value">{systemInfo.arch}</span>
            </div>
            <div className="about-info-row">
              <span className="about-info-label">Electron</span>
              <span className="about-info-value">{systemInfo.electronVersion}</span>
            </div>
            <div className="about-info-row">
              <span className="about-info-label">Node</span>
              <span className="about-info-value">{systemInfo.nodeVersion}</span>
            </div>
          </div>
        )}
        <div className="feature-form-actions" style={{ marginTop: 16 }}>
          <button className="feature-btn" onClick={handleCopySystemInfo}>
            {copied ? <Check /> : <Copy />}
            {copied ? "Copied" : "Copy system info"}
          </button>
        </div>
      </section>

      <section className="feature-card feature-card--flat">
        <h3 className="feature-section-title">Resources</h3>
        <div className="about-link-grid">
          {RESOURCES.map(({ Icon, label, url }) => (
            <button
              key={url}
              className="about-link"
              onClick={() => openLink(url)}
            >
              <span className="about-link-icon" aria-hidden>
                <Icon />
              </span>
              <span className="about-link-label">{label}</span>
              <span className="about-link-arrow" aria-hidden>
                <ExternalLink size={16} strokeWidth={2} />
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="feature-card feature-card--flat">
        <h3 className="feature-section-title">Credits</h3>
        <p className="about-credits">
          Built with Electron, React, and faster-whisper. Designed with
          inspiration from professional audio equipment. Made with precision.
        </p>
      </section>
    </div>
  );
}
