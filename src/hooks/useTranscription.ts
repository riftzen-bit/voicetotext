import { useCallback, useEffect, useRef, useState } from "react";
import { getApi, PasteStatusInfo } from "../lib/ipc";
import { useAudioCapture } from "./useAudioCapture";
import { useWebSocket, TranscriptionMessage } from "./useWebSocket";
import { useSettings } from "./useSettings";
import { playSound } from "../lib/sounds";
import { refineTextWithGemini, generateWithGemini } from "../lib/gemini";
import { refineWithPipeline, reviewDraft } from "../lib/ai";
import { withTimeout } from "../lib/with-timeout";

// Cap AI refinement so a hung Gemini call can't strand a 5+ minute recording
// in the "refining" phase forever. The raw transcript is saved to history
// before this runs, so a timeout gracefully falls back to raw.
const AI_REFINEMENT_TIMEOUT_MS = 60_000;

export type RecordingPhase = "idle" | "recording" | "processing" | "refining" | "done" | "error";

export type TranscriptionCategory = "general" | "code" | "design" | "meeting" | "note" | "command";

export interface TranscriptionEntry {
  id: string;
  text: string;
  language: string;
  confidence: number;
  duration: number;
  timestamp: number;
  refined?: boolean;
  category?: TranscriptionCategory;
}

/**
 * Classify transcription text into categories based on content analysis
 */
