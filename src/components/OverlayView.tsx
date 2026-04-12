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

export default function OverlayView() {
  const { phase, backendStatus } = useTranscription(true);

  const modelNotReady = backendStatus !== "ready";
  const displayState = modelNotReady ? "not-ready" : phase;

  useEffect(() => {
    const api = getApi();
    if (!api) return;
    // Compact size for the minimal indicator
    api.resizeOverlay(84, 84);
  }, [phase, modelNotReady]);

  const handleClick = () => {
    getApi()?.openSettings();
  };

  return (
    <div className="overlay-root">
      <div
        className={`overlay-indicator ${displayState}`}
        onClick={handleClick}
        data-tooltip={STATE_TOOLTIPS[displayState] || "VoiceToText"}
      >
        <div className="indicator-core">
          <div className="indicator-led" />
        </div>
      </div>
    </div>
  );
}
