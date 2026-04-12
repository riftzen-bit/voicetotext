import { useState, useRef, useEffect } from "react";
import type { TranscriptionEntry } from "../hooks/useTranscription";

interface HistoryViewProps {
  entries: TranscriptionEntry[];
  onClear: () => void;
  onCopy: (text: string) => void;
  onUpdate?: (id: string, partial: Partial<Omit<TranscriptionEntry, "id">>) => Promise<TranscriptionEntry | null>;
  onDelete?: (id: string) => Promise<boolean>;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

interface HistoryItemProps {
  entry: TranscriptionEntry;
  onCopy: (text: string) => void;
  onUpdate?: (id: string, partial: Partial<Omit<TranscriptionEntry, "id">>) => Promise<TranscriptionEntry | null>;
  onDelete?: (id: string) => Promise<boolean>;
}

function HistoryItem({ entry, onCopy, onUpdate, onDelete }: HistoryItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(entry.text);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
      // Auto-resize textarea
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
    // Auto-resize
    e.target.style.height = "auto";
    e.target.style.height = e.target.scrollHeight + "px";
  };

  return (
    <div className={`history-item ${isEditing ? "editing" : ""}`}>
      <div className="history-item-header">
        <div className="history-time">{formatTime(entry.timestamp)}</div>
        <div className="history-actions">
          {isEditing ? (
            <>
              <button
                className="history-action-btn save"
                onClick={handleSave}
                title="Save (Ctrl+Enter)"
              >
                <CheckIcon />
              </button>
              <button
                className="history-action-btn cancel"
                onClick={handleCancel}
                title="Cancel (Esc)"
              >
                <XIcon />
              </button>
            </>
          ) : (
            <>
              <button
                className={`history-action-btn copy ${copyFeedback ? "copied" : ""}`}
                onClick={handleCopy}
                title="Copy"
              >
                {copyFeedback ? <CheckIcon /> : <CopyIcon />}
              </button>
              {onUpdate && (
                <button
                  className="history-action-btn edit"
                  onClick={handleEdit}
                  title="Edit"
                >
                  <EditIcon />
                </button>
              )}
              {onDelete && (
                <button
                  className="history-action-btn delete"
                  onClick={handleDelete}
                  title="Delete"
                >
                  <DeleteIcon />
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
        {entry.refined && (
          <span className="history-refined">
            <CheckIcon />
            Refined
          </span>
        )}
        <span>{entry.duration.toFixed(1)}s</span>
      </div>
    </div>
  );
}

export default function HistoryView({ entries, onClear, onCopy, onUpdate, onDelete }: HistoryViewProps) {
  if (entries.length === 0) {
    return (
      <div className="history-section">
        <div className="history-header">
          <h2 className="history-title">Transcript</h2>
        </div>
        <div className="history-empty">No transcriptions yet.</div>
      </div>
    );
  }

  return (
    <div className="history-section">
      <div className="history-header">
        <h2 className="history-title">
          Transcript
          <span className="history-count">[{entries.length}]</span>
        </h2>
        <button className="btn btn-clear" onClick={onClear}>
          Clear All
        </button>
      </div>

      <div className="history-list">
        {entries.map((e) => (
          <HistoryItem
            key={e.id}
            entry={e}
            onCopy={onCopy}
            onUpdate={onUpdate}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  );
}
