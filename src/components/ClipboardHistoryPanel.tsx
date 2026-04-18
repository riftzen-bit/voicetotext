import { useState, useMemo } from "react";
import {
  Copy,
  Check,
  ArrowRight,
  Trash2,
  Search,
  X,
  Inbox,
} from "lucide-react";
import { useClipboardHistory, ClipboardEntry } from "../hooks/useClipboardHistory";
import "../styles/clipboard-history.css";

function formatTimestamp(ts: number): string {
  const date = new Date(ts);
  const now = new Date();
  const diff = now.getTime() - ts;

  if (diff < 60000) return "Just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;

  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function truncateText(text: string, maxLength: number = 120): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + "…";
}

interface ClipboardEntryItemProps {
  entry: ClipboardEntry;
  onCopy: (text: string) => void;
  onPaste: (text: string) => void;
  onDelete: (id: string) => void;
  justCopied: boolean;
}

function ClipboardEntryItem({ entry, onCopy, onPaste, onDelete, justCopied }: ClipboardEntryItemProps) {
  const [expanded, setExpanded] = useState(false);
  const isLong = entry.text.length > 120;

  return (
    <article className="clipboard-entry">
      <header className="clipboard-entry-header">
        <span className="clipboard-timestamp">{formatTimestamp(entry.timestamp)}</span>
        <span className={`clipboard-source ${entry.source}`}>
          {entry.source === "transcription" ? "Voice" : "Manual"}
        </span>
        {entry.template && (
          <span className="clipboard-template" title={entry.template}>
            {entry.template}
          </span>
        )}
        <div className="clipboard-actions">
          <button
            type="button"
            className={`clipboard-btn icon ${justCopied ? "ok" : ""}`}
            onClick={() => onCopy(entry.text)}
            title="Copy to clipboard"
            aria-label="Copy"
          >
            {justCopied ? <Check size={14} strokeWidth={2.5} /> : <Copy size={14} strokeWidth={2} />}
          </button>
          <button
            type="button"
            className="clipboard-btn icon primary"
            onClick={() => onPaste(entry.text)}
            title="Paste to focused window"
            aria-label="Paste"
          >
            <ArrowRight size={14} strokeWidth={2} />
          </button>
          <button
            type="button"
            className="clipboard-btn icon danger"
            onClick={() => onDelete(entry.id)}
            title="Remove from history"
            aria-label="Delete"
          >
            <Trash2 size={14} strokeWidth={2} />
          </button>
        </div>
      </header>

      <div className="clipboard-text">
        {expanded || !isLong ? entry.text : truncateText(entry.text)}
        {isLong && (
          <button
            type="button"
            className="expand-btn"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? "Show less" : "Show more"}
          </button>
        )}
      </div>
    </article>
  );
}

export default function ClipboardHistoryPanel() {
  const { history, clearHistory, copyToClipboard, copyAndPaste, removeEntry, searchHistory } =
    useClipboardHistory();
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filteredHistory = useMemo(() => {
    return searchHistory(searchQuery);
  }, [searchHistory, searchQuery]);

  const handleCopy = async (text: string) => {
    const success = await copyToClipboard(text);
    if (success) {
      const entry = history.find((e) => e.text === text);
      if (entry) {
        setCopiedId(entry.id);
        setTimeout(() => setCopiedId(null), 1500);
      }
    }
  };

  const handlePaste = (text: string) => {
    copyAndPaste(text);
  };

  return (
    <section className="clipboard-history-panel">
      <header className="clipboard-header">
        <div className="clipboard-header-titles">
          <h3 className="clipboard-title">
            Clipboard History
            {history.length > 0 && (
              <span className="clipboard-count">{history.length}</span>
            )}
          </h3>
          <p className="clipboard-sub">
            Recent copies and transcripts. Paste straight back into the focused window.
          </p>
        </div>
        {history.length > 0 && (
          <button type="button" className="clipboard-clear-btn" onClick={clearHistory}>
            <Trash2 size={13} strokeWidth={2} />
            Clear all
          </button>
        )}
      </header>

      {history.length > 5 && (
        <div className="clipboard-search">
          <Search size={14} strokeWidth={2} className="clipboard-search-icon" />
          <input
            type="search"
            placeholder="Search clipboard"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
          {searchQuery && (
            <button
              type="button"
              className="clear-search"
              onClick={() => setSearchQuery("")}
              aria-label="Clear search"
            >
              <X size={12} strokeWidth={2} />
            </button>
          )}
        </div>
      )}

      <div className="clipboard-list">
        {filteredHistory.length === 0 ? (
          <div className="clipboard-empty">
            <div className="clipboard-empty-icon" aria-hidden>
              <Inbox size={24} strokeWidth={1.75} />
            </div>
            {searchQuery ? (
              <>
                <p className="clipboard-empty-title">No matches</p>
                <span className="hint">Try a different search or clear the box.</span>
              </>
            ) : (
              <>
                <p className="clipboard-empty-title">Nothing on the clipboard yet</p>
                <span className="hint">Voice transcriptions and copies will appear here.</span>
              </>
            )}
          </div>
        ) : (
          filteredHistory.map((entry) => (
            <ClipboardEntryItem
              key={entry.id}
              entry={entry}
              onCopy={handleCopy}
              onPaste={handlePaste}
              onDelete={removeEntry}
              justCopied={copiedId === entry.id}
            />
          ))
        )}
      </div>

      {history.length > 0 && (
        <div className="clipboard-footer">
          <span className="entry-count">
            Showing {filteredHistory.length} of {history.length}
          </span>
        </div>
      )}
    </section>
  );
}
