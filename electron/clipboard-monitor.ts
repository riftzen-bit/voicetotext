import { clipboard, BrowserWindow } from "electron";
import { computeKeywordSuggestions, KeywordSuggestion } from "./keywords";

/**
 * Clipboard Monitor for Keyword Learning
 *
 * After pasting transcribed text, monitors clipboard changes to detect
 * user corrections. If differences are found, suggests keyword additions.
 */

let isMonitoring = false;
let monitorInterval: ReturnType<typeof setInterval> | null = null;
let originalText = "";
let lastClipboardText = "";
let monitorStartTime = 0;
const MONITOR_DURATION_MS = 30000; // 30 seconds
const POLL_INTERVAL_MS = 500;
const MIN_TEXT_LENGTH = 3;

/**
 * Start monitoring clipboard for changes after pasting text.
 *
 * @param pastedText - The text that was just pasted
 * @param windows - Windows to broadcast suggestions to
 */
export function startClipboardMonitoring(
  pastedText: string,
  windows: (BrowserWindow | null)[]
): void {
  // Don't monitor very short text
  if (!pastedText || pastedText.trim().length < MIN_TEXT_LENGTH) {
    return;
  }

  // Stop any existing monitoring
  stopClipboardMonitoring();

  originalText = pastedText.trim();
  lastClipboardText = clipboard.readText() || "";
  monitorStartTime = Date.now();
  isMonitoring = true;

  console.log("[clipboard-monitor] Started monitoring for corrections");

  monitorInterval = setInterval(() => {
    if (!isMonitoring) {
      stopClipboardMonitoring();
      return;
    }

    // Check timeout
    if (Date.now() - monitorStartTime > MONITOR_DURATION_MS) {
      console.log("[clipboard-monitor] Timeout reached, stopping");
      stopClipboardMonitoring();
      return;
    }

    // Check clipboard
    const currentClipboard = clipboard.readText() || "";

    // Skip if clipboard hasn't changed
    if (currentClipboard === lastClipboardText) {
      return;
    }

    lastClipboardText = currentClipboard;

    // Skip if clipboard is now completely different (user copied something else)
    if (!isRelatedText(originalText, currentClipboard)) {
      console.log("[clipboard-monitor] Clipboard content unrelated, stopping");
      stopClipboardMonitoring();
      return;
    }

    // Compute diff and suggest keywords
    const suggestions = computeKeywordSuggestions(originalText, currentClipboard);

    if (suggestions.length > 0) {
      console.log(
        "[clipboard-monitor] Found %d correction(s)",
        suggestions.length
      );
      broadcastSuggestions(suggestions, windows);
      stopClipboardMonitoring();
    }
  }, POLL_INTERVAL_MS);
}

/**
 * Stop clipboard monitoring.
 */
export function stopClipboardMonitoring(): void {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
  }
  isMonitoring = false;
  originalText = "";
  lastClipboardText = "";
}

/**
 * Check if modified text is related to original (not completely different content).
 * Uses simple heuristics: shared words or similar length.
 */
function isRelatedText(original: string, modified: string): boolean {
  if (!original || !modified) return false;

  // If lengths are wildly different, probably unrelated
  const lenRatio = modified.length / original.length;
  if (lenRatio < 0.3 || lenRatio > 3) {
    return false;
  }

  // Check for shared words
  const originalWords = new Set(
    original.toLowerCase().split(/\s+/).filter((w) => w.length > 2)
  );
  const modifiedWords = modified
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2);

  const sharedCount = modifiedWords.filter((w) => originalWords.has(w)).length;
  const sharedRatio = sharedCount / Math.max(originalWords.size, 1);

  // If at least 30% words are shared, texts are related
  return sharedRatio >= 0.3;
}

/**
 * Broadcast keyword suggestions to all windows.
 */
function broadcastSuggestions(
  suggestions: KeywordSuggestion[],
  windows: (BrowserWindow | null)[]
): void {
  windows.forEach((win) => {
    if (win && !win.isDestroyed()) {
      win.webContents.send("keyword-suggestion", suggestions);
    }
  });
}

/**
 * Check if monitoring is currently active.
 */
export function isClipboardMonitoringActive(): boolean {
  return isMonitoring;
}
