import { useState, useEffect } from "react";
import { useSettings } from "../hooks/useSettings";
import { formatText, previewFormatting, FormattingOptions, DEFAULT_FORMATTING } from "../lib/text-formatter";
import "../styles/formatting.css";

export default function FormattingView() {
  const { settings, updateSetting } = useSettings();
  const [options, setOptions] = useState<FormattingOptions>(DEFAULT_FORMATTING);
  const [previewText, setPreviewText] = useState(
    "hello world. this is a test -- with some \"quotes\" and numbers like five or 10."
  );
  const [previewResult, setPreviewResult] = useState<{ before: string; after: string; changes: string[] }>({
    before: "",
    after: "",
    changes: [],
  });

  // Load settings
  useEffect(() => {
    const saved = settings.formatting as FormattingOptions | undefined;
    if (saved) {
      setOptions({ ...DEFAULT_FORMATTING, ...saved });
    }
  }, [settings.formatting]);

  // Update preview when options or text changes
  useEffect(() => {
    const result = previewFormatting(previewText, options);
    setPreviewResult(result);
  }, [previewText, options]);

  const updateOption = async <K extends keyof FormattingOptions>(key: K, value: FormattingOptions[K]) => {
    const newOptions = { ...options, [key]: value };
    setOptions(newOptions);
    await updateSetting("formatting", newOptions);
  };

  const resetToDefaults = async () => {
    setOptions(DEFAULT_FORMATTING);
    await updateSetting("formatting", DEFAULT_FORMATTING);
  };

  return (
    <div className="formatting-view">
      <h2 className="section-header">Smart Formatting</h2>
      <p className="section-description">
        Configure automatic text formatting applied after transcription.
      </p>

      {/* Formatting Options */}
      <div className="settings-section">
        <h3 className="subsection-header">Text Corrections</h3>

        <div className="field-row">
          <div className="field-info">
            <span className="field-label">Auto-Capitalize</span>
            <span className="field-hint">Capitalize first letter of sentences</span>
          </div>
          <div
            className={`toggle-switch ${options.autoCapitalize ? "active" : ""}`}
            onClick={() => updateOption("autoCapitalize", !options.autoCapitalize)}
          />
        </div>

        <div className="field-row">
          <div className="field-info">
            <span className="field-label">Smart Punctuation</span>
            <span className="field-hint">Fix spacing around punctuation, em-dashes</span>
          </div>
          <div
            className={`toggle-switch ${options.smartPunctuation ? "active" : ""}`}
            onClick={() => updateOption("smartPunctuation", !options.smartPunctuation)}
          />
        </div>

        <div className="field-row">
          <div className="field-info">
            <span className="field-label">Smart Quotes</span>
            <span className="field-hint">Convert straight quotes to curly quotes</span>
          </div>
          <div
            className={`toggle-switch ${options.smartQuotes ? "active" : ""}`}
            onClick={() => updateOption("smartQuotes", !options.smartQuotes)}
          />
        </div>

        <div className="field-row">
          <div className="field-info">
            <span className="field-label">Trim Whitespace</span>
            <span className="field-hint">Remove extra spaces and line breaks</span>
          </div>
          <div
            className={`toggle-switch ${options.trimWhitespace ? "active" : ""}`}
            onClick={() => updateOption("trimWhitespace", !options.trimWhitespace)}
          />
        </div>
      </div>

      <div className="settings-section">
        <h3 className="subsection-header">Number Formatting</h3>

        <div className="field-row">
          <div className="field-info">
            <span className="field-label">Number Style</span>
            <span className="field-hint">How to format spoken numbers</span>
          </div>
          <select
            className="form-select"
            value={options.numberFormatting}
            onChange={(e) => updateOption("numberFormatting", e.target.value as FormattingOptions["numberFormatting"])}
          >
            <option value="auto">Auto (context-aware)</option>
            <option value="digits">Always Digits (5, 10, 100)</option>
            <option value="words">Always Words (five, ten)</option>
          </select>
        </div>

        <div className="field-row">
          <div className="field-info">
            <span className="field-label">List Detection</span>
            <span className="field-hint">Format detected lists with bullets/numbers</span>
          </div>
          <div
            className={`toggle-switch ${options.listDetection ? "active" : ""}`}
            onClick={() => updateOption("listDetection", !options.listDetection)}
          />
        </div>
      </div>

      {/* Preview Section */}
      <div className="settings-section">
        <h3 className="subsection-header">Preview</h3>
        <p className="section-description" style={{ marginBottom: "12px" }}>
          Test your formatting settings with sample text.
        </p>

        <div className="preview-container">
          <div className="preview-input">
            <label className="preview-label">Input</label>
            <textarea
              className="preview-textarea"
              value={previewText}
              onChange={(e) => setPreviewText(e.target.value)}
              rows={3}
              placeholder="Type or paste text to preview formatting..."
            />
          </div>

          <div className="preview-arrow">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </div>

          <div className="preview-output">
            <label className="preview-label">
              Output
              {previewResult.changes.length > 0 && (
                <span className="changes-badge">
                  {previewResult.changes.length} change{previewResult.changes.length !== 1 ? "s" : ""}
                </span>
              )}
            </label>
            <div className="preview-result">{previewResult.after || previewText}</div>
          </div>
        </div>

        {previewResult.changes.length > 0 && (
          <div className="changes-list">
            <span className="changes-label">Applied:</span>
            {previewResult.changes.map((change, i) => (
              <span key={i} className="change-tag">
                {change}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Reset Button */}
      <div className="reset-section">
        <button className="btn-ghost" onClick={resetToDefaults}>
          Reset to Defaults
        </button>
      </div>
    </div>
  );
}
