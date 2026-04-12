import { useState, useEffect, useCallback } from "react";
import { getApi } from "../lib/ipc";

export interface ClipboardEntry {
  id: string;
  text: string;
  timestamp: number;
  source: "transcription" | "manual";
  template?: string;
}

const MAX_HISTORY_ITEMS = 50;
const STORAGE_KEY = "vtt-clipboard-history";

/**
 * Hook for managing clipboard history.
 * Stores transcriptions and clipboard entries with timestamps.
 */
export function useClipboardHistory() {
  const [history, setHistory] = useState<ClipboardEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Load history from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as ClipboardEntry[];
        // Filter out entries older than retention period (7 days default)
        const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        const filtered = parsed.filter((entry) => entry.timestamp > sevenDaysAgo);
        setHistory(filtered);
      }
    } catch (err) {
      console.error("Failed to load clipboard history:", err);
    }
    setLoaded(true);
  }, []);

  // Save history to localStorage when it changes
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch (err) {
      console.error("Failed to save clipboard history:", err);
    }
  }, [history, loaded]);

  // Add new entry to history
  const addEntry = useCallback(
    (text: string, source: "transcription" | "manual" = "transcription", template?: string) => {
      if (!text.trim()) return;

      const entry: ClipboardEntry = {
        id: `clip-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        text: text.trim(),
        timestamp: Date.now(),
        source,
        template,
      };

      setHistory((prev) => {
        // Check for duplicate (same text within last minute)
        const oneMinuteAgo = Date.now() - 60000;
        const isDuplicate = prev.some(
          (e) => e.text === entry.text && e.timestamp > oneMinuteAgo
        );
        if (isDuplicate) return prev;

        // Add new entry and limit to max items
        const updated = [entry, ...prev].slice(0, MAX_HISTORY_ITEMS);
        return updated;
      });

      return entry;
    },
    []
  );

  // Remove entry from history
  const removeEntry = useCallback((id: string) => {
    setHistory((prev) => prev.filter((entry) => entry.id !== id));
  }, []);

  // Clear all history
  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  // Copy entry to clipboard
  const copyToClipboard = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.error("Failed to copy to clipboard:", err);
      return false;
    }
  }, []);

  // Copy and paste entry
  const copyAndPaste = useCallback(
    async (text: string) => {
      const api = getApi();
      if (api) {
        api.pasteText(text);
        return true;
      }
      return copyToClipboard(text);
    },
    [copyToClipboard]
  );

  // Search history
  const searchHistory = useCallback(
    (query: string): ClipboardEntry[] => {
      if (!query.trim()) return history;
      const lowerQuery = query.toLowerCase();
      return history.filter((entry) =>
        entry.text.toLowerCase().includes(lowerQuery)
      );
    },
    [history]
  );

  return {
    history,
    loaded,
    addEntry,
    removeEntry,
    clearHistory,
    copyToClipboard,
    copyAndPaste,
    searchHistory,
  };
}
