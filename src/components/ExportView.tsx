import { useState } from "react";
import {
  FileDown,
  FileText,
  FileJson,
  FileSpreadsheet,
  FileCode,
  Copy,
  Check,
  Sparkles,
  Eye,
} from "lucide-react";
import type { TranscriptionEntry } from "../hooks/useTranscription";

interface ExportViewProps {
  entries: TranscriptionEntry[];
}

type ExportFormat = "txt" | "json" | "csv" | "md";

interface ExportConfig {
  format: ExportFormat;
  includeTimestamp: boolean;
  includeLanguage: boolean;
  includeDuration: boolean;
  includeRefinedStatus: boolean;
  dateRange: "all" | "today" | "week" | "month";
}

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString();
}

function formatDateISO(ts: number): string {
  return new Date(ts).toISOString();
}

function filterByDateRange(entries: TranscriptionEntry[], range: string): TranscriptionEntry[] {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;

  switch (range) {
    case "today": {
      const todayStart = new Date().setHours(0, 0, 0, 0);
      return entries.filter((e) => e.timestamp >= todayStart);
    }
    case "week":
      return entries.filter((e) => e.timestamp >= now - 7 * day);
    case "month":
      return entries.filter((e) => e.timestamp >= now - 30 * day);
    default:
      return entries;
  }
}

function generateExport(entries: TranscriptionEntry[], config: ExportConfig): string {
  const filtered = filterByDateRange(entries, config.dateRange);

  switch (config.format) {
    case "txt":
      return filtered
        .map((e) => {
          const parts: string[] = [];
          if (config.includeTimestamp) parts.push(`[${formatTimestamp(e.timestamp)}]`);
          if (config.includeLanguage) parts.push(`(${e.language.toUpperCase()})`);
          if (config.includeDuration) parts.push(`{${e.duration.toFixed(1)}s}`);
          if (config.includeRefinedStatus && e.refined) parts.push("[AI Refined]");
          parts.push(e.text);
          return parts.join(" ");
        })
        .join("\n\n---\n\n");

    case "json":
      return JSON.stringify(
        filtered.map((e) => {
          const obj: Record<string, unknown> = { text: e.text };
          if (config.includeTimestamp) obj.timestamp = formatDateISO(e.timestamp);
          if (config.includeLanguage) obj.language = e.language;
          if (config.includeDuration) obj.duration = e.duration;
          if (config.includeRefinedStatus) obj.refined = e.refined;
          return obj;
        }),
        null,
        2,
      );

    case "csv": {
      const headers: string[] = [];
      if (config.includeTimestamp) headers.push("Timestamp");
      headers.push("Text");
      if (config.includeLanguage) headers.push("Language");
      if (config.includeDuration) headers.push("Duration");
      if (config.includeRefinedStatus) headers.push("Refined");

      const rows = filtered.map((e) => {
        const cols: string[] = [];
        if (config.includeTimestamp) cols.push(`"${formatTimestamp(e.timestamp)}"`);
        cols.push(`"${e.text.replace(/"/g, '""')}"`);
        if (config.includeLanguage) cols.push(e.language);
        if (config.includeDuration) cols.push(e.duration.toFixed(1));
        if (config.includeRefinedStatus) cols.push(e.refined ? "Yes" : "No");
        return cols.join(",");
      });

      return [headers.join(","), ...rows].join("\n");
    }

    case "md":
      return filtered
        .map((e) => {
          const meta: string[] = [];
          if (config.includeTimestamp) meta.push(`**${formatTimestamp(e.timestamp)}**`);
          if (config.includeLanguage) meta.push(`*${e.language.toUpperCase()}*`);
          if (config.includeDuration) meta.push(`${e.duration.toFixed(1)}s`);
          if (config.includeRefinedStatus && e.refined) meta.push("`AI Refined`");

          return `${meta.length > 0 ? meta.join(" | ") + "\n\n" : ""}> ${e.text}`;
        })
        .join("\n\n---\n\n");

    default:
      return "";
  }
}

const FORMATS: {
  value: ExportFormat;
  label: string;
  description: string;
  Icon: typeof FileText;
}[] = [
  {
    value: "txt",
    label: "Plain Text",
    description: "Human-readable flat file",
    Icon: FileText,
  },
  {
    value: "json",
    label: "JSON",
    description: "Structured data for tools",
    Icon: FileJson,
  },
  {
    value: "csv",
    label: "CSV",
    description: "Spreadsheets & analysis",
    Icon: FileSpreadsheet,
  },
  {
    value: "md",
    label: "Markdown",
    description: "Docs, notes, GitHub",
    Icon: FileCode,
  },
];

const INCLUDE_OPTIONS: {
  key: keyof Pick<
    ExportConfig,
    "includeTimestamp" | "includeLanguage" | "includeDuration" | "includeRefinedStatus"
  >;
  label: string;
  hint: string;
}[] = [
  { key: "includeTimestamp", label: "Timestamp", hint: "When the entry was captured" },
  { key: "includeLanguage", label: "Language", hint: "Detected input language" },
  { key: "includeDuration", label: "Duration", hint: "Length of the audio clip" },
  {
    key: "includeRefinedStatus",
    label: "AI refined",
    hint: "Marks AI-polished entries",
  },
];