export function classifyText(text: string): TranscriptionCategory {
  const lowerText = text.toLowerCase();

  // Code patterns
  const codePatterns = [
    /\b(function|const|let|var|class|import|export|return|if|else|for|while)\b/,
    /\b(async|await|promise|callback|api|json|http|url|database|query)\b/,
    /\b(bug|error|debug|fix|refactor|deploy|commit|push|pull|merge|branch)\b/,
    /[{}();=><]/,
    /\b(npm|pip|git|docker|kubernetes|aws|azure)\b/i,
  ];

  // Design patterns
  const designPatterns = [
    /\b(design|layout|color|font|style|ui|ux|interface|wireframe|prototype)\b/,
    /\b(figma|sketch|adobe|photoshop|illustrator|canva)\b/i,
    /\b(pixel|margin|padding|width|height|responsive|mobile|desktop)\b/,
    /\b(typography|spacing|grid|component|icon|button|form)\b/,
  ];

  // Meeting patterns
  const meetingPatterns = [
    /\b(meeting|call|discuss|agenda|action|item|follow|up|schedule)\b/,
    /\b(team|project|deadline|milestone|sprint|standup|review)\b/,
    /\b(attendee|participant|presenter|stakeholder)\b/,
  ];

  // Command patterns (short imperative sentences)
  const commandPatterns = [
    /^(open|close|start|stop|run|execute|create|delete|update|find|search|show|hide)\b/i,
    /^(please|can you|could you|i want|i need)\b/i,
  ];

  // Note patterns
  const notePatterns = [
    /\b(note|remember|todo|reminder|idea|thought|important)\b/,
    /^(don't forget|make sure|need to)\b/i,
  ];

  // Check patterns in order of specificity
  for (const pattern of codePatterns) {
    if (pattern.test(lowerText)) return "code";
  }

  for (const pattern of designPatterns) {
    if (pattern.test(lowerText)) return "design";
  }

  for (const pattern of meetingPatterns) {
    if (pattern.test(lowerText)) return "meeting";
  }

  for (const pattern of commandPatterns) {
    if (pattern.test(lowerText)) return "command";
  }

  for (const pattern of notePatterns) {
    if (pattern.test(lowerText)) return "note";
  }

  return "general";
}

export function useTranscription(enableWs = true) {
  const [phase, setPhase] = useState<RecordingPhase>("idle");
  const [currentText, setCurrentText] = useState("");
  const [history, setHistory] = useState<TranscriptionEntry[]>([]);
  const [backendStatus, setBackendStatus] = useState("stopped");
  const [modelProgress, setModelProgress] = useState(0);
  const [modelStatusLabel, setModelStatusLabel] = useState("");
  const [pasteStatus, setPasteStatus] = useState<PasteStatusInfo | null>(null);
  const phaseRef = useRef<RecordingPhase>("idle");
  const processingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recordingStartRef = useRef<number>(0);
  const { settings, loaded } = useSettings();

  const audio = useAudioCapture();
  const ws = useWebSocket(enableWs);

  useEffect(() => {
    const api = getApi();
    if (!api) return;
    
    api.getHistory().then((h) => setHistory(h || []));
    
    const unsubHistory = api.onHistoryChanged((h) => {
      setHistory(h || []);
    });

    const unsub = api.onRecordingState((state) => {
      if (state === "start" && phaseRef.current === "idle") {
        startRecording();
      } else if (state === "stop" && phaseRef.current === "recording") {
        stopRecording();
      } else if (state === "cancel" && phaseRef.current === "recording") {
        cancelRecording();
      }
    });

    const unsubStatus = api.onBackendStatus((status) => {
      setBackendStatus(status);
      if (status === "downloading") setModelStatusLabel("Downloading…");
      else if (status === "loading") setModelStatusLabel("Loading model…");
      else if (status === "no_model") setModelStatusLabel("No model");
      else if (status === "ready") setModelStatusLabel("");
      else if (status === "downloaded") setModelStatusLabel("Downloaded");
    });

    const unsubProgress = api.onModelProgress((data: Record<string, unknown>) => {
      const p = data.progress as number;
      if (typeof p === "number") {
        setModelProgress(p);
        const pct = Math.round(p * 100);
        setModelStatusLabel(`Downloading ${pct}%`);
      }
    });

    const unsubEvent = api.onModelEvent((data: Record<string, unknown>) => {
      const type = data.type as string;
      if (type === "load_complete") {
        setModelStatusLabel("");
        setBackendStatus("ready");
      } else if (type === "download_complete") {
        setModelStatusLabel("Downloaded");
        setBackendStatus("downloaded");
      }
    });

    const unsubPaste = api.onPasteStatus((data) => {
      setPasteStatus(data);
    });

    api.getBackendStatus().then(setBackendStatus);

    return () => {
      unsub();
      unsubStatus();
      unsubProgress();
      unsubEvent();
      unsubPaste();
      unsubHistory();
    };
  }, []);

  useEffect(() => {
    if (!ws.lastMessage) return;
    handleWsMessage(ws.lastMessage);
  }, [ws.lastMessage]);

  useEffect(() => {
    const api = getApi();
    if (!api || !loaded) return;
    void api.setTranscriptionConfig(settings.transcriptionProfile, settings.languageHint);
  }, [loaded, settings.transcriptionProfile, settings.languageHint]);

  const startRecording = useCallback(async () => {
    playSound("start");
    phaseRef.current = "recording";
    setPhase("recording");
    setCurrentText("");
    setPasteStatus(null);
    recordingStartRef.current = Date.now();
    ws.startSession();

    // Mute other apps while recording
    try {
      await fetch("http://127.0.0.1:8769/api/mute", { method: "POST" });
    } catch (err) {
      console.warn("Failed to mute other apps:", err);
    }

    await audio.startCapture((chunk) => {
      ws.sendAudio(chunk);
    }, settings.audioDevice);
  }, [audio, ws, settings.audioDevice]);

  const stopRecording = useCallback(async () => {
    playSound("stop");
    await audio.stopCapture();
    phaseRef.current = "processing";
    setPhase("processing");
    ws.sendEnd();

    // No destructive timeout here. The backend keeps the session alive for up
    // to an hour, and the client re-sends any missing audio on reconnect, so
    // a slow transcription or a transient socket drop must never wipe the
    // buffered dictation. The user can press cancel if they truly want to
    // abandon the session.
    if (processingTimeoutRef.current) {
      clearTimeout(processingTimeoutRef.current);
      processingTimeoutRef.current = null;
    }

    // Unmute other apps after recording
    try {
      await fetch("http://127.0.0.1:8769/api/unmute", { method: "POST" });
    } catch (err) {
      console.warn("Failed to unmute other apps:", err);
    }
  }, [audio, ws]);

  const cancelRecording = useCallback(async () => {
    playSound("cancel");
    await audio.stopCapture();
    phaseRef.current = "idle";
    setPhase("idle");
    setCurrentText("");
    if (processingTimeoutRef.current) {
      clearTimeout(processingTimeoutRef.current);
      processingTimeoutRef.current = null;
    }
    ws.sendCancel();

    // Unmute other apps after cancellation
    try {
      await fetch("http://127.0.0.1:8769/api/unmute", { method: "POST" });
    } catch (err) {
      console.warn("Failed to unmute other apps:", err);
    }
  }, [audio, ws]);

  const handleWsMessage = useCallback(
    async (msg: TranscriptionMessage) => {
      // Clear processing timeout on any terminal response
      if (msg.type === "result" || msg.type === "empty" || msg.type === "error" || msg.type === "cancelled") {
        if (processingTimeoutRef.current) {
          clearTimeout(processingTimeoutRef.current);
          processingTimeoutRef.current = null;
        }
        ws.clearSession();
      }

      switch (msg.type) {
        case "transcribing":
          setPhase("processing");
          phaseRef.current = "processing";
          break;

        case "result": {
          const rawText = msg.text || "";
          const api = getApi();

          // Save raw transcript to history IMMEDIATELY so a hung or failing
          // AI refinement can never wipe out a long recording. We'll patch
          // this same entry in place if refinement produces different text.
          const entryId = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          const baseEntry: TranscriptionEntry = {
            id: entryId,
            text: rawText,
            language: msg.language || "unknown",
            confidence: msg.language_probability || 0,
            duration: msg.duration || 0,
            timestamp: Date.now(),
            refined: false,
            category: classifyText(rawText),
          };
          if (api && rawText.length > 0) {
            api.addHistory(baseEntry);
          }

          let text = rawText;
          let wasRefined = false;

          // Resolve the active template FIRST — its existence changes whether
          // we run AI at all. A user who explicitly activated a template has
          // opted into AI; the separate `useGemini` toggle is legacy and
          // shouldn't override that intent. Code mode (explicit opt-out) still
          // wins, and we always require an API key.
          const templates = settings.contextTemplates as Array<{ id: string; prompt: string; mode?: "polish" | "agent" }> | undefined;
          const activeTemplateId = settings.activeTemplateId as string | undefined;
          const activeTemplate = templates?.find(t => t.id === activeTemplateId);
          const contextPrompt = activeTemplate?.prompt;
          const isAgentTemplate = activeTemplate?.mode === "agent";

          const aiEligible =
            Boolean(settings.geminiApiKey) &&
            text.length > 0 &&
            !settings.codeMode &&
            (settings.useGemini || Boolean(activeTemplate));

          if (aiEligible) {
            setPhase("refining");
            phaseRef.current = "refining";

            const mode = settings.aiMode;
            try {
              if (isAgentTemplate && contextPrompt) {
                // Agent template owns the prompt — transcript is the user request.
                // Bypass the pipeline + polish base prompt entirely.
                const reply = await withTimeout(
                  generateWithGemini(
                    text,
                    settings.geminiApiKey,
                    settings.geminiModel,
                    contextPrompt,
                  ),
                  AI_REFINEMENT_TIMEOUT_MS,
                  "Gemini agent",
                );
                let draft = reply && reply !== text ? reply : text;
                // Review pass: AI reviews its own agent response and commits
                // to the FINAL version that reaches the focused window. On
                // failure we fall back to the draft so we never lose work.
                if (draft !== text) {
                  try {
                    const reviewed = await withTimeout(
                      reviewDraft({
                        original: text,
                        draft,
                        apiKey: settings.geminiApiKey,
                        model: settings.geminiModel,
                        template: contextPrompt,
                        kind: "agent",
                      }),
                      AI_REFINEMENT_TIMEOUT_MS,
                      "AI review (agent)"
                    );
                    if (reviewed && reviewed.trim().length > 0) draft = reviewed;
                  } catch (err) {
                    console.warn("Agent review pass failed, using draft:", err);
                  }
                  text = draft;
                  wasRefined = true;
                }
              } else if (mode && mode !== "off") {
                const sourceLang =
                  msg.language && (msg.language_probability ?? 0) > 0.6
                    ? msg.language
                    : "auto";
                const result = await withTimeout(
                  refineWithPipeline({
                    text,
                    sourceLang,
                    targetLang: settings.uiLanguage || "en",
                    mode,
                    template: contextPrompt,
                    apiKey: settings.geminiApiKey,
                    model: settings.geminiModel,
                  }),
                  AI_REFINEMENT_TIMEOUT_MS,
                  "AI pipeline"
                );
                if (result.text && result.text !== text) {
                  text = result.text;
                  wasRefined = true;
                }
              } else {
                const refinedText = await withTimeout(
                  refineTextWithGemini(
                    text,
                    settings.geminiApiKey,
                    settings.geminiModel,
                    contextPrompt
                  ),
                  AI_REFINEMENT_TIMEOUT_MS,
                  "Gemini polish"
                );
                let draft = refinedText && refinedText !== text ? refinedText : text;
                // Review pass for the legacy single-call polish branch so
                // every AI flow (pipeline / agent / legacy) ends on a
                // reviewed FINAL before paste. Fall back to draft on error.
                if (draft !== text) {
                  try {
                    const reviewed = await withTimeout(
                      reviewDraft({
                        original: text,
                        draft,
                        apiKey: settings.geminiApiKey,
                        model: settings.geminiModel,
                        template: contextPrompt,
                        kind: "polish",
                      }),
                      AI_REFINEMENT_TIMEOUT_MS,
                      "AI review (polish)"
                    );
                    if (reviewed && reviewed.trim().length > 0) draft = reviewed;
                  } catch (err) {
                    console.warn("Polish review pass failed, using draft:", err);
                  }
                  text = draft;
                  wasRefined = true;
                }
              }
            } catch (err) {
              console.warn(
                "AI refinement failed or timed out, keeping raw transcript:",
                err
              );
            }
          }

          // Apply keyword corrections
          if (api && text.length > 0) {
            try {
              const result = await api.applyKeywords(text);
              text = result.text;
            } catch (err) {
              console.warn("Failed to apply keywords:", err);
            }
          }

          playSound("done");
          setCurrentText(text);
          setPhase("done");
          phaseRef.current = "idle";

          // If refinement or keyword correction changed the text, patch the
          // already-saved history entry in place. Otherwise the raw entry is
          // already correct.
          if (api && text !== rawText) {
            try {
              await api.updateHistory(entryId, {
                text,
                refined: wasRefined,
                category: classifyText(text),
              });
            } catch (err) {
              console.warn("Failed to update history entry with refined text:", err);
            }
          }

          if (api) {
            // Always hand off to the main process. Main gates on the
            // autoPaste + copyToClipboard pair and decides whether to write
            // clipboard, simulate paste, both, or nothing.
            api.pasteText(text);
          }

          setTimeout(() => {
            setPhase("idle");
          }, 3000);
          break;
        }

        case "empty": {
          // Surface empty result to user instead of silently returning to idle.
          // Previously this was a silent drop, so users who sat too far from the
          // mic or spoke softly saw their dictation vanish with no explanation.
          playSound("error");
          const note = msg.message || "No speech detected. Try speaking closer to the mic or a bit louder.";
          setCurrentText(note);
          setPhase("error");
          phaseRef.current = "idle";
          setTimeout(() => {
            setCurrentText("");
            setPhase("idle");
          }, 3500);
          break;
        }

        case "error":
          playSound("error");
          setPhase("error");
          phaseRef.current = "idle";
          setCurrentText(msg.message || "Error");
          setTimeout(() => setPhase("idle"), 4000);
          break;

        case "cancelled":
          setPhase("idle");
          phaseRef.current = "idle";
          break;
      }
    },
    [settings]
  );

  return {
    phase,
    currentText,
    audioLevel: audio.audioLevel,
    backendStatus,
    wsConnected: ws.connected,
    history,
    clearHistory: () => {
      const api = getApi();
      if (api) api.clearHistory();
    },
    updateEntry: async (id: string, partial: Partial<Omit<TranscriptionEntry, "id">>) => {
      const api = getApi();
      if (api) return api.updateHistory(id, partial);
      return null;
    },
    deleteEntry: async (id: string) => {
      const api = getApi();
      if (api) return api.deleteHistory(id);
      return false;
    },
    modelProgress,
    modelStatusLabel,
    pasteStatus,
  };
}
