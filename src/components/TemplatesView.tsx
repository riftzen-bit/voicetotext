import { useState, useEffect } from "react";
import { useSettings } from "../hooks/useSettings";
import "../styles/templates.css";

export interface ContextTemplate {
  id: string;
  name: string;
  prompt: string;
  order: number;
}

const DEFAULT_TEMPLATES: ContextTemplate[] = [
  {
    id: "professional",
    name: "Professional",
    prompt: "Format as professional business communication. Use formal language and proper grammar.",
    order: 0,
  },
  {
    id: "casual",
    name: "Casual Chat",
    prompt: "Keep the conversational and casual tone. Allow informal expressions.",
    order: 1,
  },
  {
    id: "technical",
    name: "Technical Writing",
    prompt: "Preserve technical terms, variable names, and code references exactly. Do not 'correct' technical jargon.",
    order: 2,
  },
  {
    id: "vietnamese",
    name: "Vietnamese",
    prompt: "Text is in Vietnamese. Preserve Vietnamese diacritics and grammar. Do not translate or romanize.",
    order: 3,
  },
];

export default function TemplatesView() {
  const { settings, updateSetting } = useSettings();
  const [templates, setTemplates] = useState<ContextTemplate[]>([]);
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", prompt: "" });
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTemplate, setNewTemplate] = useState({ name: "", prompt: "" });

  // Load templates from settings
  useEffect(() => {
    const saved = settings.contextTemplates as ContextTemplate[] | undefined;
    if (saved && saved.length > 0) {
      setTemplates(saved);
    } else {
      // Initialize with defaults
      setTemplates(DEFAULT_TEMPLATES);
      updateSetting("contextTemplates", DEFAULT_TEMPLATES);
    }
    setActiveTemplateId(settings.activeTemplateId as string | null);
  }, [settings.contextTemplates, settings.activeTemplateId]);

  const saveTemplates = async (newTemplates: ContextTemplate[]) => {
    setTemplates(newTemplates);
    await updateSetting("contextTemplates", newTemplates);
  };

  const handleActivate = async (id: string) => {
    const newActiveId = activeTemplateId === id ? null : id;
    setActiveTemplateId(newActiveId);
    await updateSetting("activeTemplateId", newActiveId);
  };

  const handleEdit = (template: ContextTemplate) => {
    setEditingId(template.id);
    setEditForm({ name: template.name, prompt: template.prompt });
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    const updated = templates.map((t) =>
      t.id === editingId ? { ...t, name: editForm.name, prompt: editForm.prompt } : t
    );
    await saveTemplates(updated);
    setEditingId(null);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm({ name: "", prompt: "" });
  };

  const handleDelete = async (id: string) => {
    const updated = templates.filter((t) => t.id !== id);
    await saveTemplates(updated);
    if (activeTemplateId === id) {
      setActiveTemplateId(null);
      await updateSetting("activeTemplateId", null);
    }
  };

  const handleAddTemplate = async () => {
    if (!newTemplate.name.trim() || !newTemplate.prompt.trim()) return;

    const newId = `custom-${Date.now()}`;
    const template: ContextTemplate = {
      id: newId,
      name: newTemplate.name.trim(),
      prompt: newTemplate.prompt.trim(),
      order: templates.length,
    };

    await saveTemplates([...templates, template]);
    setNewTemplate({ name: "", prompt: "" });
    setShowAddForm(false);
  };

  const handleMoveUp = async (index: number) => {
    if (index === 0) return;
    const updated = [...templates];
    [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
    updated.forEach((t, i) => (t.order = i));
    await saveTemplates(updated);
  };

  const handleMoveDown = async (index: number) => {
    if (index === templates.length - 1) return;
    const updated = [...templates];
    [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
    updated.forEach((t, i) => (t.order = i));
    await saveTemplates(updated);
  };

  const activeTemplate = templates.find((t) => t.id === activeTemplateId);

  return (
    <div className="templates-view">
      <h2 className="section-header">Context Templates</h2>
      <p className="section-description">
        Templates provide context to improve AI text refinement. Activate one to apply it to all transcriptions.
      </p>

      {/* Active Template Display */}
      {activeTemplate && (
        <div className="active-template-banner">
          <div className="active-template-info">
            <span className="active-label">Active:</span>
            <span className="active-name">{activeTemplate.name}</span>
          </div>
          <button
            className="btn-ghost"
            onClick={() => handleActivate(activeTemplate.id)}
          >
            Deactivate
          </button>
        </div>
      )}

      {/* Templates List */}
      <div className="templates-list">
        {[...templates]
          .sort((a, b) => a.order - b.order)
          .map((template, index) => (
            <div
              key={template.id}
              className={`template-card ${activeTemplateId === template.id ? "active" : ""}`}
            >
              {editingId === template.id ? (
                <div className="template-edit-form">
                  <input
                    type="text"
                    className="form-input"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    placeholder="Template name"
                  />
                  <textarea
                    className="form-textarea"
                    value={editForm.prompt}
                    onChange={(e) => setEditForm({ ...editForm, prompt: e.target.value })}
                    placeholder="Context prompt for AI..."
                    rows={3}
                  />
                  <div className="edit-actions">
                    <button className="btn-primary btn-sm" onClick={handleSaveEdit}>
                      Save
                    </button>
                    <button className="btn-ghost btn-sm" onClick={handleCancelEdit}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="template-header">
                    <div className="template-info">
                      <span className="template-name">{template.name}</span>
                      {activeTemplateId === template.id && (
                        <span className="active-badge">Active</span>
                      )}
                    </div>
                    <div className="template-actions">
                      <button
                        className="btn-icon"
                        onClick={() => handleMoveUp(index)}
                        disabled={index === 0}
                        title="Move up"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M18 15l-6-6-6 6" />
                        </svg>
                      </button>
                      <button
                        className="btn-icon"
                        onClick={() => handleMoveDown(index)}
                        disabled={index === templates.length - 1}
                        title="Move down"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M6 9l6 6 6-6" />
                        </svg>
                      </button>
                      <button
                        className="btn-icon"
                        onClick={() => handleEdit(template)}
                        title="Edit"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      <button
                        className="btn-icon btn-danger"
                        onClick={() => handleDelete(template.id)}
                        title="Delete"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <p className="template-prompt">{template.prompt}</p>
                  <button
                    className={`btn-activate ${activeTemplateId === template.id ? "active" : ""}`}
                    onClick={() => handleActivate(template.id)}
                  >
                    {activeTemplateId === template.id ? "Deactivate" : "Activate"}
                  </button>
                </>
              )}
            </div>
          ))}
      </div>

      {/* Add New Template */}
      {showAddForm ? (
        <div className="add-template-form">
          <h4>New Template</h4>
          <input
            type="text"
            className="form-input"
            value={newTemplate.name}
            onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
            placeholder="Template name"
          />
          <textarea
            className="form-textarea"
            value={newTemplate.prompt}
            onChange={(e) => setNewTemplate({ ...newTemplate, prompt: e.target.value })}
            placeholder="Context prompt for AI refinement..."
            rows={3}
          />
          <div className="add-actions">
            <button
              className="btn-primary"
              onClick={handleAddTemplate}
              disabled={!newTemplate.name.trim() || !newTemplate.prompt.trim()}
            >
              Add Template
            </button>
            <button className="btn-ghost" onClick={() => setShowAddForm(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button className="btn-add-template" onClick={() => setShowAddForm(true)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Add Custom Template
        </button>
      )}
    </div>
  );
}
