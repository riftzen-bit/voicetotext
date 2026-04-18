import { app, ipcMain, BrowserWindow } from "electron";
import path from "node:path";
import fs from "node:fs";

export interface TranscriptionEntry {
  id: string;
  text: string;
  language: string;
  confidence: number;
  duration: number;
  timestamp: number;
  refined?: boolean;
}

let historyData: TranscriptionEntry[] = [];
let historyFilePath = "";
const MAX_HISTORY = 2000;

function getFilePath(): string {
  if (!historyFilePath) {
    historyFilePath = path.join(app.getPath("userData"), "history.json");
  }
  return historyFilePath;
}

export function loadHistory(): void {
  try {
    const raw = fs.readFileSync(getFilePath(), "utf-8");
    const parsed = JSON.parse(raw);
    historyData = Array.isArray(parsed) ? parsed : [];
    if (historyData.length > MAX_HISTORY) {
      historyData = historyData.slice(0, MAX_HISTORY);
      saveHistory();
    }
  } catch {
    historyData = [];
  }
}

export function saveHistory(): void {
  try {
    const dir = path.dirname(getFilePath());
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(getFilePath(), JSON.stringify(historyData, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to save history:", err);
  }
}

export function addHistoryEntry(entry: TranscriptionEntry, windows: (BrowserWindow | null)[]): void {
  historyData.unshift(entry);
  if (historyData.length > MAX_HISTORY) {
    historyData = historyData.slice(0, MAX_HISTORY);
  }
  saveHistory();
  notifyChanges(windows);
}

export function clearHistory(windows: (BrowserWindow | null)[]): void {
  historyData = [];
  saveHistory();
  notifyChanges(windows);
}

function notifyChanges(windows: (BrowserWindow | null)[]): void {
  windows.forEach((win) => {
    if (win && !win.isDestroyed()) {
      win.webContents.send("history-changed", historyData);
    }
  });
}

export function getHistory(): TranscriptionEntry[] {
  return historyData;
}

export function updateHistoryEntry(
  id: string,
  partial: Partial<Omit<TranscriptionEntry, "id">>,
  windows: (BrowserWindow | null)[]
): TranscriptionEntry | null {
  const index = historyData.findIndex((e) => e.id === id);
  if (index === -1) return null;

  historyData[index] = { ...historyData[index], ...partial };
  saveHistory();
  notifyChanges(windows);
  return historyData[index];
}

export function deleteHistoryEntry(id: string, windows: (BrowserWindow | null)[]): boolean {
  const index = historyData.findIndex((e) => e.id === id);
  if (index === -1) return false;

  historyData.splice(index, 1);
  saveHistory();
  notifyChanges(windows);
  return true;
}
