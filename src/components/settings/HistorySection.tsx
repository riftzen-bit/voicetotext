import { useEffect, useState } from "react";
import { getApi } from "../../lib/ipc";
import { Section } from "./primitives";

interface HistoryEntry {
  id: string;
  text: string;
  language?: string;
  confidence?: number;
  duration?: number;
  timestamp: number;
  refined?: boolean;
  category?: string;
}

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function formatDuration(seconds: number | undefined): string {
  if (!seconds) return "";
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
}

export default function HistorySection() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const api = getApi();
    if (!api) {
      setLoaded(true);
      return;
    }
    api.getHistory().then((h) => {
      setHistory(h || []);
      setLoaded(true);
    });
    const unsub = api.onHistoryChanged((h) => {
      setHistory(h || []);
    });
    return () => unsub();
  }, []);

  const api = getApi();

  const totalSeconds = history.reduce((sum, h) => sum + (h.duration || 0), 0);
  const totalWords = history.reduce(
    (sum, h) => sum + (h.text ? h.text.trim().split(/\s+/).length : 0),
    0
  );

  const copyAll = () => {
    const text = history.map((h) => h.text).join("\n\n");
    navigator.clipboard?.writeText(text);
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(history, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `voicetotext-history-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Section
      num="06"
      eyebrow="History"
      title="Recent transcriptions"
      lede="Everything you've dictated, stored only on this machine."
    >
      {loaded && history.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24, paddingBottom: 24, borderBottom: "1px solid var(--border-subtle)" }}>
          <div>
            <div className="mono text-muted" style={{ fontSize: 10, letterSpacing: "0.24em", textTransform: "uppercase" }}>
              Entries
            </div>
            <div style={{ fontSize: 24, fontWeight: 300, letterSpacing: "-0.02em", marginTop: 4 }}>
              {history.length}
            </div>
          </div>
          <div>
            <div className="mono text-muted" style={{ fontSize: 10, letterSpacing: "0.24em", textTransform: "uppercase" }}>
              Words
            </div>
            <div style={{ fontSize: 24, fontWeight: 300, letterSpacing: "-0.02em", marginTop: 4 }}>
              {totalWords.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="mono text-muted" style={{ fontSize: 10, letterSpacing: "0.24em", textTransform: "uppercase" }}>
              Time
            </div>
            <div style={{ fontSize: 24, fontWeight: 300, letterSpacing: "-0.02em", marginTop: 4 }}>
              {formatDuration(totalSeconds) || "0s"}
            </div>
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <button
          type="button"
          className="btn"
          disabled={history.length === 0}
          onClick={copyAll}
        >
          Copy all
        </button>
        <button
          type="button"
          className="btn"
          disabled={history.length === 0}
          onClick={exportJson}
        >
          Export JSON
        </button>
        <button
          type="button"
          className="btn btn--danger"
          disabled={history.length === 0}
          onClick={() => {
            if (confirm("Delete all transcripts?")) {
              api?.clearHistory();
            }
          }}
        >
          Clear history
        </button>
      </div>

      <div className="subheading">Entries</div>

      {loaded && history.length === 0 ? (
        <div className="list-empty">No recordings yet.</div>
      ) : (
        <div className="list">
          {history
            .slice()
            .reverse()
            .slice(0, 100)
            .map((h, i) => (
              <div key={h.id} className="list-item">
                <span className="list-item-num">
                  {(i + 1).toString().padStart(2, "0")}
                </span>
                <div className="list-item-body">
                  <div
                    className="list-item-title"
                    style={{
                      fontWeight: 400,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {h.text}
                  </div>
                  <div className="list-item-sub">
                    {formatTimestamp(h.timestamp)}
                    {h.duration ? ` · ${formatDuration(h.duration)}` : ""}
                    {h.language && h.language !== "unknown" ? ` · ${h.language}` : ""}
                    {h.refined ? " · refined" : ""}
                  </div>
                </div>
                <div className="list-item-actions">
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={() => navigator.clipboard?.writeText(h.text)}
                  >
                    Copy
                  </button>
                  <button
                    type="button"
                    className="btn btn--danger"
                    onClick={() => api?.deleteHistory(h.id)}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
        </div>
      )}
    </Section>
  );
}
