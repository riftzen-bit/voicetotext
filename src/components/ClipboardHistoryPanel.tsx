import { useState, useMemo } from "react";
import { useClipboardHistory, ClipboardEntry } from "../hooks/useClipboardHistory";
import "../styles/clipboard-history.css";

function formatTimestamp(ts: number): string {
  const date = new Date(ts);
  const now = new Date();
  const diff = now.getTime() - ts;

  // Less than a minute ago
  if (diff < 60000) {
    return "Just now";
  }

  // Less than an hour ago
  if (diff < 3600000) {
    const minutes = Math.floor(diff / 60000);
    return `${minutes}m ago`;
  }

  // Less than a day ago
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    return `${hours}h ago`;
  }

  // Same year
  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function truncateText(text: string, maxLength: number = 100): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + "...";
}

interface ClipboardEntryItemProps {
  entry: ClipboardEntry;
  onCopy: (text: string) => void;
  onPaste: (text: string) => void;
  onDelete: (id: string) => void;
}

function ClipboardEntryItem({ entry, onCopy, onPaste, onDelete }: ClipboardEntryItemProps) {
  const [expanded, setExpanded] = useState(false);
  const isLong = entry.text.length > 100;

  return (
    <div className="clipboard-entry">
      <div className="clipboard-entry-header">
        <span className="clipboard-timestamp">{formatTimestamp(entry.timestamp)}</span>
        <span className={`clipboard-source ${entry.source}`}>
          {entry.source === "transcription" ? "Voice" : "Manual"}
        </span>
        {entry.template && (
          <span className="clipboard-template" title={entry.template}>
            Template
          </span>
        )}
      </div>
      <div className="clipboard-text" onClick={() => isLong && setExpanded(!expanded)}>
        {expanded ? entry.text : truncateText(entry.text)}
        {isLong && (
          <button className="expand-btn" onClick={() => setExpanded(!expanded)}>
            {expanded ? "Show less" : "Show more"}
          </button>
        )}
      </div>
      <div className="clipboard-actions">
        <button
          className="clipboard-btn"
          onClick={() => onCopy(entry.text)}
          title="Copy to clipboard"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          Copy
        </button>
        <button
          className="clipboard-btn primary"
          onClick={() => onPaste(entry.text)}
          title="Paste to active window"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
            <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
          </svg>
          Paste
        </button>
        <button
          className="clipboard-btn danger"
          onClick={() => onDelete(entry.id)}
          title="Remove from history"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
        </button>
      </div>
    </div>
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
      // Show brief feedback
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
    <div className="clipboard-history-panel">
      <div className="clipboard-header">
        <h3>Clipboard History</h3>
        {history.length > 0 && (
          <button className="clear-btn" onClick={clearHistory}>
            Clear All
          </button>
        )}
      </div>

      {history.length > 5 && (
        <div className="clipboard-search">
          <input
            type="text"
            placeholder="Search history..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
          {searchQuery && (
            <button className="clear-search" onClick={() => setSearchQuery("")}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      )}

      <div className="clipboard-list">
        {filteredHistory.length === 0 ? (
          <div className="clipboard-empty">
            {searchQuery ? (
              <p>No entries match your search.</p>
            ) : (
              <>
                <p>No clipboard history yet.</p>
                <span className="hint">Voice transcriptions will appear here.</span>
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
            />
          ))
        )}
      </div>

      {history.length > 0 && (
        <div className="clipboard-footer">
          <span className="entry-count">
            {filteredHistory.length} of {history.length} entries
          </span>
        </div>
      )}
    </div>
  );
}
