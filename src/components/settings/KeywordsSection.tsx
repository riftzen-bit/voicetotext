import { useState } from "react";
import { useKeywords } from "../../hooks/useKeywords";
import { Section, Row, Toggle } from "./primitives";

export default function KeywordsSection() {
  const {
    keywords,
    loaded,
    addKeyword,
    updateKeyword,
    deleteKeyword,
    clearKeywords,
  } = useKeywords();

  const [trigger, setTrigger] = useState("");
  const [correction, setCorrection] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(true);

  if (!loaded) return null;

  const add = async () => {
    const t = trigger.trim();
    const c = correction.trim();
    if (!t || !c) return;
    await addKeyword(t, c, { caseSensitive, wholeWord });
    setTrigger("");
    setCorrection("");
  };

  return (
    <Section
      num="05"
      eyebrow="Vocabulary"
      title="Keyword corrections"
      lede="Force specific spellings. Whenever Whisper hears the trigger phrase, it will be replaced by the correction."
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <input
          type="text"
          className="text-input"
          placeholder="Heard (trigger)"
          value={trigger}
          onChange={(e) => setTrigger(e.target.value)}
        />
        <input
          type="text"
          className="text-input"
          placeholder="Write as (correction)"
          value={correction}
          onChange={(e) => setCorrection(e.target.value)}
        />
      </div>

      <Row label="Case sensitive">
        <Toggle checked={caseSensitive} onChange={setCaseSensitive} />
      </Row>
      <Row label="Whole word only">
        <Toggle checked={wholeWord} onChange={setWholeWord} />
      </Row>

      <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
        <button
          type="button"
          className="btn btn--primary"
          disabled={!trigger.trim() || !correction.trim()}
          onClick={add}
        >
          Add correction
        </button>
        {keywords.length > 0 && (
          <button
            type="button"
            className="btn btn--danger"
            onClick={() => {
              if (confirm(`Remove all ${keywords.length} corrections?`)) {
                void clearKeywords();
              }
            }}
          >
            Clear all
          </button>
        )}
      </div>

      <div className="subheading">
        Corrections · <span className="mono">{keywords.length}</span>
      </div>

      {keywords.length === 0 ? (
        <div className="list-empty">No corrections yet.</div>
      ) : (
        <div className="list">
          {keywords.map((k, i) => (
            <div key={k.id} className="list-item">
              <span className="list-item-num">
                {(i + 1).toString().padStart(2, "0")}
              </span>
              <div className="list-item-body">
                <div className="list-item-title mono" style={{ fontSize: 12 }}>
                  {k.trigger}
                  <span className="text-muted" style={{ margin: "0 8px" }}>
                    →
                  </span>
                  {k.correction}
                </div>
                <div className="list-item-sub">
                  {k.source === "learned" ? "Learned" : "Manual"} ·
                  {" "}
                  used {k.usageCount}×
                  {k.caseSensitive ? " · case" : ""}
                  {k.wholeWord ? " · whole" : ""}
                </div>
              </div>
              <div className="list-item-actions">
                <button
                  type="button"
                  className="btn"
                  title="Toggle case sensitivity"
                  onClick={() =>
                    void updateKeyword(k.id, { caseSensitive: !k.caseSensitive })
                  }
                >
                  {k.caseSensitive ? "Aa" : "aa"}
                </button>
                <button
                  type="button"
                  className="btn btn--danger"
                  onClick={() => void deleteKeyword(k.id)}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}
