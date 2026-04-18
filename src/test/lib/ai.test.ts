import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { refineWithPipeline, fetchGeminiModels } from "../../lib/ai";

/**
 * Shape an SSE byte stream the way the backend would so we can exercise
 * the client-side parser without spinning up the Python server.
 */
function sseStream(frames: string[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const f of frames) controller.enqueue(enc.encode(f));
      controller.close();
    },
  });
}

describe("refineWithPipeline", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("short-circuits when mode is off", async () => {
    const result = await refineWithPipeline({
      text: "hi",
      sourceLang: "en",
      targetLang: "en",
      mode: "off",
      apiKey: "k",
      model: "m",
    });
    expect(result.text).toBe("hi");
    expect(result.analysis).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("parses SSE stream, collects analysis, returns final text", async () => {
    const frames = [
      'event: analyzing\ndata: {}\n\n',
      'event: analysis\ndata: {"intent":"greet","entities":[],"summary_brief":"hi"}\n\n',
      'event: adjusting\ndata: {}\n\n',
      'event: done\ndata: {"text":"Hello.","analysis":{"intent":"greet","entities":[],"summary_brief":"hi"}}\n\n',
    ];
    const events: string[] = [];

    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      body: sseStream(frames),
    } as Response);

    const result = await refineWithPipeline({
      text: "um hi",
      sourceLang: "en",
      targetLang: "en",
      mode: "refine",
      apiKey: "K",
      model: "gemini-2.5-flash",
      onEvent: (e) => events.push(e.event),
    });

    expect(result.text).toBe("Hello.");
    expect(result.analysis?.intent).toBe("greet");
    expect(events).toEqual(["analyzing", "analysis", "adjusting", "done"]);
  });

  it("surfaces error events as thrown Error", async () => {
    const frames = [
      'event: analyzing\ndata: {}\n\n',
      'event: error\ndata: {"message":"PERMISSION_DENIED"}\n\n',
    ];
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      body: sseStream(frames),
    } as Response);

    await expect(
      refineWithPipeline({
        text: "x",
        sourceLang: "en",
        targetLang: "en",
        mode: "translate",
        apiKey: "K",
        model: "m",
      }),
    ).rejects.toThrow("PERMISSION_DENIED");
  });

  it("handles frames split across multiple chunks", async () => {
    // Split the same valid stream mid-frame to prove the buffered parser
    // reassembles correctly (real networks do this all the time).
    const frames = [
      'event: anal',
      'yzing\ndata: {}\n\nevent: done\nda',
      'ta: {"text":"OK"}\n\n',
    ];
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      body: sseStream(frames),
    } as Response);

    const result = await refineWithPipeline({
      text: "raw",
      sourceLang: "en",
      targetLang: "en",
      mode: "refine",
      apiKey: "K",
      model: "m",
    });
    expect(result.text).toBe("OK");
  });

  it("throws when backend returns HTTP error", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 502,
      body: null,
      json: async () => ({ message: "Upstream down" }),
    } as unknown as Response);

    await expect(
      refineWithPipeline({
        text: "x",
        sourceLang: "en",
        targetLang: "en",
        mode: "refine",
        apiKey: "K",
        model: "m",
      }),
    ).rejects.toThrow("Upstream down");
  });
});

describe("fetchGeminiModels", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns empty array when key missing, no fetch", async () => {
    const models = await fetchGeminiModels("");
    expect(models).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns models list on success", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: "ok",
        models: [{ id: "gemini-2.5-flash", displayName: "G25F", description: "" }],
      }),
    } as Response);

    const models = await fetchGeminiModels("KEY");
    expect(models).toHaveLength(1);
    expect(models[0].id).toBe("gemini-2.5-flash");
  });

  it("throws with backend error message on failure", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ message: "Missing api key" }),
    } as Response);

    await expect(fetchGeminiModels("bad")).rejects.toThrow("Missing api key");
  });
});
