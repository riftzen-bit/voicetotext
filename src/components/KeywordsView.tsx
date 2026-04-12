import { useState, useMemo } from "react";
import { useKeywords } from "../hooks/useKeywords";
import type { Keyword } from "../lib/ipc";

/**
 * KeywordsView - Vocabulary correction management tab.
 * Allows users to add, edit, and delete keyword replacements.
 * These are automatically applied after transcription.
 */
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

  // Filter and sort keywords
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

    // Sort by usage count (most used first), then by creation date
    result.sort((a, b) => {
      if (b.usageCount !== a.usageCount) {
        return b.usageCount - a.usageCount;
      }
      return b.createdAt - a.createdAt;
    });

    return result;
  }, [keywords, searchQuery]);

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
      } catch (err) {
        alert("Failed to import keywords. Invalid JSON format.");
      }
    };
    input.click();
  };

  if (!loaded) {
    return (
      <div className="keywords-view">
        <div className="keywords-loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="keywords-view">
      <div className="keywords-header">
        <div className="header-left">
          <h2 className="section-header">Keywords</h2>
          <span className="keywords-count">{keywords.length} entries</span>
        </div>
        <div className="header-actions">
          <button
            className="btn btn-sm"
            onClick={handleImport}
            disabled={loading}
            title="Import keywords from JSON"
          >
            Import
          </button>
          <button
            className="btn btn-sm"
            onClick={handleExport}
            disabled={loading || keywords.length === 0}
            title="Export keywords to JSON"
          >
            Export
          </button>
          <button
            className="btn btn-primary"
            onClick={handleAdd}
            disabled={isAdding || loading}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="6" y1="1" x2="6" y2="11" />
              <line x1="1" y1="6" x2="11" y2="6" />
            </svg>
            Add Keyword
          </button>
        </div>
      </div>

      <p className="section-description">
        Define words or phrases that should be automatically replaced after
        transcription. Useful for correcting frequently misheard words, names,
        or technical terms.
      </p>

      {/* Search */}
      <div className="keywords-search">
        <input
          type="text"
          className="form-input"
          placeholder="Search keywords..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Add/Edit Form */}
      {(isAdding || editingId) && (
        <div className="keyword-form">
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Trigger (heard)</label>
              <input
                type="text"
                className="form-input"
                value={formTrigger}
                onChange={(e) => setFormTrigger(e.target.value)}
                placeholder="Word or phrase to replace"
                autoFocus
              />
            </div>
            <div className="form-group">
              <label className="form-label">Correction (display)</label>
              <input
                type="text"
                className="form-input"
                value={formCorrection}
                onChange={(e) => setFormCorrection(e.target.value)}
                placeholder="Replacement text"
              />
            </div>
          </div>

          <div className="form-options">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={formWholeWord}
                onChange={(e) => setFormWholeWord(e.target.checked)}
              />
              <span>Whole word only</span>
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={formCaseSensitive}
                onChange={(e) => setFormCaseSensitive(e.target.checked)}
              />
              <span>Case sensitive</span>
            </label>
          </div>

          <div className="form-actions">
            <button className="btn" onClick={resetForm} disabled={loading}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={handleSave}
              disabled={
                loading || !formTrigger.trim() || !formCorrection.trim()
              }
            >
              {editingId ? "Save Changes" : "Add Keyword"}
            </button>
          </div>
        </div>
      )}

      {/* Keywords List */}
      <div className="keywords-list">
        {filteredKeywords.length === 0 ? (
          <div className="keywords-empty">
            {searchQuery
              ? "No keywords match your search."
              : "No keywords yet. Add your first keyword to get started!"}
          </div>
        ) : (
          <table className="keywords-table">
            <thead>
              <tr>
                <th>Trigger</th>
                <th>Correction</th>
                <th>Options</th>
                <th>Used</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredKeywords.map((kw) => (
                <tr
                  key={kw.id}
                  className={editingId === kw.id ? "editing" : ""}
                >
                  <td className="cell-trigger">
                    <span className="keyword-text">{kw.trigger}</span>
                    {kw.source === "learned" && (
                      <span className="badge-learned" title="Learned from your corrections">
                        auto
                      </span>
                    )}
                  </td>
                  <td className="cell-correction">
                    <span className="keyword-text">{kw.correction}</span>
                  </td>
                  <td className="cell-options">
                    {kw.wholeWord && (
                      <span className="option-badge" title="Whole word only">
                        WW
                      </span>
                    )}
                    {kw.caseSensitive && (
                      <span className="option-badge" title="Case sensitive">
                        CS
                      </span>
                    )}
                  </td>
                  <td className="cell-usage">{kw.usageCount}x</td>
                  <td className="cell-actions">
                    <button
                      className="icon-btn"
                      onClick={() => handleEdit(kw)}
                      title="Edit"
                      disabled={loading}
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                    <button
                      className="icon-btn danger"
                      onClick={() => handleDelete(kw.id)}
                      title="Delete"
                      disabled={loading}
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Clear All */}
      {keywords.length > 0 && (
        <div className="keywords-footer">
          {showDeleteConfirm ? (
            <div className="delete-confirm">
              <span>Delete all {keywords.length} keywords?</span>
              <button className="btn btn-sm" onClick={() => setShowDeleteConfirm(false)}>
                Cancel
              </button>
              <button
                className="btn btn-sm danger"
                onClick={handleClearAll}
                disabled={loading}
              >
                Delete All
              </button>
            </div>
          ) : (
            <button
              className="btn btn-sm danger-outline"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={loading}
            >
              Clear All Keywords
            </button>
          )}
        </div>
      )}
    </div>
  );
}
