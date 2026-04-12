import { app, BrowserWindow } from "electron";
import path from "node:path";
import fs from "node:fs";

/**
 * Keywords Storage Engine
 * Manages vocabulary corrections for transcription refinement.
 * Pattern: Similar to history.ts - JSON file persistence with IPC broadcast.
 */

export interface Keyword {
  id: string;
  trigger: string;           // Word/phrase heard (case-insensitive match by default)
  correction: string;        // Word/phrase to display instead
  caseSensitive: boolean;    // Match case-sensitively (default: false)
  wholeWord: boolean;        // Match whole words only (default: true)
  usageCount: number;        // Times this replacement was applied
  createdAt: number;         // Timestamp
  source: "manual" | "learned";  // "learned" = from clipboard diff detection
}

export interface KeywordSuggestion {
  original: string;
  corrected: string;
}

let keywordData: Keyword[] = [];
let keywordFilePath = "";
const MAX_KEYWORDS = 500;

function getFilePath(): string {
  if (!keywordFilePath) {
    keywordFilePath = path.join(app.getPath("userData"), "keywords.json");
  }
  return keywordFilePath;
}

export function loadKeywords(): void {
  try {
    const raw = fs.readFileSync(getFilePath(), "utf-8");
    keywordData = JSON.parse(raw);
    if (!Array.isArray(keywordData)) {
      keywordData = [];
    }
  } catch {
    keywordData = [];
  }
}

