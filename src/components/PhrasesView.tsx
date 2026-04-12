import { useState, useEffect, useCallback } from "react";
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

  // Load phrases from storage
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

  // Save phrases to storage
  const savePhrases = useCallback(async (newPhrases: Phrase[]) => {
    const api = getApi();
    if (api) {
      await api.setSetting("phrases", newPhrases);
    }
    setPhrases(newPhrases);
  }, []);

  const handleAdd = () => {
    setIsAdding(true);
    setEditTitle("");
    setEditText("");
    setEditShortcut("");
    setEditingId(null);
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

    const newPhrase: Phrase = {
      id: editingId || `phrase-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: editTitle.trim(),
      text: editText.trim(),
      shortcut: editShortcut.trim() || undefined,
      usageCount: editingId ? (phrases.find(p => p.id === editingId)?.usageCount || 0) : 0,
      createdAt: editingId ? (phrases.find(p => p.id === editingId)?.createdAt || Date.now()) : Date.now(),
    };

    let newPhrases: Phrase[];
    if (editingId) {
      newPhrases = phrases.map(p => p.id === editingId ? newPhrase : p);
    } else {
      newPhrases = [newPhrase, ...phrases];
    }

    await savePhrases(newPhrases);
    setEditingId(null);
    setIsAdding(false);
    setEditTitle("");
    setEditText("");
    setEditShortcut("");
  };

  const handleCancel = () => {
    setEditingId(null);
    setIsAdding(false);
    setEditTitle("");
    setEditText("");
    setEditShortcut("");
  };

  const handleDelete = async (id: string) => {
    const newPhrases = phrases.filter(p => p.id !== id);
    await savePhrases(newPhrases);
  };

  const handleInsert = async (phrase: Phrase) => {
    // Update usage count
    const newPhrases = phrases.map(p =>
      p.id === phrase.id ? { ...p, usageCount: p.usageCount + 1 } : p
    );
    await savePhrases(newPhrases);

    // Copy to clipboard
    try {
      await navigator.clipboard.writeText(phrase.text);
    } catch (err) {
      console.error("Failed to copy:", err);
    }

    // Call onInsert callback if provided
    if (onInsert) {
      onInsert(phrase.text);
    }
  };

  const filteredPhrases = phrases.filter(p => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return p.title.toLowerCase().includes(q) || p.text.toLowerCase().includes(q);
  });

  // Sort by usage count (most used first)
  const sortedPhrases = [...filteredPhrases].sort((a, b) => b.usageCount - a.usageCount);

  return (
    <div className="phrases-view">
      <div className="phrases-header">
        <h2 className="section-header">Quick Phrases</h2>
        <button className="btn btn-primary" onClick={handleAdd} disabled={isAdding}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="6" y1="1" x2="6" y2="11" />
            <line x1="1" y1="6" x2="11" y2="6" />
          </svg>
          Add Phrase
        </button>
      </div>

      <p className="section-description">
        Save frequently used text snippets for quick insertion. Click a phrase to copy it to clipboard.
      </p>

      {/* Search */}
      <div className="phrases-search">
        <input
          type="text"
          className="form-input"
          placeholder="Search phrases..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ width: "100%" }}
        />
      </div>

      {/* Add/Edit Form */}
      {(isAdding || editingId) && (
        <div className="phrase-form">
          <div className="form-group">
            <label className="form-label">Title</label>
            <input
              type="text"
              className="form-input"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="e.g., Email Greeting"
              style={{ width: "100%" }}
              autoFocus
            />
          </div>
          <div className="form-group">
            <label className="form-label">Text Content</label>
            <textarea
              className="form-textarea"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              placeholder="Enter the phrase text..."
              rows={4}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Shortcut (optional)</label>
            <input
              type="text"
              className="form-input"
              value={editShortcut}
              onChange={(e) => setEditShortcut(e.target.value)}
              placeholder="e.g., /greet"
              style={{ width: "200px" }}
            />
          </div>
          <div className="form-actions">
            <button className="btn" onClick={handleCancel}>Cancel</button>
            <button
              className="btn btn-primary"
              onClick={handleSave}
              disabled={!editTitle.trim() || !editText.trim()}
            >
              {editingId ? "Save Changes" : "Add Phrase"}
            </button>
          </div>
        </div>
      )}

      {/* Phrases List */}
      <div className="phrases-list">
        {sortedPhrases.length === 0 ? (
          <div className="phrases-empty">
            {searchQuery ? "No phrases match your search." : "No phrases yet. Add your first phrase!"}
          </div>
        ) : (
          sortedPhrases.map((phrase) => (
            <div
              key={phrase.id}
              className={`phrase-card ${editingId === phrase.id ? "editing" : ""}`}
              onClick={() => handleInsert(phrase)}
            >
              <div className="phrase-content">
                <div className="phrase-title">{phrase.title}</div>
                <div className="phrase-text">{phrase.text}</div>
                <div className="phrase-meta">
                  {phrase.shortcut && (
                    <span className="phrase-shortcut">{phrase.shortcut}</span>
                  )}
                  <span className="phrase-usage">Used {phrase.usageCount}x</span>
                </div>
              </div>
              <div className="phrase-actions" onClick={(e) => e.stopPropagation()}>
                <button
                  className="icon-btn"
                  onClick={() => handleEdit(phrase)}
                  title="Edit"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </button>
                <button
                  className="icon-btn danger"
                  onClick={() => handleDelete(phrase.id)}
                  title="Delete"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
