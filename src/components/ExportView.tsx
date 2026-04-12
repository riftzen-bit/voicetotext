import { useState } from "react";
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
    case "today":
      const todayStart = new Date().setHours(0, 0, 0, 0);
      return entries.filter(e => e.timestamp >= todayStart);
    case "week":
      return entries.filter(e => e.timestamp >= now - 7 * day);
    case "month":
      return entries.filter(e => e.timestamp >= now - 30 * day);
    default:
      return entries;
  }
}

function generateExport(entries: TranscriptionEntry[], config: ExportConfig): string {
  const filtered = filterByDateRange(entries, config.dateRange);

  switch (config.format) {
    case "txt":
      return filtered.map(e => {
        const parts: string[] = [];
        if (config.includeTimestamp) parts.push(`[${formatTimestamp(e.timestamp)}]`);
        if (config.includeLanguage) parts.push(`(${e.language.toUpperCase()})`);
        if (config.includeDuration) parts.push(`{${e.duration.toFixed(1)}s}`);
        if (config.includeRefinedStatus && e.refined) parts.push("[AI Refined]");
        parts.push(e.text);
        return parts.join(" ");
      }).join("\n\n---\n\n");

    case "json":
      return JSON.stringify(filtered.map(e => {
        const obj: Record<string, unknown> = { text: e.text };
        if (config.includeTimestamp) obj.timestamp = formatDateISO(e.timestamp);
        if (config.includeLanguage) obj.language = e.language;
        if (config.includeDuration) obj.duration = e.duration;
        if (config.includeRefinedStatus) obj.refined = e.refined;
        return obj;
      }), null, 2);

    case "csv":
      const headers: string[] = [];
      if (config.includeTimestamp) headers.push("Timestamp");
      headers.push("Text");
      if (config.includeLanguage) headers.push("Language");
      if (config.includeDuration) headers.push("Duration");
      if (config.includeRefinedStatus) headers.push("Refined");

      const rows = filtered.map(e => {
        const cols: string[] = [];
        if (config.includeTimestamp) cols.push(`"${formatTimestamp(e.timestamp)}"`);
        cols.push(`"${e.text.replace(/"/g, '""')}"`);
        if (config.includeLanguage) cols.push(e.language);
        if (config.includeDuration) cols.push(e.duration.toFixed(1));
        if (config.includeRefinedStatus) cols.push(e.refined ? "Yes" : "No");
        return cols.join(",");
      });

      return [headers.join(","), ...rows].join("\n");

    case "md":
      return filtered.map(e => {
        const meta: string[] = [];
        if (config.includeTimestamp) meta.push(`**${formatTimestamp(e.timestamp)}**`);
        if (config.includeLanguage) meta.push(`*${e.language.toUpperCase()}*`);
        if (config.includeDuration) meta.push(`${e.duration.toFixed(1)}s`);
        if (config.includeRefinedStatus && e.refined) meta.push("`AI Refined`");

        return `${meta.length > 0 ? meta.join(" | ") + "\n\n" : ""}> ${e.text}`;
      }).join("\n\n---\n\n");

    default:
      return "";
  }
}

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
    <div className="export-view">
      <h2 className="section-header">Export</h2>
      <p className="section-description">
        Export your transcription history in various formats.
      </p>

      {entries.length === 0 ? (
        <div className="export-empty">
          <p>No transcriptions to export yet.</p>
        </div>
      ) : (
        <>
          {/* Format Selection */}
          <div className="export-section">
            <h3 className="subsection-header">Format</h3>
            <div className="format-options">
              {([
                { value: "txt", label: "Plain Text", icon: "T" },
                { value: "json", label: "JSON", icon: "{}" },
                { value: "csv", label: "CSV", icon: "," },
                { value: "md", label: "Markdown", icon: "#" },
              ] as const).map((fmt) => (
                <button
                  key={fmt.value}
                  className={`format-btn ${config.format === fmt.value ? "active" : ""}`}
                  onClick={() => updateConfig("format", fmt.value)}
                >
                  <span className="format-icon">{fmt.icon}</span>
                  <span className="format-label">{fmt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Date Range */}
          <div className="export-section">
            <h3 className="subsection-header">Date Range</h3>
            <div className="field-row">
              <select
                className="form-select"
                value={config.dateRange}
                onChange={(e) => updateConfig("dateRange", e.target.value as ExportConfig["dateRange"])}
                style={{ width: "200px" }}
              >
                <option value="all">All Time ({entries.length})</option>
                <option value="today">Today</option>
                <option value="week">Last 7 Days</option>
                <option value="month">Last 30 Days</option>
              </select>
              <span className="entry-count">{filteredCount} entries selected</span>
            </div>
          </div>

          {/* Include Options */}
          <div className="export-section">
            <h3 className="subsection-header">Include</h3>
            <div className="checkbox-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={config.includeTimestamp}
                  onChange={(e) => updateConfig("includeTimestamp", e.target.checked)}
                />
                <span className="checkbox-text">Timestamp</span>
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={config.includeLanguage}
                  onChange={(e) => updateConfig("includeLanguage", e.target.checked)}
                />
                <span className="checkbox-text">Language</span>
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={config.includeDuration}
                  onChange={(e) => updateConfig("includeDuration", e.target.checked)}
                />
                <span className="checkbox-text">Duration</span>
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={config.includeRefinedStatus}
                  onChange={(e) => updateConfig("includeRefinedStatus", e.target.checked)}
                />
                <span className="checkbox-text">AI Refined Status</span>
              </label>
            </div>
          </div>

          {/* Preview */}
          {preview && (
            <div className="export-section">
              <h3 className="subsection-header">Preview</h3>
              <div className="export-preview">
                <pre>{preview.slice(0, 1000)}{preview.length > 1000 ? "\n\n... (truncated)" : ""}</pre>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="export-actions">
            <button className="btn" onClick={handlePreview}>
              Preview
            </button>
            <button className="btn" onClick={handleCopyToClipboard}>
              {copied ? "Copied!" : "Copy to Clipboard"}
            </button>
            <button className="btn btn-primary" onClick={handleDownload}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Download
            </button>
          </div>
        </>
      )}
    </div>
  );
}