export default function ExportView({ entries }: ExportViewProps) {
  const [config, setConfig] = useState<ExportConfig>({
    format: "txt",
    includeTimestamp: true,
    includeLanguage: true,
    includeDuration: false,
    includeRefinedStatus: true,
    dateRange: "all",
  });

  const [preview, setPreview] = useState<string>("");
  const [copied, setCopied] = useState(false);

  const updateConfig = <K extends keyof ExportConfig>(key: K, value: ExportConfig[K]) => {
    const newConfig = { ...config, [key]: value };
    setConfig(newConfig);
    setPreview(generateExport(entries, newConfig));
  };

  const handlePreview = () => {
    setPreview(generateExport(entries, config));
  };

  const handleCopyToClipboard = async () => {
    const content = generateExport(entries, config);
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleDownload = () => {
    const content = generateExport(entries, config);
    const mimeTypes: Record<ExportFormat, string> = {
      txt: "text/plain",
      json: "application/json",
      csv: "text/csv",
      md: "text/markdown",
    };

    const blob = new Blob([content], { type: mimeTypes[config.format] });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transcriptions-${new Date().toISOString().split("T")[0]}.${config.format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const filteredCount = filterByDateRange(entries, config.dateRange).length;

  return (
    <div className="export-view feature-view feature-view--wide">
      <header className="feature-hero">
        <span className="feature-medallion tone-teal" aria-hidden>
          <FileDown />
        </span>
        <div className="feature-hero-body">
          <span className="feature-hero-eyebrow">
            <Sparkles size={12} strokeWidth={2.5} /> Export
          </span>
          <h1 className="feature-hero-title">Export Transcriptions</h1>
          <p className="feature-hero-description">
            Turn your transcription history into a downloadable file or copy it
            straight to the clipboard. Pick a format, choose what to include,
            and preview before exporting.
          </p>
          <div className="feature-hero-meta">
            <span className="feature-chip accent">
              {entries.length} {entries.length === 1 ? "entry" : "entries"}
            </span>
            <span className="feature-chip">{filteredCount} will export</span>
          </div>
        </div>
      </header>

      {entries.length === 0 ? (
        <div className="feature-empty">
          <div className="feature-empty-icon">
            <FileDown />
          </div>
          <p className="feature-empty-title">Nothing to export yet</p>
          <p className="feature-empty-description">
            Transcribe something first — your exports will appear here.
          </p>
        </div>
      ) : (
        <>
          <section className="feature-card feature-card--flat">
            <h3 className="feature-section-title">Format</h3>
            <div className="export-format-grid">
              {FORMATS.map(({ value, label, description, Icon }) => {
                const active = config.format === value;
                return (
                  <button
                    key={value}
                    className={`export-format-btn ${active ? "active" : ""}`}
                    onClick={() => updateConfig("format", value)}
                  >
                    <span className="export-format-icon" aria-hidden>
                      <Icon />
                    </span>
                    <span className="export-format-label">{label}</span>
                    <span className="export-format-hint">{description}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="feature-card feature-card--flat">
            <h3 className="feature-section-title">Date range</h3>
            <div className="export-range-row">
              <select
                className="feature-select"
                value={config.dateRange}
                onChange={(e) =>
                  updateConfig("dateRange", e.target.value as ExportConfig["dateRange"])
                }
              >
                <option value="all">All time ({entries.length})</option>
                <option value="today">Today</option>
                <option value="week">Last 7 days</option>
                <option value="month">Last 30 days</option>
              </select>
              <span className="feature-chip">{filteredCount} entries selected</span>
            </div>
          </section>

          <section className="feature-card feature-card--flat">
            <h3 className="feature-section-title">Include fields</h3>
            <div className="export-include-grid">
              {INCLUDE_OPTIONS.map(({ key, label, hint }) => {
                const checked = config[key];
                return (
                  <label
                    key={key}
                    className={`export-include-option ${checked ? "checked" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => updateConfig(key, e.target.checked)}
                    />
                    <span className="export-include-label">{label}</span>
                    <span className="export-include-hint">{hint}</span>
                  </label>
                );
              })}
            </div>
          </section>

          {preview && (
            <section className="feature-card feature-card--flat">
              <h3 className="feature-section-title">
                <Eye size={18} strokeWidth={2} /> Preview
              </h3>
              <div className="export-preview">
                <pre>
                  {preview.slice(0, 1000)}
                  {preview.length > 1000 ? "\n\n… (truncated)" : ""}
                </pre>
              </div>
            </section>
          )}

          <div className="feature-form-actions export-actions">
            <button className="feature-btn" onClick={handlePreview}>
              <Eye />
              Preview
            </button>
            <button className="feature-btn" onClick={handleCopyToClipboard}>
              {copied ? <Check /> : <Copy />}
              {copied ? "Copied" : "Copy to clipboard"}
            </button>
            <button className="feature-btn primary" onClick={handleDownload}>
              <FileDown />
              Download file
            </button>
          </div>
        </>
      )}
    </div>
  );
}
