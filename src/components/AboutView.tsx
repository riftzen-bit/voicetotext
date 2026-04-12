import { useState, useEffect } from "react";

interface SystemInfo {
  platform: string;
  arch: string;
  electronVersion: string;
  nodeVersion: string;
}

export default function AboutView() {
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Get system info from electron process if available
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

    const info = `VoiceToText v0.1.0
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
    <div className="about-view">
      {/* Logo and Version */}
      <div className="about-header">
        <div className="about-logo">
          <div className="logo-orb">
            <div className="logo-inner" />
          </div>
        </div>
        <h1 className="about-title">VoiceToText</h1>
        <div className="about-version">Version 0.1.0</div>
        <p className="about-tagline">Local voice-to-text with Whisper V3</p>
      </div>

      {/* Features */}
      <div className="about-section">
        <h3 className="subsection-header">Features</h3>
        <div className="feature-list">
          <div className="feature-item">
            <div className="feature-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="22" />
              </svg>
            </div>
            <div className="feature-text">
              <strong>Push-to-Talk Recording</strong>
              <span>Hold hotkey to record, release to transcribe</span>
            </div>
          </div>

          <div className="feature-item">
            <div className="feature-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            </div>
            <div className="feature-text">
              <strong>Auto-Paste</strong>
              <span>Automatically paste transcribed text</span>
            </div>
          </div>

          <div className="feature-item">
            <div className="feature-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <div className="feature-text">
              <strong>AI Refinement</strong>
              <span>Optional Gemini-powered grammar correction</span>
            </div>
          </div>

          <div className="feature-item">
            <div className="feature-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <div className="feature-text">
              <strong>100% Local Processing</strong>
              <span>Your audio never leaves your device</span>
            </div>
          </div>
        </div>
      </div>

      {/* System Info */}
      <div className="about-section">
        <h3 className="subsection-header">System Information</h3>
        {systemInfo && (
          <div className="system-info">
            <div className="info-row">
              <span className="info-label">Platform</span>
              <span className="info-value">{systemInfo.platform}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Architecture</span>
              <span className="info-value">{systemInfo.arch}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Electron</span>
              <span className="info-value">{systemInfo.electronVersion}</span>
            </div>
          </div>
        )}
        <button className="btn btn-sm" onClick={handleCopySystemInfo} style={{ marginTop: "12px" }}>
          {copied ? "Copied!" : "Copy System Info"}
        </button>
      </div>

      {/* Links */}
      <div className="about-section">
        <h3 className="subsection-header">Resources</h3>
        <div className="link-list">
          <button className="link-btn" onClick={() => openLink("https://github.com")}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
            </svg>
            GitHub Repository
          </button>
          <button className="link-btn" onClick={() => openLink("https://openai.com/research/whisper")}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
            Whisper by OpenAI
          </button>
          <button className="link-btn" onClick={() => openLink("https://ai.google.dev")}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            Google Gemini
          </button>
        </div>
      </div>

      {/* Credits */}
      <div className="about-section">
        <h3 className="subsection-header">Credits</h3>
        <div className="credits-text">
          <p>Built with Electron, React, and faster-whisper.</p>
          <p>Designed with inspiration from professional audio equipment.</p>
        </div>
      </div>

      {/* License */}
      <div className="about-footer">
        <p>MIT License</p>
        <p>Made with precision</p>
      </div>
    </div>
  );
}
