import { useState, useEffect } from "react";
import {
  ArrowRight,
  RotateCcw,
  Wand2,
  Hash,
  Eye,
} from "lucide-react";
import { useSettings } from "../hooks/useSettings";
import {
  previewFormatting,
  FormattingOptions,
  DEFAULT_FORMATTING,
} from "../lib/text-formatter";
import "../styles/formatting.css";

export default function FormattingView() {
  const { settings, updateSetting } = useSettings();
  const [options, setOptions] = useState<FormattingOptions>(DEFAULT_FORMATTING);
  const [previewText, setPreviewText] = useState(
    'hello world. this is a test -- with some "quotes" and numbers like five or 10.',
  );
  const [previewResult, setPreviewResult] = useState<{
    before: string;
    after: string;
    changes: string[];
  }>({ before: "", after: "", changes: [] });

  useEffect(() => {
    const saved = settings.formatting as FormattingOptions | undefined;
    if (saved) {
      setOptions({ ...DEFAULT_FORMATTING, ...saved });
    }
  }, [settings.formatting]);

  useEffect(() => {
    const result = previewFormatting(previewText, options);
    setPreviewResult(result);
  }, [previewText, options]);

  const updateOption = async <K extends keyof FormattingOptions>(
    key: K,
    value: FormattingOptions[K],
  ) => {
    const newOptions = { ...options, [key]: value };
    setOptions(newOptions);
    await updateSetting("formatting", newOptions);
  };

  const resetToDefaults = async () => {
    setOptions(DEFAULT_FORMATTING);
    await updateSetting("formatting", DEFAULT_FORMATTING);
  };

  const activeCount =
    Number(options.autoCapitalize) +
    Number(options.smartPunctuation) +
    Number(options.smartQuotes) +
    Number(options.trimWhitespace) +
    Number(options.listDetection);

  return (
    <div className="formatting-view feature-view feature-view--wide">
      <header className="feature-hero">
        <span className="feature-medallion tone-pink" aria-hidden>
          <Wand2 />
        </span>
        <div className="feature-hero-body">
          <span className="feature-hero-eyebrow">Formatting</span>
          <h1 className="feature-hero-title">Smart formatting</h1>
          <p className="feature-hero-description">
            Polish applied to every transcript before it reaches the clipboard.
            Tidy punctuation, straighten quotes, standardise numbers, and
            detect lists.
          </p>
          <div className="feature-hero-meta">
            <span className="feature-chip accent">{activeCount} of 5 rules on</span>
            <span className="feature-chip">Numbers: {options.numberFormatting}</span>
          </div>
        </div>
        <div className="feature-hero-actions">
          <button className="feature-btn ghost" onClick={resetToDefaults}>
            <RotateCcw />
            Reset defaults
          </button>
        </div>
      </header>

      <section className="feature-card feature-card--flat">
        <h3 className="feature-section-title">
          <Wand2 size={18} strokeWidth={2} /> Text corrections
        </h3>

        <div className="feature-field-row">
          <div className="feature-field-info">
            <span className="feature-field-label">Auto-capitalise</span>
            <span className="feature-field-hint">
              Capitalise the first letter of every sentence
            </span>
          </div>
          <div
            role="switch"
            aria-checked={options.autoCapitalize}
            className={`toggle-switch ${options.autoCapitalize ? "active" : ""}`}
            onClick={() => updateOption("autoCapitalize", !options.autoCapitalize)}
          />
        </div>

        <div className="feature-field-row">
          <div className="feature-field-info">
            <span className="feature-field-label">Smart punctuation</span>
            <span className="feature-field-hint">
              Fix spacing around punctuation and em-dashes
            </span>
          </div>
          <div
            role="switch"
            aria-checked={options.smartPunctuation}
            className={`toggle-switch ${options.smartPunctuation ? "active" : ""}`}
            onClick={() => updateOption("smartPunctuation", !options.smartPunctuation)}
          />
        </div>

        <div className="feature-field-row">
          <div className="feature-field-info">
            <span className="feature-field-label">Smart quotes</span>
            <span className="feature-field-hint">
              Convert straight quotes to curly typographic quotes
            </span>
          </div>
          <div
            role="switch"
            aria-checked={options.smartQuotes}
            className={`toggle-switch ${options.smartQuotes ? "active" : ""}`}
            onClick={() => updateOption("smartQuotes", !options.smartQuotes)}
          />
        </div>

        <div className="feature-field-row">
          <div className="feature-field-info">
            <span className="feature-field-label">Trim whitespace</span>
            <span className="feature-field-hint">
              Remove extra spaces and line breaks
            </span>
          </div>
          <div
            role="switch"
            aria-checked={options.trimWhitespace}
            className={`toggle-switch ${options.trimWhitespace ? "active" : ""}`}
            onClick={() => updateOption("trimWhitespace", !options.trimWhitespace)}
          />
        </div>
      </section>

      <section className="feature-card feature-card--flat">
        <h3 className="feature-section-title">
          <Hash size={18} strokeWidth={2} /> Numbers and lists
        </h3>

        <div className="feature-field-row">
          <div className="feature-field-info">
            <span className="feature-field-label">Number style</span>
            <span className="feature-field-hint">How to format spoken numbers</span>
          </div>
          <select
            className="feature-select"
            value={options.numberFormatting}
            onChange={(e) =>
              updateOption(
                "numberFormatting",
                e.target.value as FormattingOptions["numberFormatting"],
              )
            }
          >
            <option value="auto">Auto (context-aware)</option>
            <option value="digits">Always digits (5, 10, 100)</option>
            <option value="words">Always words (five, ten)</option>
          </select>
        </div>

        <div className="feature-field-row">
          <div className="feature-field-info">
            <span className="feature-field-label">List detection</span>
            <span className="feature-field-hint">
              Format detected lists with bullets or numbers
            </span>
          </div>
          <div
            role="switch"
            aria-checked={options.listDetection}
            className={`toggle-switch ${options.listDetection ? "active" : ""}`}
            onClick={() => updateOption("listDetection", !options.listDetection)}
          />
        </div>
      </section>

      <section className="feature-card feature-card--flat">
        <h3 className="feature-section-title">
          <Eye size={18} strokeWidth={2} /> Live preview
        </h3>
        <p className="feature-section-hint">
          Test your formatting rules with sample text.
        </p>

        <div className="preview-container">
          <div className="preview-input">
            <label className="preview-label">Input</label>
            <textarea
              className="feature-textarea preview-textarea"
              value={previewText}
              onChange={(e) => setPreviewText(e.target.value)}
              rows={4}
              placeholder="Type or paste text to preview formatting…"
            />
          </div>

          <div className="preview-arrow" aria-hidden>
            <ArrowRight size={22} strokeWidth={2} />
          </div>

          <div className="preview-output">
            <label className="preview-label">
              <span>Output</span>
              {previewResult.changes.length > 0 && (
                <span className="feature-chip accent">
                  {previewResult.changes.length} change
                  {previewResult.changes.length !== 1 ? "s" : ""}
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
              <span key={i} className="feature-chip">
                {change}
              </span>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
