import { useEffect, useState } from "react";
import { useTranscription } from "../hooks/useTranscription";
import { getApi } from "../lib/ipc";
import "../styles/overlay.css";

const STATE_LABELS: Record<string, string> = {
  idle: "Ready",
  recording: "Listening",
  processing: "Transcribing",
  refining: "Refining",
  done: "Done",
  error: "Error",
  "not-ready": "Setup",
};

const OVERLAY_WIDTH = 180;
const OVERLAY_HEIGHT = 40;
const BAR_COUNT = 8;

export default function OverlayView() {
  const { phase, audioLevel, backendStatus } = useTranscription(true);
  const [hovered, setHovered] = useState(false);

  const modelNotReady = backendStatus !== "ready";
  const displayState = modelNotReady ? "not-ready" : phase;

  const isActive =
    displayState === "recording" ||
    displayState === "processing" ||
    displayState === "refining";
  const expanded = isActive || hovered;

  useEffect(() => {
    getApi()?.resizeOverlay(OVERLAY_WIDTH, OVERLAY_HEIGHT);
  }, []);

  const handleClick = () => getApi()?.openSettings();

  // Noise-floor gate: the mic picks up faint ambient energy even during
  // silence, and the combined boost from useAudioCapture (2.5x) plus the
  // visual gain here (2.4x) turns that tiny signal into a visible wave.
  // Subtract a small floor and rescale so silence reads as a true 0.
  const NOISE_FLOOR = 0.12;
  const boosted = Math.min(1, Math.max(0, audioLevel * 2.4));
  const level =
    boosted < NOISE_FLOOR ? 0 : (boosted - NOISE_FLOOR) / (1 - NOISE_FLOOR);

  return (
    <div className="overlay-root">
      <div
        className={`overlay-pill ${displayState} ${expanded ? "expanded" : ""}`}
        onClick={handleClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        role="button"
        aria-label={STATE_LABELS[displayState] || "VoiceToText"}
        style={{ ["--audio-level" as string]: level } as React.CSSProperties}
      >
        <span className="pill-glass" aria-hidden="true" />

        <span className="pill-stage" aria-hidden="true">
          <span className="stage-idle">
            <span className="idle-dot" />
          </span>

          <span className="stage-wave">
            {Array.from({ length: BAR_COUNT }).map((_, i) => (
              <span
                key={i}
                className="wave-bar"
                style={{ ["--i" as string]: i } as React.CSSProperties}
              />
            ))}
          </span>

          <span className="stage-spin">
            <span className="spin-ring" />
            <span className="spin-core" />
          </span>
        </span>

        <span className="pill-label">
          {STATE_LABELS[displayState] || "VoiceToText"}
        </span>
      </div>
    </div>
  );
}
