import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  Copy,
  MessageSquareText,
  Zap,
} from "lucide-react";
import { getApi } from "../lib/ipc";

export interface Phrase {
  id: string;
  title: string;
  text: string;
  shortcut?: string;
  usageCount: number;
  createdAt: number;
}

interface PhrasesViewProps {
  onInsert?: (text: string) => void;
}

const DEFAULT_PHRASES: Phrase[] = [
  {
    id: "greeting-formal",
    title: "Formal Greeting",
    text: "Dear Sir/Madam,\n\nThank you for your email.",
    usageCount: 0,
    createdAt: Date.now(),
  },
  {
    id: "sign-off",
    title: "Sign Off",
    text: "Best regards,\n[Your Name]",
    usageCount: 0,
    createdAt: Date.now(),
  },
];

export default function PhrasesView({ onInsert }: PhrasesViewProps) {
  const [phrases, setPhrases] = useState<Phrase[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editText, setEditText] = useState("");
  const [editShortcut, setEditShortcut] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [recentlyCopiedId, setRecentlyCopiedId] = useState<string | null>(null);

  useEffect(() => {
    const api = getApi();
    if (!api) {
      setPhrases(DEFAULT_PHRASES);
      return;
    }

    api.getSettings().then((settings) => {
      const saved = settings.phrases as Phrase[] | undefined;
      if (saved && Array.isArray(saved) && saved.length > 0) {
        setPhrases(saved);
      } else {
        setPhrases(DEFAULT_PHRASES);
      }
    });
  }, []);

  const savePhrases = useCallback(async (newPhrases: Phrase[]) => {
    const api = getApi();
    if (api) {
      await api.setSetting("phrases", newPhrases);
    }
    setPhrases(newPhrases);
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setIsAdding(false);
    setEditTitle("");
    setEditText("");
    setEditShortcut("");
  };

  const handleAdd = () => {
    resetForm();
    setIsAdding(true);
  };

  const handleEdit = (phrase: Phrase) => {
    setEditingId(phrase.id);
    setEditTitle(phrase.title);
    setEditText(phrase.text);
    setEditShortcut(phrase.shortcut || "");
    setIsAdding(false);
  };

  const handleSave = async () => {
    if (!editTitle.trim() || !editText.trim()) return;

    const existing = editingId ? phrases.find((p) => p.id === editingId) : null;
    const newPhrase: Phrase = {
      id:
        editingId ||
        `phrase-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: editTitle.trim(),
      text: editText.trim(),
      shortcut: editShortcut.trim() || undefined,
      usageCount: existing?.usageCount ?? 0,
      createdAt: existing?.createdAt ?? Date.now(),
    };

    const newPhrases = editingId
      ? phrases.map((p) => (p.id === editingId ? newPhrase : p))
      : [newPhrase, ...phrases];

    await savePhrases(newPhrases);
    resetForm();
  };

  const handleDelete = async (id: string) => {
    const newPhrases = phrases.filter((p) => p.id !== id);
    await savePhrases(newPhrases);
    if (editingId === id) resetForm();
  };

  const handleInsert = async (phrase: Phrase) => {
    const newPhrases = phrases.map((p) =>
      p.id === phrase.id ? { ...p, usageCount: p.usageCount + 1 } : p,
    );
    await savePhrases(newPhrases);

    try {
      await navigator.clipboard.writeText(phrase.text);
      setRecentlyCopiedId(phrase.id);
      window.setTimeout(() => setRecentlyCopiedId(null), 1500);
    } catch (err) {
      console.error("Failed to copy:", err);
    }

    if (onInsert) onInsert(phrase.text);
  };

  const filteredPhrases = useMemo(() => {
    const sorted = [...phrases].sort((a, b) => b.usageCount - a.usageCount);
    if (!searchQuery.trim()) return sorted;
    const q = searchQuery.toLowerCase();
    return sorted.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.text.toLowerCase().includes(q) ||
        (p.shortcut || "").toLowerCase().includes(q),
    );
  }, [phrases, searchQuery]);

  const totalInsertions = useMemo(
    () => phrases.reduce((sum, p) => sum + p.usageCount, 0),
    [phrases],
  );

  const isEditing = Boolean(editingId || isAdding);

  return (
    <div className="phrases-view feature-view feature-view--wide">
      <header className="feature-hero">
        <span className="feature-medallion tone-teal" aria-hidden>
          <MessageSquareText />
        </span>
        <div className="feature-hero-body">
          <span className="feature-hero-eyebrow">Phrases</span>
          <h1 className="feature-hero-title">Quick phrases</h1>
          <p className="feature-hero-description">
            Save reusable snippets and paste them in one click. Greetings,
            sign-offs, canned replies, and anything you type over and over.
          </p>
          <div className="feature-hero-meta">
            <span className="feature-chip accent">
              {phrases.length} {phrases.length === 1 ? "phrase" : "phrases"}
            </span>
            <span className="feature-chip">
              {totalInsertions} total insertion{totalInsertions === 1 ? "" : "s"}
            </span>
          </div>
        </div>
        <div className="feature-hero-actions">
          <button
            className="feature-btn primary"
            onClick={handleAdd}
            disabled={isAdding}
          >
            <Plus />
            Add phrase
          </button>
        </div>
      </header>

      <div className="feature-toolbar">
        <div className="feature-search">
          <Search size={18} strokeWidth={2} className="feature-search-icon" />
          <input
            type="text"
            placeholder="Search phrases, titles, or shortcuts…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {isEditing && (
        <div className="feature-card feature-card--flat">
          <h3 className="feature-section-title">
            {editingId ? "Edit phrase" : "New phrase"}
          </h3>
          <div className="feature-form">
            <div className="feature-form-field">
              <label>Title</label>
              <input
                type="text"
                className="feature-input"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="e.g. Email greeting"
                autoFocus
              />
            </div>
            <div className="feature-form-field">
              <label>Text content</label>
              <textarea
                className="feature-textarea"
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                placeholder="Enter the phrase text…"
                rows={5}
              />
            </div>
            <div className="feature-form-field">
              <label>Shortcut (optional)</label>
              <input
                type="text"
                className="feature-input"
                value={editShortcut}
                onChange={(e) => setEditShortcut(e.target.value)}
                placeholder="e.g. /greet"
              />
            </div>
            <div className="feature-form-actions">
              <button className="feature-btn ghost" onClick={resetForm}>
                Cancel
              </button>
              <button
                className="feature-btn primary"
                onClick={handleSave}
                disabled={!editTitle.trim() || !editText.trim()}
              >
                {editingId ? "Save changes" : "Add phrase"}
              </button>
            </div>
          </div>
        </div>
      )}

      {filteredPhrases.length === 0 ? (
        <div className="feature-empty">
          <div className="feature-empty-icon">
            <MessageSquareText />
          </div>
          <p className="feature-empty-title">
            {searchQuery ? "No matches" : "No phrases yet"}
          </p>
          <p className="feature-empty-description">
            {searchQuery
              ? "Try a different search term or clear the search box."
              : "Add your first snippet to paste reusable text in one click."}
          </p>
        </div>
      ) : (
        <div className="feature-card-list">
          {filteredPhrases.map((phrase) => {
            const isActive = editingId === phrase.id;
            const justCopied = recentlyCopiedId === phrase.id;
            return (
              <div
                key={phrase.id}
                className={`feature-card interactive phrase-row ${
                  isActive ? "active" : ""
                }`}
                onClick={() => handleInsert(phrase)}
                role="button"
                tabIndex={0}
              >
                <div className="phrase-row-main">
                  <div className="phrase-row-head">
                    <h4 className="phrase-row-title">{phrase.title}</h4>
                    <div className="phrase-row-badges">
                      {phrase.shortcut && (
                        <span className="feature-chip accent phrase-shortcut-chip">
                          <Zap size={12} strokeWidth={2.5} />
                          {phrase.shortcut}
                        </span>
                      )}
                      <span className="feature-chip">
                        {phrase.usageCount}× used
                      </span>
                      {justCopied && (
                        <span className="feature-chip accent">Copied</span>
                      )}
                    </div>
                  </div>
                  <p className="phrase-row-text">{phrase.text}</p>
                </div>
                <div
                  className="phrase-row-actions"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    className="feature-icon-btn"
                    onClick={() => handleInsert(phrase)}
                    title="Copy to clipboard"
                    aria-label="Copy"
                  >
                    <Copy />
                  </button>
                  <button
                    className="feature-icon-btn"
                    onClick={() => handleEdit(phrase)}
                    title="Edit"
                    aria-label="Edit"
                  >
                    <Pencil />
                  </button>
                  <button
                    className="feature-icon-btn danger"
                    onClick={() => handleDelete(phrase.id)}
                    title="Delete"
                    aria-label="Delete"
                  >
                    <Trash2 />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
