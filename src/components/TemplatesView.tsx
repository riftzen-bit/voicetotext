import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { useSettings } from "../hooks/useSettings";
import {
  ContextTemplate,
  DEFAULT_TEMPLATES,
  TemplateMode,
} from "../lib/default-templates";
import "../styles/templates.css";

export type { ContextTemplate };

interface EditForm {
  name: string;
  description: string;
  mode: TemplateMode;
  prompt: string;
}

const EMPTY_FORM: EditForm = {
  name: "",
  description: "",
  mode: "polish",
  prompt: "",
};

export default function TemplatesView() {
  const { settings, updateSetting } = useSettings();
  const [templates, setTemplates] = useState<ContextTemplate[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm>(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [newForm, setNewForm] = useState<EditForm>(EMPTY_FORM);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | TemplateMode>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const saved = settings.contextTemplates as ContextTemplate[] | undefined;
    if (saved && saved.length > 0) {
      setTemplates(saved);
    } else {
      setTemplates(DEFAULT_TEMPLATES);
      updateSetting("contextTemplates", DEFAULT_TEMPLATES);
    }
    setActiveId((settings.activeTemplateId as string | null) ?? null);
  }, [settings.contextTemplates, settings.activeTemplateId]);

  const saveTemplates = async (next: ContextTemplate[]) => {
    setTemplates(next);
    await updateSetting("contextTemplates", next);
  };

  const toggleActive = async (id: string) => {
    const next = activeId === id ? null : id;
    setActiveId(next);
    await updateSetting("activeTemplateId", next);
  };

  const beginEdit = (t: ContextTemplate) => {
    setEditingId(t.id);
    setEditForm({
      name: t.name,
      description: t.description ?? "",
      mode: t.mode ?? "polish",
      prompt: t.prompt,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(EMPTY_FORM);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    if (!editForm.name.trim() || !editForm.prompt.trim()) return;
    const next = templates.map((t) =>
      t.id === editingId
        ? {
            ...t,
            name: editForm.name.trim(),
            description: editForm.description.trim() || undefined,
            mode: editForm.mode,
            prompt: editForm.prompt.trim(),
          }
        : t,
    );
    await saveTemplates(next);
    cancelEdit();
  };

  const createNew = async () => {
    if (!newForm.name.trim() || !newForm.prompt.trim()) return;
    const t: ContextTemplate = {
      id: `custom-${Date.now()}`,
      name: newForm.name.trim(),
      description: newForm.description.trim() || undefined,
      mode: newForm.mode,
      prompt: newForm.prompt.trim(),
      order: templates.length,
    };
    await saveTemplates([...templates, t]);
    setCreating(false);
    setNewForm(EMPTY_FORM);
  };

  const remove = async (id: string) => {
    await saveTemplates(templates.filter((t) => t.id !== id));
    if (activeId === id) {
      setActiveId(null);
      await updateSetting("activeTemplateId", null);
    }
  };

  const resetDefaults = async () => {
    // Stale saved templates (pre-redesign) have the old coder as polish mode
    // and include personas we dropped. Reset replaces the saved array with
    // the current DEFAULT_TEMPLATES and clears any active selection that
    // would point at a removed id.
    const ok = typeof window !== "undefined" && window.confirm
      ? window.confirm(
          "Reset templates to defaults?\n\nThis replaces all templates with the current defaults. Custom templates will be lost.",
        )
      : true;
    if (!ok) return;
    await saveTemplates(DEFAULT_TEMPLATES);
    const stillExists = DEFAULT_TEMPLATES.some((t) => t.id === activeId);
    if (activeId && !stillExists) {
      setActiveId(null);
      await updateSetting("activeTemplateId", null);
    }
  };

  const move = async (id: string, direction: -1 | 1) => {
    const sorted = [...templates].sort((a, b) => a.order - b.order);
    const i = sorted.findIndex((t) => t.id === id);
    const j = i + direction;
    if (i < 0 || j < 0 || j >= sorted.length) return;
    [sorted[i], sorted[j]] = [sorted[j], sorted[i]];
    sorted.forEach((t, k) => (t.order = k));
    await saveTemplates(sorted);
  };

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...templates]
      .sort((a, b) => a.order - b.order)
      .filter((t) => {
        const mode = t.mode ?? "polish";
        if (filter !== "all" && mode !== filter) return false;
        if (!q) return true;
        return (
          t.name.toLowerCase().includes(q) ||
          t.prompt.toLowerCase().includes(q) ||
          (t.description ?? "").toLowerCase().includes(q)
        );
      });
  }, [templates, search, filter]);

  const activeTemplate = templates.find((t) => t.id === activeId);

  const renderEditor = (
    form: EditForm,
    setForm: (f: EditForm) => void,
    onCancel: () => void,
    onSave: () => void,
    saveLabel: string,
  ) => (
    <div className="tpl-editor">
      <div className="tpl-editor-row">
        <label className="tpl-field">
          <span className="tpl-field-label">Name</span>
          <input
            className="tpl-input"
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Senior iOS Engineer"
          />
        </label>
        <label className="tpl-field">
          <span className="tpl-field-label">Description</span>
          <input
            className="tpl-input"
            type="text"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="One line shown on the card"
          />
        </label>
      </div>

      <div className="tpl-field">
        <span className="tpl-field-label">Mode</span>
        <div className="tpl-mode-pick" role="radiogroup">
          <button
            type="button"
            role="radio"
            aria-checked={form.mode === "polish"}
            className="tpl-mode-opt"
            data-active={form.mode === "polish"}
            onClick={() => setForm({ ...form, mode: "polish" })}
          >
            <span className="tpl-mode-name">Polish</span>
            <span className="tpl-mode-hint">
              Keep the speaker's words. Fix transcription; apply style hint.
            </span>
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={form.mode === "agent"}
            className="tpl-mode-opt"
            data-active={form.mode === "agent"}
            onClick={() => setForm({ ...form, mode: "agent" })}
          >
            <span className="tpl-mode-name">Agent</span>
            <span className="tpl-mode-hint">
              AI acts as the persona. Dictation is the user's request.
            </span>
          </button>
        </div>
      </div>

      <label className="tpl-field">
        <span className="tpl-field-label">
          {form.mode === "agent" ? "System prompt" : "Style note"}
        </span>
        <textarea
          className="tpl-textarea"
          value={form.prompt}
          onChange={(e) => setForm({ ...form, prompt: e.target.value })}
          rows={form.mode === "agent" ? 8 : 4}
          placeholder={
            form.mode === "agent"
              ? "You are a senior software engineer.\nThe user dictated their request. Read their intent and answer."
              : "Keep a conversational tone. Preserve technical jargon."
          }
        />
      </label>

      <div className="tpl-editor-actions">
        <button className="tpl-btn" onClick={onCancel}>
          Cancel
        </button>
        <button
          className="tpl-btn primary"
          onClick={onSave}
          disabled={!form.name.trim() || !form.prompt.trim()}
        >
          {saveLabel}
        </button>
      </div>
    </div>
  );

  return (
    <div className="templates-view">
      <header className="tpl-header">
        <div className="tpl-header-text">
          <h1 className="tpl-title">Templates</h1>
          <p className="tpl-subtitle">
            Pick a voice. The active template shapes what Gemini does with your
            next dictation.
          </p>
        </div>
        <div className="tpl-header-actions">
          <button
            className="tpl-btn"
            onClick={resetDefaults}
            title="Replace all templates with built-in defaults"
          >
            <RotateCcw size={15} strokeWidth={2.25} />
            Reset
          </button>
          <button
            className="tpl-btn primary"
            onClick={() => {
              setNewForm(EMPTY_FORM);
              setCreating(true);
            }}
          >
            <Plus size={16} strokeWidth={2.25} />
            New
          </button>
        </div>
      </header>

      {activeTemplate && (
        <div className="tpl-active">
          <span className="tpl-active-dot" aria-hidden />
          <span className="tpl-active-text">
            Active: <strong>{activeTemplate.name}</strong>
          </span>
          <span className="tpl-mode-tag" data-mode={activeTemplate.mode ?? "polish"}>
            {activeTemplate.mode === "agent" ? "Agent" : "Polish"}
          </span>
          <button
            className="tpl-active-clear"
            onClick={() => toggleActive(activeTemplate.id)}
          >
            Clear
          </button>
        </div>
      )}

      {activeTemplate && !settings.geminiApiKey && (
        <div className="tpl-warn" role="alert">
          <AlertTriangle size={16} strokeWidth={2} aria-hidden />
          <span className="tpl-warn-text">
            No Gemini API key. <strong>{activeTemplate.name}</strong> won't run
            until you add one in Settings.
          </span>
        </div>
      )}

      <div className="tpl-toolbar">
        <input
          className="tpl-search"
          type="text"
          placeholder="Search templates"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="tpl-filter" role="tablist">
          {(
            [
              { id: "all", label: "All" },
              { id: "polish", label: "Polish" },
              { id: "agent", label: "Agent" },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              role="tab"
              aria-selected={filter === opt.id}
              className="tpl-filter-chip"
              data-active={filter === opt.id}
              onClick={() => setFilter(opt.id)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {creating && (
        <div className="tpl-card tpl-card--edit">
          <h3 className="tpl-card-edit-title">New template</h3>
          {renderEditor(
            newForm,
            setNewForm,
            () => {
              setCreating(false);
              setNewForm(EMPTY_FORM);
            },
            createNew,
            "Create",
          )}
        </div>
      )}

      {visible.length === 0 ? (
        <div className="tpl-empty">
          <p>No templates match. Clear the search or switch filter.</p>
        </div>
      ) : (
        <ul className="tpl-list">
          {visible.map((t) => {
            const mode: TemplateMode = t.mode ?? "polish";
            const isActive = activeId === t.id;
            const isEditing = editingId === t.id;
            const isExpanded = expandedId === t.id;

            if (isEditing) {
              return (
                <li key={t.id} className="tpl-card tpl-card--edit">
                  <h3 className="tpl-card-edit-title">Edit template</h3>
                  {renderEditor(editForm, setEditForm, cancelEdit, saveEdit, "Save")}
                </li>
              );
            }

            return (
              <li
                key={t.id}
                className="tpl-card"
                data-active={isActive}
              >
                <div className="tpl-card-head">
                  <div className="tpl-card-id">
                    <h3 className="tpl-card-name">{t.name}</h3>
                    <span className="tpl-mode-tag" data-mode={mode}>
                      {mode === "agent" ? "Agent" : "Polish"}
                    </span>
                    {isActive && <span className="tpl-active-tag">Active</span>}
                  </div>
                  <div className="tpl-card-actions">
                    <button
                      className="tpl-btn"
                      data-primary={!isActive}
                      onClick={() => toggleActive(t.id)}
                    >
                      {isActive ? "Deactivate" : "Use"}
                    </button>
                    <button
                      className="tpl-icon-btn"
                      title="Move up"
                      aria-label="Move up"
                      onClick={() => move(t.id, -1)}
                    >
                      <ChevronUp size={18} strokeWidth={2} />
                    </button>
                    <button
                      className="tpl-icon-btn"
                      title="Move down"
                      aria-label="Move down"
                      onClick={() => move(t.id, 1)}
                    >
                      <ChevronDown size={18} strokeWidth={2} />
                    </button>
                    <button
                      className="tpl-icon-btn"
                      title="Edit"
                      aria-label="Edit"
                      onClick={() => beginEdit(t)}
                    >
                      <Pencil size={16} strokeWidth={2} />
                    </button>
                    <button
                      className="tpl-icon-btn danger"
                      title="Delete"
                      aria-label="Delete"
                      onClick={() => remove(t.id)}
                    >
                      <Trash2 size={16} strokeWidth={2} />
                    </button>
                  </div>
                </div>

                {t.description && (
                  <p className="tpl-card-desc">{t.description}</p>
                )}

                <button
                  className="tpl-prompt-toggle"
                  onClick={() => setExpandedId(isExpanded ? null : t.id)}
                  aria-expanded={isExpanded}
                >
                  {isExpanded ? (
                    <ChevronDown size={14} strokeWidth={2} />
                  ) : (
                    <ChevronRight size={14} strokeWidth={2} />
                  )}
                  {isExpanded ? "Hide prompt" : "Show prompt"}
                </button>

                {isExpanded && (
                  <pre className="tpl-prompt">{t.prompt}</pre>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
