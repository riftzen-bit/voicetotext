/**
 * Hit the live local backend /ai/refine with the same model id the user
 * has selected in settings.json. Proves that the selected model string
 * is transferred through the whole chain:
 *   dropdown -> settings.json -> /ai/refine body -> Google generateContent URL
 *
 * Run: bun run scripts/probe-refine-live.ts
 */
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

function loadSettings() {
  const p = join(homedir(), "AppData", "Roaming", "voicetotext", "settings.json");
  return JSON.parse(readFileSync(p, "utf8"));
}

async function main() {
  const s = loadSettings();
  const key = s.geminiApiKey;
  const model = s.geminiModel;
  if (!key) throw new Error("no geminiApiKey in settings.json");
  if (!model) throw new Error("no geminiModel in settings.json");

  console.log("Selected model (from settings.json):", model);
  console.log("Key prefix:", key.slice(0, 7) + "...");
  console.log("Firing POST http://127.0.0.1:8769/ai/refine ...\n");

  const body = {
    text: "hi there, i just wanted to say uhh, uhm the meeting at 3 pm tomorrow with sarah and mike in conference room b will cover the q2 projections and the new tokyo launch plan",
    source_lang: "en",
    target_lang: "en",
    mode: "refine",
    template: null,
    api_key: key,
    model: model,
  };

  const r = await fetch("http://127.0.0.1:8769/ai/refine", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  console.log("HTTP status:", r.status, r.statusText);
  if (!r.ok || !r.body) {
    console.log("Body:", await r.text());
    return;
  }

  const reader = r.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let frames = 0;
  let gotDone = false;
  let finalText: string | null = null;
  let errorMsg: string | null = null;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let idx: number;
    while ((idx = buf.indexOf("\n\n")) !== -1) {
      const raw = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      let name = "message";
      const dataLines: string[] = [];
      for (const line of raw.split("\n")) {
        if (line.startsWith("event:")) name = line.slice(6).trim();
        else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
      }
      const payload = dataLines.join("\n");
      frames++;
      console.log(`[frame ${frames}] event=${name}`);
      if (payload) {
        try {
          const j = JSON.parse(payload);
          if (name === "done") {
            gotDone = true;
            finalText = j.text ?? null;
            console.log("  analysis:", JSON.stringify(j.analysis));
            console.log("  final text:", finalText);
          } else if (name === "analysis") {
            console.log("  ", JSON.stringify(j));
          } else if (name === "error") {
            errorMsg = j.message || payload;
            console.log("  ERROR:", errorMsg);
          }
        } catch {
          console.log("  raw:", payload);
        }
      }
    }
  }

  console.log("\n=== RESULT ===");
  if (gotDone && finalText) {
    console.log(`SUCCESS. Model "${model}" accepted, returned refined text (${finalText.length} chars).`);
  } else if (errorMsg) {
    console.log(`FAIL. Model "${model}" -> ${errorMsg}`);
  } else {
    console.log("UNKNOWN. No done event and no error.");
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
