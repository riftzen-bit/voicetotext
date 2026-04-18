import { useState } from "react";
import { useSettings } from "../../hooks/useSettings";
import { Section, Row, Toggle } from "./primitives";

interface Template {
  id: string;
  name: string;
  prompt: string;
  order: number;
}

export default function RefinementSection() {
  const { settings, loaded, updateSetting } = useSettings();
  const [showKey, setShowKey] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftPrompt, setDraftPrompt] = useState("");

  if (!loaded) return null;

  const templates = (settings.contextTemplates as Template[] | undefined) ?? [];
  const activeId = (settings.activeTemplateId as string | null | undefined) ?? null;

  const saveTemplate = () => {
    const name = draftName.trim();
    const prompt = draftPrompt.trim();
    if (!name || !prompt) return;
    const next: Template = {
      id: `tpl-${Date.now()}`,
      name,
      prompt,
      order: templates.length,
    };
    updateSetting("contextTemplates", [...templates, next]);
    setDraftName("");
    setDraftPrompt("");
  };

  const removeTemplate = (id: string) => {
    updateSetting("contextTemplates", templates.filter((t) => t.id !== id));
    if (activeId === id) updateSetting("activeTemplateId", null);
  };

  return (
    <Section
      num="03"
      eyebrow="Refinement"
      title="AI clean-up"
      lede="Optionally route each transcript through Gemini for light punctuation and grammar polish. Your audio never leaves your machine; only the raw text is sent."
    >
      <Row label="Enable Gemini refinement">
        <Toggle
          checked={settings.useGemini}
          onChange={(v) => updateSetting("useGemini", v)}
        />
      </Row>

      {settings.useGemini && (
        <>
          <Row label="API key" hint="Stored locally in your settings file." stacked>
            <div style={{ display: "flex", gap: 8, width: "100%" }}>
              <input
                type={showKey ? "text" : "password"}
                className="text-input text-input--mono"
                style={{ flex: 1, minWidth: 0 }}
                value={settings.geminiApiKey}
                onChange={(e) => updateSetting("geminiApiKey", e.target.value)}
                placeholder="AIza…"
              />
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => setShowKey((v) => !v)}
              >
                {showKey ? "Hide" : "Show"}
              </button>
            </div>
          </Row>

          <Row label="Model">
            <select
              className="select-input"
              value={settings.geminiModel}
              onChange={(e) => updateSetting("geminiModel", e.target.value)}
            >
              <option value="gemini-2.5-flash">gemini-2.5-flash</option>
              <option value="gemini-2.5-pro">gemini-2.5-pro</option>
              <option value="gemini-2.0-flash">gemini-2.0-flash</option>
            </select>
          </Row>

          <Row label="Code mode" hint="Bypass refinement when dictating code or commands.">
            <Toggle
              checked={!!settings.codeMode}
              onChange={(v) => updateSetting("codeMode", v)}
            />
          </Row>

          <div className="subheading">Context templates</div>

          {templates.length === 0 ? (
            <div className="list-empty">No templates yet.</div>
          ) : (
            <div className="list">
              {templates.map((t, i) => {
                const isActive = activeId === t.id;
                return (
                  <div key={t.id} className="list-item">
                    <span className="list-item-num">
                      {(i + 1).toString().padStart(2, "0")}
                    </span>
                    <div className="list-item-body">
                      <div className="list-item-title">
                        {t.name}
                        {isActive ? (
                          <span
                            className="text-accent mono"
                            style={{ fontSize: 10, marginLeft: 8, letterSpacing: "0.2em" }}
                          >
                            ACTIVE
                          </span>
                        ) : null}
                      </div>
                      <div className="list-item-sub">{t.prompt}</div>
                    </div>
                    <div className="list-item-actions">
                      <button
                        type="button"
                        className={`btn${isActive ? " btn--primary" : ""}`}
                        onClick={() =>
                          updateSetting("activeTemplateId", isActive ? null : t.id)
                        }
                      >
                        {isActive ? "Active" : "Use"}
                      </button>
                      <button
                        type="button"
                        className="btn btn--danger"
                        onClick={() => removeTemplate(t.id)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 12 }}>
            <input
              type="text"
              className="text-input"
              placeholder="Template name"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              style={{ width: "100%" }}
            />
            <textarea
              className="textarea-input"
              placeholder="Instruction to give the model, e.g. 'Polish as casual email prose.'"
              value={draftPrompt}
              onChange={(e) => setDraftPrompt(e.target.value)}
            />
            <div>
              <button
                type="button"
                className="btn btn--primary"
                onClick={saveTemplate}
                disabled={!draftName.trim() || !draftPrompt.trim()}
              >
                Add template
              </button>
            </div>
          </div>
        </>
      )}
    </Section>
  );
}
