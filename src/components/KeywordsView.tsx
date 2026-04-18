import { useState, useMemo } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  Upload,
  Download,
  Tags,
  ArrowRight,
} from "lucide-react";
import { useKeywords } from "../hooks/useKeywords";
import type { Keyword } from "../lib/ipc";

export default function KeywordsView() {
  const {
    keywords,
    loaded,
    loading,
    addKeyword,
    updateKeyword,
    deleteKeyword,
    clearKeywords,
    importKeywords,
    exportKeywords,
  } = useKeywords();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [formTrigger, setFormTrigger] = useState("");
  const [formCorrection, setFormCorrection] = useState("");
  const [formCaseSensitive, setFormCaseSensitive] = useState(false);
  const [formWholeWord, setFormWholeWord] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const filteredKeywords = useMemo(() => {
    let result = [...keywords];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (k) =>
          k.trigger.toLowerCase().includes(q) ||
          k.correction.toLowerCase().includes(q)
      );
    }

    result.sort((a, b) => {
      if (b.usageCount !== a.usageCount) {
        return b.usageCount - a.usageCount;
      }
      return b.createdAt - a.createdAt;
    });

    return result;
  }, [keywords, searchQuery]);

  const totalUsage = useMemo(
    () => keywords.reduce((sum, k) => sum + k.usageCount, 0),
    [keywords]
  );

  const resetForm = () => {
    setFormTrigger("");
    setFormCorrection("");
    setFormCaseSensitive(false);
    setFormWholeWord(true);
    setEditingId(null);
    setIsAdding(false);
  };

  const handleAdd = () => {
    resetForm();
    setIsAdding(true);
  };

  const handleEdit = (kw: Keyword) => {
    setEditingId(kw.id);
    setFormTrigger(kw.trigger);
    setFormCorrection(kw.correction);
    setFormCaseSensitive(kw.caseSensitive);
    setFormWholeWord(kw.wholeWord);
    setIsAdding(false);
  };

  const handleSave = async () => {
    if (!formTrigger.trim() || !formCorrection.trim()) return;

    if (editingId) {
      await updateKeyword(editingId, {
        trigger: formTrigger,
        correction: formCorrection,
        caseSensitive: formCaseSensitive,
        wholeWord: formWholeWord,
      });
    } else {
      await addKeyword(formTrigger, formCorrection, {
        caseSensitive: formCaseSensitive,
        wholeWord: formWholeWord,
        source: "manual",
      });
    }

    resetForm();
  };

  const handleDelete = async (id: string) => {
    await deleteKeyword(id);
    if (editingId === id) {
      resetForm();
    }
  };

  const handleClearAll = async () => {
    await clearKeywords();
    setShowDeleteConfirm(false);
  };

  const handleExport = async () => {
    const data = await exportKeywords();
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `keywords-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (Array.isArray(data)) {
          const count = await importKeywords(data);
          alert(`Imported ${count} keywords.`);
        }
      } catch {
        alert("Failed to import keywords. Invalid JSON format.");
      }
    };
    input.click();
  };

  if (!loaded) {
    return (
      <div className="feature-view">
        <div className="feature-empty">
          <div className="feature-empty-icon"><Tags /></div>
          <p className="feature-empty-title">Loading keywords…</p>
        </div>
      </div>
    );
  }

  const isEditing = Boolean(editingId || isAdding);

  return (
    <div className="feature-view feature-view--wide">
      <header className="feature-hero">
        <span className="feature-medallion tone-brown" aria-hidden>
          <Tags />
        </span>
        <div className="feature-hero-body">
          <span className="feature-hero-eyebrow">Keywords</span>
          <h1 className="feature-hero-title">Keyword corrections</h1>
          <p className="feature-hero-description">
            Replace words or phrases automatically after every transcription.
            Fixes misheard names, technical jargon, and acronyms the speech
            model keeps getting wrong.
          </p>
          <div className="feature-hero-meta">
            <span className="feature-chip accent">
              {keywords.length} {keywords.length === 1 ? "entry" : "entries"}
            </span>
            <span className="feature-chip">
              {totalUsage} {totalUsage === 1 ? "correction" : "corrections"} applied
            </span>
          </div>
        </div>
        <div className="feature-hero-actions">
          <button
            className="feature-btn"
            onClick={handleImport}
            disabled={loading}
            title="Import keywords from JSON"
          >
            <Upload />
            Import
          </button>
          <button
            className="feature-btn"
            onClick={handleExport}
            disabled={loading || keywords.length === 0}
            title="Export keywords to JSON"
          >
            <Download />
            Export
          </button>
          <button
            className="feature-btn primary"
            onClick={handleAdd}
            disabled={isAdding || loading}
          >
            <Plus />
            Add keyword
          </button>
        </div>
      </header>

      <div className="feature-toolbar">
        <div className="feature-search">
          <Search size={18} strokeWidth={2} className="feature-search-icon" />
          <input
            type="text"
            placeholder="Search triggers or corrections…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {isEditing && (
        <div className="feature-card feature-card--flat">
          <h3 className="feature-section-title">
            {editingId ? "Edit keyword" : "New keyword"}
          </h3>
          <div className="feature-form">
            <div className="feature-form-grid">
              <div className="feature-form-field">
                <label>Trigger (what the model heard)</label>
                <input
                  type="text"
                  className="feature-input"
                  value={formTrigger}
                  onChange={(e) => setFormTrigger(e.target.value)}
                  placeholder="e.g. get hub"
                  autoFocus
                />
              </div>
              <div className="feature-form-field">
                <label>Correction (what you meant)</label>
                <input
                  type="text"
                  className="feature-input"
                  value={formCorrection}
                  onChange={(e) => setFormCorrection(e.target.value)}
                  placeholder="e.g. GitHub"
                />
              </div>
            </div>

            <div className="feature-form-options">
              <label className="feature-checkbox">
                <input
                  type="checkbox"
                  checked={formWholeWord}
                  onChange={(e) => setFormWholeWord(e.target.checked)}
                />
                <span>Whole word only</span>
              </label>
              <label className="feature-checkbox">
                <input
                  type="checkbox"
                  checked={formCaseSensitive}
                  onChange={(e) => setFormCaseSensitive(e.target.checked)}
                />
                <span>Case sensitive</span>
              </label>
            </div>

            <div className="feature-form-actions">
              <button className="feature-btn ghost" onClick={resetForm} disabled={loading}>
                Cancel
              </button>
              <button
                className="feature-btn primary"
                onClick={handleSave}
                disabled={
                  loading || !formTrigger.trim() || !formCorrection.trim()
                }
              >
                {editingId ? "Save changes" : "Add keyword"}
              </button>
            </div>
          </div>
        </div>
      )}

      {filteredKeywords.length === 0 ? (
        <div className="feature-empty">
          <div className="feature-empty-icon"><Tags /></div>
          <p className="feature-empty-title">
            {searchQuery ? "No matches" : "No keywords yet"}
          </p>
          <p className="feature-empty-description">
            {searchQuery
              ? "Try a different search term or clear the search box."
              : "Add your first replacement rule to start fixing misheard words automatically."}
          </p>
        </div>
      ) : (
        <div className="feature-card-list">
          {filteredKeywords.map((kw) => (
            <div
              key={kw.id}
              className={`feature-card ${editingId === kw.id ? "active" : ""}`}
            >
              <div className="feature-kw-row">
                <span className="feature-kw-token">{kw.trigger}</span>
                <span className="feature-kw-arrow" aria-hidden>
                  <ArrowRight />
                </span>
                <span className="feature-kw-token">{kw.correction}</span>
                <span className="feature-kw-flags">
                  {kw.wholeWord && (
                    <span className="feature-flag" title="Whole word only">WW</span>
                  )}
                  {kw.caseSensitive && (
                    <span className="feature-flag" title="Case sensitive">CS</span>
                  )}
                  {kw.source === "learned" && (
                    <span className="feature-flag auto" title="Learned from your corrections">
                      auto
                    </span>
                  )}
                  <span className="feature-kw-count" title="Times applied">
                    {kw.usageCount}×
                  </span>
                </span>
                <span className="feature-kw-actions">
                  <button
                    className="feature-icon-btn"
                    onClick={() => handleEdit(kw)}
                    title="Edit"
                    aria-label="Edit"
                    disabled={loading}
                  >
                    <Pencil />
                  </button>
                  <button
                    className="feature-icon-btn danger"
                    onClick={() => handleDelete(kw.id)}
                    title="Delete"
                    aria-label="Delete"
                    disabled={loading}
                  >
                    <Trash2 />
                  </button>
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {keywords.length > 0 && (
        <div className="feature-toolbar" style={{ justifyContent: "flex-end" }}>
          {showDeleteConfirm ? (
            <div className="feature-confirm">
              <span>Delete all {keywords.length} keywords?</span>
              <button
                className="feature-btn ghost"
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </button>
              <button
                className="feature-btn danger"
                onClick={handleClearAll}
                disabled={loading}
              >
                Delete all
              </button>
            </div>
          ) : (
            <button
              className="feature-btn danger"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={loading}
            >
              <Trash2 />
              Clear all keywords
            </button>
          )}
        </div>
      )}
    </div>
  );
}
