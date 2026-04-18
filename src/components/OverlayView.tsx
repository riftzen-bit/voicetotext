import { useEffect } from "react";
import { useTranscription } from "../hooks/useTranscription";
import { getApi } from "../lib/ipc";
import "../styles/overlay.css";

const STATE_TOOLTIPS: Record<string, string> = {
  idle: "Ready",
  recording: "Recording",
  processing: "Processing",
  refining: "Refining",
  done: "Complete",
  error: "Error",
  "not-ready": "Setup required",
};

const WAVE_BARS = 5;

export default function OverlayView() {
  const { phase, backendStatus } = useTranscription(true);

  const modelNotReady = backendStatus !== "ready";
  const displayState = modelNotReady ? "not-ready" : phase;

  useEffect(() => {
    getApi()?.resizeOverlay(180, 60);
  }, []);

  const handleClick = () => {
    getApi()?.openSettings();
  };

  return (
    <div className="overlay-root">
      <div
        className={`overlay-pill state-${displayState}`}
        onClick={handleClick}
        data-tooltip={STATE_TOOLTIPS[displayState] || "VoiceToText"}
      >
        <div className="pill-viz">
          {displayState === "recording" ? (
            <div className="wave">
              {Array.from({ length: WAVE_BARS }).map((_, i) => (
                <span key={i} className="wave-bar" style={{ animationDelay: `${i * 90}ms` }} />
              ))}
            </div>
          ) : (
            <div className="dots">
              <span className="dot" />
              <span className="dot" />
              <span className="dot" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
