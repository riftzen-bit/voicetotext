import { useState, useRef, useEffect, useMemo } from "react";
import {
  Copy,
  Pencil,
  Trash2,
  Check,
  X,
  Search,
  Sparkles,
  Inbox,
} from "lucide-react";
import type { TranscriptionEntry } from "../hooks/useTranscription";

interface HistoryViewProps {
  entries: TranscriptionEntry[];
  onClear: () => void;
  onCopy: (text: string) => void;
  onUpdate?: (id: string, partial: Partial<Omit<TranscriptionEntry, "id">>) => Promise<TranscriptionEntry | null>;
  onDelete?: (id: string) => Promise<boolean>;
}

function formatAbsoluteTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatClock(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatRelative(ts: number, now: number): string {
  const diff = Math.max(0, now - ts);
  const s = Math.floor(diff / 1000);
  if (s < 45) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} day${d === 1 ? "" : "s"} ago`;
  return formatClock(ts);
}

function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dayLabel(ts: number, now: number): string {
  const today = new Date(now);
  const d = new Date(ts);
  const sameDay =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();
  if (sameDay) return "Today";

  const yest = new Date(now - 86400000);
  const isYest =
    d.getFullYear() === yest.getFullYear() &&
    d.getMonth() === yest.getMonth() &&
    d.getDate() === yest.getDate();
  if (isYest) return "Yesterday";

  const weekAgo = now - 7 * 86400000;
  if (ts > weekAgo) {
    return d.toLocaleDateString([], { weekday: "long" });
  }

  const thisYear = d.getFullYear() === today.getFullYear();
  return d.toLocaleDateString([], {
    month: "long",
    day: "numeric",
    year: thisYear ? undefined : "numeric",
  });
}

interface HistoryItemProps {
  entry: TranscriptionEntry;
  now: number;
  onCopy: (text: string) => void;
  onUpdate?: (id: string, partial: Partial<Omit<TranscriptionEntry, "id">>) => Promise<TranscriptionEntry | null>;
  onDelete?: (id: string) => Promise<boolean>;
}

function HistoryItem({ entry, now, onCopy, onUpdate, onDelete }: HistoryItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(entry.text);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = textareaRef.current.scrollHeight + "px";
    }
  }, [isEditing]);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    onCopy(entry.text);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 1500);
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditText(entry.text);
    setIsEditing(true);
  };

  const handleSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onUpdate && editText.trim() !== entry.text) {
      await onUpdate(entry.id, { text: editText.trim() });
    }
    setIsEditing(false);
  };

  const handleCancel = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditText(entry.text);
    setIsEditing(false);
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDelete) {
      await onDelete(entry.id);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setEditText(entry.text);
      setIsEditing(false);
    } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      if (onUpdate && editText.trim() !== entry.text) {
        onUpdate(entry.id, { text: editText.trim() });
      }
      setIsEditing(false);
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditText(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = e.target.scrollHeight + "px";
  };

  return (
    <div className={`history-item ${isEditing ? "editing" : ""}`}>
      <div className="history-item-header">
        <div className="history-time" title={formatAbsoluteTime(entry.timestamp)}>
          {formatRelative(entry.timestamp, now)}
          <span className="history-clock">{formatClock(entry.timestamp)}</span>
        </div>
        <div className="history-actions">
          {isEditing ? (
            <>
              <button
                className="history-action-btn save"
                onClick={handleSave}
                title="Save (Ctrl+Enter)"
              >
                <Check size={14} strokeWidth={2.5} />
              </button>
              <button
                className="history-action-btn cancel"
                onClick={handleCancel}
                title="Cancel (Esc)"
              >
                <X size={14} strokeWidth={2} />
              </button>
            </>
          ) : (
            <>
              <button
                className={`history-action-btn copy ${copyFeedback ? "copied" : ""}`}
                onClick={handleCopy}
                title="Copy"
              >
                {copyFeedback ? <Check size={14} strokeWidth={2.5} /> : <Copy size={14} strokeWidth={2} />}
              </button>
              {onUpdate && (
                <button
                  className="history-action-btn edit"
                  onClick={handleEdit}
                  title="Edit"
                >
                  <Pencil size={14} strokeWidth={2} />
                </button>
              )}
              {onDelete && (
                <button
                  className="history-action-btn delete"
                  onClick={handleDelete}
                  title="Delete"
                >
                  <Trash2 size={14} strokeWidth={2} />
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {isEditing ? (
        <textarea
          ref={textareaRef}
          className="history-edit-textarea"
          value={editText}
          onChange={handleTextareaChange}
          onKeyDown={handleKeyDown}
          rows={1}
        />
      ) : (
        <div className="history-text">{entry.text}</div>
      )}

      <div className="history-meta">
        <span className="history-lang">{entry.language}</span>
        <span className="history-dot">·</span>
        <span className="history-duration">{entry.duration.toFixed(1)}s</span>
        {entry.refined && (
          <>
            <span className="history-dot">·</span>
            <span className="history-refined">
              <Sparkles size={11} strokeWidth={2.25} />
              Refined
            </span>
          </>
        )}
      </div>
    </div>
  );
}

export default function HistoryView({ entries, onClear, onCopy, onUpdate, onDelete }: HistoryViewProps) {
  const [query, setQuery] = useState("");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter(
      (e) =>
        e.text.toLowerCase().includes(q) ||
        (e.language || "").toLowerCase().includes(q),
    );
  }, [entries, query]);

  const groups = useMemo(() => {
    const map = new Map<string, { label: string; items: TranscriptionEntry[] }>();
    for (const e of filtered) {
      const k = dayKey(e.timestamp);
      const existing = map.get(k);
      if (existing) {
        existing.items.push(e);
      } else {
        map.set(k, { label: dayLabel(e.timestamp, now), items: [e] });
      }
    }
    return Array.from(map.values());
  }, [filtered, now]);

  if (entries.length === 0) {
    return (
      <div className="history-section">
        <div className="history-header">
          <h2 className="history-title">Transcript</h2>
        </div>
        <div className="history-empty">
          <div className="history-empty-icon">
            <Inbox size={28} strokeWidth={1.75} />
          </div>
          <p className="history-empty-title">No transcriptions yet</p>
          <p className="history-empty-sub">Record some audio to build your transcript history.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="history-section">
      <div className="history-header">
        <h2 className="history-title">
          Transcript
          <span className="history-count">{entries.length}</span>
        </h2>
        <button className="btn btn-clear" onClick={onClear}>
          Clear all
        </button>
      </div>

      <div className="history-search">
        <Search size={14} strokeWidth={2} className="history-search-icon" />
        <input
          type="search"
          placeholder="Search transcripts"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="history-search-input"
        />
        {query && (
          <button
            className="history-search-clear"
            onClick={() => setQuery("")}
            title="Clear search"
          >
            <X size={12} strokeWidth={2} />
          </button>
        )}
      </div>

      <div className="history-list">
        {filtered.length === 0 ? (
          <div className="history-empty history-empty-compact">
            <p>No matches for "{query}".</p>
          </div>
        ) : (
          groups.map((g) => (
            <section key={g.label} className="history-day">
              <h3 className="history-day-label">{g.label}</h3>
              <div className="history-day-items">
                {g.items.map((e) => (
                  <HistoryItem
                    key={e.id}
                    entry={e}
                    now={now}
                    onCopy={onCopy}
                    onUpdate={onUpdate}
                    onDelete={onDelete}
                  />
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