function saveKeywords(): void {
  try {
    const dir = path.dirname(getFilePath());
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(getFilePath(), JSON.stringify(keywordData, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to save keywords:", err);
  }
}

function notifyChanges(windows: (BrowserWindow | null)[]): void {
  windows.forEach((win) => {
    if (win && !win.isDestroyed()) {
      win.webContents.send("keywords-changed", keywordData);
    }
  });
}

function generateId(): string {
  return `kw-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function getKeywords(): Keyword[] {
  return [...keywordData];
}

export function addKeyword(
  entry: Omit<Keyword, "id" | "usageCount" | "createdAt">,
  windows: (BrowserWindow | null)[]
): Keyword {
  // Check for duplicate trigger
  const existingIndex = keywordData.findIndex(
    (k) => k.trigger.toLowerCase() === entry.trigger.toLowerCase()
  );

  if (existingIndex !== -1) {
    // Update existing instead of adding duplicate
    keywordData[existingIndex] = {
      ...keywordData[existingIndex],
      correction: entry.correction,
      caseSensitive: entry.caseSensitive,
      wholeWord: entry.wholeWord,
      source: entry.source,
    };
    saveKeywords();
    notifyChanges(windows);
    return keywordData[existingIndex];
  }

  const keyword: Keyword = {
    id: generateId(),
    trigger: entry.trigger.trim(),
    correction: entry.correction.trim(),
    caseSensitive: entry.caseSensitive ?? false,
    wholeWord: entry.wholeWord ?? true,
    usageCount: 0,
    createdAt: Date.now(),
    source: entry.source ?? "manual",
  };

  keywordData.unshift(keyword);

  if (keywordData.length > MAX_KEYWORDS) {
    keywordData = keywordData.slice(0, MAX_KEYWORDS);
  }

  saveKeywords();
  notifyChanges(windows);
  return keyword;
}

export function updateKeyword(
  id: string,
  partial: Partial<Omit<Keyword, "id" | "createdAt">>,
  windows: (BrowserWindow | null)[]
): Keyword | null {
  const index = keywordData.findIndex((k) => k.id === id);
  if (index === -1) return null;

  keywordData[index] = {
    ...keywordData[index],
    ...partial,
    trigger: partial.trigger?.trim() ?? keywordData[index].trigger,
    correction: partial.correction?.trim() ?? keywordData[index].correction,
  };

  saveKeywords();
  notifyChanges(windows);
  return keywordData[index];
}

export function deleteKeyword(
  id: string,
  windows: (BrowserWindow | null)[]
): boolean {
  const index = keywordData.findIndex((k) => k.id === id);
  if (index === -1) return false;

  keywordData.splice(index, 1);
  saveKeywords();
  notifyChanges(windows);
  return true;
}

/**
 * Apply all keyword replacements to text.
 * Processes keywords sorted by trigger length (longest first) to avoid partial matches.
 * Returns the transformed text and increments usage counts for applied keywords.
 */
export function applyKeywords(
  text: string,
  windows: (BrowserWindow | null)[]
): { text: string; appliedCount: number } {
  if (!text || keywordData.length === 0) {
    return { text, appliedCount: 0 };
  }

  // Sort by trigger length descending to match longer phrases first
  const sorted = [...keywordData].sort(
    (a, b) => b.trigger.length - a.trigger.length
  );

  let result = text;
  let appliedCount = 0;
  const appliedIds: Set<string> = new Set();

  for (const keyword of sorted) {
    const flags = keyword.caseSensitive ? "g" : "gi";
    let pattern: string;

    if (keyword.wholeWord) {
      // Unicode-aware word boundary using lookbehind/lookahead
      // This handles Vietnamese and other non-ASCII text better
      const escaped = escapeRegex(keyword.trigger);
      pattern = `(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`;
    } else {
      pattern = escapeRegex(keyword.trigger);
    }

    try {
      const regex = new RegExp(pattern, flags + "u");
      const beforeReplace = result;
      result = result.replace(regex, keyword.correction);

      if (result !== beforeReplace) {
        appliedIds.add(keyword.id);
        appliedCount++;
      }
    } catch (err) {
      // Fallback for environments without Unicode regex support
      const simplePattern = keyword.wholeWord
        ? `\\b${escapeRegex(keyword.trigger)}\\b`
        : escapeRegex(keyword.trigger);

      try {
        const regex = new RegExp(simplePattern, flags);
        const beforeReplace = result;
        result = result.replace(regex, keyword.correction);

        if (result !== beforeReplace) {
          appliedIds.add(keyword.id);
          appliedCount++;
        }
      } catch {
        console.error(`Invalid regex pattern for keyword: ${keyword.trigger}`);
      }
    }
  }

  // Update usage counts for applied keywords
  if (appliedIds.size > 0) {
    let changed = false;
    for (const kw of keywordData) {
      if (appliedIds.has(kw.id)) {
        kw.usageCount++;
        changed = true;
      }
    }
    if (changed) {
      saveKeywords();
      // Don't broadcast here to avoid UI flicker during transcription
    }
  }

  return { text: result, appliedCount };
}

/**
 * Compute diff between original and modified text to suggest keyword corrections.
 * Uses word-level comparison to find changed words/phrases.
 */
export function computeKeywordSuggestions(
  original: string,
  modified: string
): KeywordSuggestion[] {
  if (!original || !modified || original === modified) {
    return [];
  }

  // Tokenize by word boundaries while preserving positions
  const tokenize = (str: string): string[] => {
    return str.split(/(\s+)/).filter(Boolean);
  };

  const originalTokens = tokenize(original);
  const modifiedTokens = tokenize(modified);

  const suggestions: KeywordSuggestion[] = [];
  const seen = new Set<string>();

  // Simple diff: compare token by token
  const minLen = Math.min(originalTokens.length, modifiedTokens.length);

  for (let i = 0; i < minLen; i++) {
    const origToken = originalTokens[i].trim();
    const modToken = modifiedTokens[i].trim();

    // Skip whitespace-only tokens
    if (!origToken || !modToken) continue;

    // Check if tokens are different (case-insensitive for comparison)
    if (origToken.toLowerCase() !== modToken.toLowerCase()) {
      // Only suggest if it's a meaningful word change (not just punctuation)
      if (origToken.length > 1 && modToken.length > 1) {
        const key = `${origToken.toLowerCase()}:${modToken.toLowerCase()}`;
        if (!seen.has(key)) {
          seen.add(key);
          suggestions.push({
            original: origToken,
            corrected: modToken,
          });
        }
      }
    }
  }

  // Limit suggestions to avoid overwhelming the user
  return suggestions.slice(0, 5);
}

/**
 * Import keywords from an array (for bulk operations)
 */
export function importKeywords(
  keywords: Array<Omit<Keyword, "id" | "usageCount" | "createdAt">>,
  windows: (BrowserWindow | null)[]
): number {
  let imported = 0;

  for (const kw of keywords) {
    if (kw.trigger && kw.correction) {
      addKeyword(kw, []);  // Don't broadcast for each
      imported++;
    }
  }

  if (imported > 0) {
    notifyChanges(windows);
  }

  return imported;
}

/**
 * Export all keywords for backup
 */
export function exportKeywords(): Keyword[] {
  return [...keywordData];
}

/**
 * Clear all keywords
 */
export function clearKeywords(windows: (BrowserWindow | null)[]): void {
  keywordData = [];
  saveKeywords();
  notifyChanges(windows);
}
