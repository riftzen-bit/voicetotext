/**
 * Client for the backend's two-step Gemini pipeline.
 *
 * The pipeline endpoint (/ai/refine) streams Server-Sent Events, not a
 * single JSON blob, so we can show "analyzing → adjusting → done" progress
 * in the UI while the two Gemini calls run. We use `fetch` + ReadableStream
 * (not EventSource) because EventSource only supports GET and doesn't let
 * us POST the transcript body.
 *
 * Parser is deliberately SSE-only: frames are "event: <name>\ndata: <json>\n\n".
 * Anything that doesn't parse as JSON in the data: field is yielded raw so the
 * caller can log it.
 */

const BACKEND = "http://127.0.0.1:8769";

export type AiMode = "off" | "refine" | "translate" | "summarize-translate";

export interface GeminiModelInfo {
  id: string;
  displayName: string;
  description: string;
  inputTokenLimit?: number;
  outputTokenLimit?: number;
}

export interface AiAnalysis {
  intent: string;
  entities: Array<{ type?: string; value?: string }>;
  summary_brief: string;
}

export interface AiRefineEvent {
  event: "analyzing" | "analysis" | "adjusting" | "done" | "error";
  data: unknown;
}

export interface AiRefineRequest {
  text: string;
  sourceLang: string;
  targetLang: string;
  mode: AiMode;
  template?: string | null;
  apiKey: string;
  model: string;
  signal?: AbortSignal;
  onEvent?: (evt: AiRefineEvent) => void;
}

export interface AiRefineResult {
  text: string;
  analysis: AiAnalysis | null;
}

export async function fetchGeminiModels(
  apiKey: string,
  force = false,
): Promise<GeminiModelInfo[]> {
  if (!apiKey) return [];
  const url = `${BACKEND}/ai/models?key=${encodeURIComponent(apiKey)}${force ? "&force=true" : ""}`;
  const r = await fetch(url);
  if (!r.ok) {
    const body = await r.json().catch(() => ({}));
    throw new Error(body.message || `HTTP ${r.status}`);
  }
  const data = await r.json();
  return (data.models || []) as GeminiModelInfo[];
}

async function* iterSseFrames(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<{ event: string; data: string }> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      // Frames end on a blank line. Process as many as are fully in the buffer.
      let idx: number;
      while ((idx = buf.indexOf("\n\n")) !== -1) {
        const raw = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        let eventName = "message";
        let dataLines: string[] = [];
        for (const line of raw.split("\n")) {
          if (line.startsWith("event:")) eventName = line.slice(6).trim();
          else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
        }
        yield { event: eventName, data: dataLines.join("\n") };
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export async function refineWithPipeline(req: AiRefineRequest): Promise<AiRefineResult> {
  if (req.mode === "off") {
    return { text: req.text, analysis: null };
  }

  const r = await fetch(`${BACKEND}/ai/refine`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: req.text,
      source_lang: req.sourceLang,
      target_lang: req.targetLang,
      mode: req.mode,
      template: req.template || null,
      api_key: req.apiKey,
      model: req.model,
    }),
    signal: req.signal,
  });

  if (!r.ok || !r.body) {
    const err = await r.json().catch(() => ({ message: `HTTP ${r.status}` }));
    throw new Error(err.message || `HTTP ${r.status}`);
  }

  let finalText: string | null = null;
  let analysis: AiAnalysis | null = null;

  for await (const frame of iterSseFrames(r.body)) {
    let parsed: unknown = {};
    try {
      parsed = frame.data ? JSON.parse(frame.data) : {};
    } catch {
      // Malformed event payload — keep raw string so the caller can log it
      // but don't crash the stream.
      parsed = { raw: frame.data };
    }

    const evt = { event: frame.event as AiRefineEvent["event"], data: parsed };
    req.onEvent?.(evt);

    if (frame.event === "analysis") {
      analysis = parsed as AiAnalysis;
    } else if (frame.event === "done") {
      const d = parsed as { text?: string; analysis?: AiAnalysis };
      finalText = d.text ?? null;
      if (d.analysis) analysis = d.analysis;
    } else if (frame.event === "error") {
      const d = parsed as { message?: string };
      throw new Error(d.message || "AI pipeline failed");
    }
  }

  return {
    text: finalText ?? req.text,
    analysis,
  };
}

/**
 * IETF BCP-47 codes used by Gemini / whisper language hints. Kept small and
 * curated — adding more is cheap, but these cover the 95th-percentile.
 */
export const UI_LANGUAGES: Array<{ code: string; label: string }> = [
  { code: "en", label: "English" },
  { code: "ko", label: "한국어 (Korean)" },
  { code: "ja", label: "日本語 (Japanese)" },
  { code: "zh", label: "中文 (Chinese)" },
  { code: "vi", label: "Tiếng Việt (Vietnamese)" },
  { code: "fr", label: "Français (French)" },
  { code: "de", label: "Deutsch (German)" },
  { code: "es", label: "Español (Spanish)" },
  { code: "pt", label: "Português (Portuguese)" },
  { code: "it", label: "Italiano (Italian)" },
  { code: "ru", label: "Русский (Russian)" },
  { code: "ar", label: "العربية (Arabic)" },
  { code: "hi", label: "हिन्दी (Hindi)" },
  { code: "th", label: "ไทย (Thai)" },
  { code: "id", label: "Bahasa Indonesia" },
  { code: "tr", label: "Türkçe (Turkish)" },
];
