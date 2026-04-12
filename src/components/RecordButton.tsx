import type { RecordingPhase } from "../hooks/useTranscription";

interface RecordButtonProps {
  phase: RecordingPhase;
}

const PHASE_LABELS: Record<RecordingPhase, string> = {
  idle: "IDLE",
  recording: "REC",
  processing: "PROC",
  refining: "AI",
  done: "DONE",
  error: "ERR",
};

export default function RecordButton({ phase }: RecordButtonProps) {
  return (
    <span className={`overlay-status ${phase}`}>
      {phase === "recording" && <span className="rec-dot active" />}
      {PHASE_LABELS[phase]}
    </span>
  );
}
