import { useEffect, useState } from "react";
import { useTranscription } from "../hooks/useTranscription";
import { getApi } from "../lib/ipc";
import Waveform from "./Waveform";
import "../styles/overlay.css";

const STATE_LABELS: Record<string, string> = {
  idle: "Ready",
  recording: "Recording",
  processing: "Transcribing",
  refining: "Refining",
  done: "Done",
  error: "Error",
  "not-ready": "Setup",
};

// Collapsed pill = 72 px circle; expanded pill = 280 x 72.
// Window is sized to the maximum so CSS can animate width freely.
const OVERLAY_WIDTH = 320;
const OVERLAY_HEIGHT = 96;

export default function OverlayView() {
  const { phase, audioLevel, backendStatus } = useTranscription(true);
  const [hovered, setHovered] = useState(false);

  const modelNotReady = backendStatus !== "ready";
  const displayState = modelNotReady ? "not-ready" : phase;

  // Expanded whenever the pill has meaningful content to show:
  // recording / processing / refining always expand; idle expands on hover.
  const isActivePhase =
    displayState === "recording" ||
    displayState === "processing" ||
    displayState === "refining";
  const expanded = isActivePhase || hovered;

  useEffect(() => {
    const api = getApi();
    if (!api) return;
    api.resizeOverlay(OVERLAY_WIDTH, OVERLAY_HEIGHT);
  }, []);

  const handleClick = () => {
    getApi()?.openSettings();
  };

  return (
    <div className="overlay-root">
      <div
        className={`overlay-pill ${displayState} ${expanded ? "expanded" : ""}`}
        onClick={handleClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        role="button"
        aria-label={STATE_LABELS[displayState] || "VoiceToText"}
      >
        <span className="overlay-specular" aria-hidden="true" />
        <span className="overlay-orb" aria-hidden="true">
          <span className="overlay-orb-core" />
        </span>
        <span className="overlay-body">
          <span className="overlay-wave">
            <Waveform
              level={audioLevel}
              active={displayState === "recording"}
              width={140}
              height={22}
            />
          </span>
          <span className="overlay-label">
            {STATE_LABELS[displayState] || "VoiceToText"}
          </span>
        </span>
      </div>
    </div>
  );
}
