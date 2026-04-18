/**
 * Probe every generateContent-capable model on the user's Gemini key with
 * two request shapes:
 *   A) current backend shape: systemInstruction + responseMimeType
 *   B) minimal shape: single user turn, no systemInstruction, no mime type
 *
 * Prints a compatibility matrix so we know which models the voicetotext
 * pipeline actually works against.
 *
 * Run: bun run scripts/probe-gemini-models.ts
 */
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const BASE = "https://generativelanguage.googleapis.com/v1beta";

function loadKey(): string {
  const envKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (envKey) return envKey;
  const settingsPath = join(homedir(), "AppData", "Roaming", "voicetotext", "settings.json");
  const raw = readFileSync(settingsPath, "utf8");
  const data = JSON.parse(raw);
  const k = data.geminiApiKey;
  if (!k) throw new Error("No geminiApiKey in settings.json and no GEMINI_API_KEY env");
  return k;
}

type Probe = { ok: boolean; status: number; error?: string; sampleLen?: number };

async function listModels(key: string): Promise<Array<{ id: string; displayName: string }>> {
  const out: Array<{ id: string; displayName: string }> = [];
  let pageToken: string | undefined;
  for (let i = 0; i < 10; i++) {
    const p = new URLSearchParams({ key, pageSize: "50" });
    if (pageToken) p.set("pageToken", pageToken);
    const r = await fetch(`${BASE}/models?${p}`);
    if (!r.ok) throw new Error(`ListModels ${r.status}: ${await r.text()}`);
    const d = await r.json() as any;
    for (const m of d.models || []) {
      const methods: string[] = m.supportedGenerationMethods || [];
      if (!methods.includes("generateContent")) continue;
      const raw = m.name as string;
      const short = raw.includes("/") ? raw.split("/", 2)[1] : raw;
      out.push({ id: short, displayName: m.displayName || short });
    }
    pageToken = d.nextPageToken;
    if (!pageToken) break;
  }
  return out;
}

async function probe(
  key: string,
  modelId: string,
  variant: "backend" | "minimal",
): Promise<Probe> {
  const body =
    variant === "backend"
      ? {
          systemInstruction: { parts: [{ text: "You echo input. Return plain text." }] },
          contents: [{ role: "user", parts: [{ text: "Say hi." }] }],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: "text/plain",
            maxOutputTokens: 32,
          },
        }
      : {
          contents: [{ role: "user", parts: [{ text: "Say hi." }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 32 },
        };

  const url = `${BASE}/models/${modelId}:generateContent?key=${encodeURIComponent(key)}`;
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });
    if (!r.ok) {
      const txt = await r.text();
      let msg = txt;
      try {
        const j = JSON.parse(txt);
        msg = j.error?.message ?? txt;
      } catch { /* keep raw */ }
      return { ok: false, status: r.status, error: msg.slice(0, 240) };
    }
    const d = await r.json() as any;
    const text = (d.candidates?.[0]?.content?.parts || [])
      .map((p: any) => p.text || "")
      .join("");
    return { ok: text.length > 0, status: 200, sampleLen: text.length };
  } catch (e: any) {
    return { ok: false, status: -1, error: String(e?.message || e).slice(0, 240) };
  }
}

async function main() {
  const key = loadKey();
  console.log("Listing models...");
  const models = await listModels(key);
  console.log(`Found ${models.length} generateContent-capable models.\n`);

  const rows: Array<{
    id: string;
    displayName: string;
    backend: Probe;
    minimal: Probe;
  }> = [];

  let i = 0;
  for (const m of models) {
    i++;
    process.stdout.write(`[${i}/${models.length}] ${m.id} ... `);
    // Serial, not parallel — avoid burst rate limits.
    const backend = await probe(key, m.id, "backend");
    const minimal = await probe(key, m.id, "minimal");
    rows.push({ id: m.id, displayName: m.displayName, backend, minimal });
    const b = backend.ok ? "OK" : `FAIL(${backend.status})`;
    const mn = minimal.ok ? "OK" : `FAIL(${minimal.status})`;
    console.log(`backend=${b} minimal=${mn}`);
  }

  console.log("\n=== SUMMARY ===\n");
  const pad = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s.padEnd(n));
  console.log(pad("model id", 52), pad("backend", 14), pad("minimal", 14));
  console.log("-".repeat(82));
  for (const r of rows) {
    const b = r.backend.ok ? "PASS" : `FAIL ${r.backend.status}`;
    const mn = r.minimal.ok ? "PASS" : `FAIL ${r.minimal.status}`;
    console.log(pad(r.id, 52), pad(b, 14), pad(mn, 14));
  }

  console.log("\n=== FAILURES (backend shape) ===\n");
  for (const r of rows) {
    if (!r.backend.ok) {
      console.log(`- ${r.id}: ${r.backend.error || "(no error text)"}`);
    }
  }

  console.log("\n=== Models where MINIMAL works but BACKEND fails ===");
  console.log("(these could be rescued by dropping systemInstruction / responseMimeType)\n");
  for (const r of rows) {
    if (!r.backend.ok && r.minimal.ok) {
      console.log(`- ${r.id}  (backend err: ${r.backend.error})`);
    }
  }

  console.log("\n=== Models that fail BOTH shapes (dead for text pipeline) ===\n");
  for (const r of rows) {
    if (!r.backend.ok && !r.minimal.ok) {
      console.log(`- ${r.id}  (err: ${r.minimal.error})`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
