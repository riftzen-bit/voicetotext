import { BrowserWindow, ipcMain } from "electron";
import { store } from "./store";
import { PythonBridge } from "./python-bridge";
import { getHistory, addHistoryEntry, clearHistory, updateHistoryEntry, deleteHistoryEntry, TranscriptionEntry } from "./history";
import {
  getKeywords,
  addKeyword,
  updateKeyword,
  deleteKeyword,
  applyKeywords,
  clearKeywords,
  importKeywords,
  exportKeywords,
  Keyword,
} from "./keywords";

export function registerIpcHandlers(
  overlayWin: BrowserWindow,
  settingsWin: BrowserWindow,
  pythonBridge: PythonBridge
) {
  ipcMain.handle("get-settings", () => store.store);

  ipcMain.handle("set-setting", (_e, key: string, value: unknown) => {
    store.set(key, value);
    overlayWin.webContents.send("settings-changed", store.store);
    settingsWin.webContents.send("settings-changed", store.store);
  });

  ipcMain.handle("get-history", () => getHistory());

  ipcMain.on("add-history", (_e, entry: TranscriptionEntry) => {
    addHistoryEntry(entry, [overlayWin, settingsWin]);
  });

  ipcMain.on("clear-history", () => {
    clearHistory([overlayWin, settingsWin]);
  });

  ipcMain.handle(
    "update-history",
    (_e, id: string, partial: Partial<Omit<TranscriptionEntry, "id">>) => {
      return updateHistoryEntry(id, partial, [overlayWin, settingsWin]);
    }
  );

  ipcMain.handle("delete-history", (_e, id: string) => {
    return deleteHistoryEntry(id, [overlayWin, settingsWin]);
  });

  ipcMain.handle("get-backend-status", () => {
    return pythonBridge.status;
  });

  ipcMain.handle("get-model-status", async (_e, model?: string) => {
    return pythonBridge.getModelStatus(model);
  });

  ipcMain.handle("get-model-catalog", async () => {
    return pythonBridge.getModels();
  });

  ipcMain.handle("set-transcription-config", async (_e, profile: string, languageHint: string) => {
    return pythonBridge.updateTranscriptionConfig(profile, languageHint);
  });

  ipcMain.on("model-download", (_e, model: string) => {
    pythonBridge.startModelDownload(model);
  });

  ipcMain.on("model-load", (_e, model: string) => {
    pythonBridge.loadModel(model);
  });

  // Keywords handlers
  const windows = [overlayWin, settingsWin];

  ipcMain.handle("get-keywords", () => getKeywords());

  ipcMain.handle(
    "add-keyword",
    (_e, entry: Omit<Keyword, "id" | "usageCount" | "createdAt">) => {
      return addKeyword(entry, windows);
    }
  );

  ipcMain.handle(
    "update-keyword",
    (_e, id: string, partial: Partial<Omit<Keyword, "id" | "createdAt">>) => {
      return updateKeyword(id, partial, windows);
    }
  );

  ipcMain.handle("delete-keyword", (_e, id: string) => {
    return deleteKeyword(id, windows);
  });

  ipcMain.handle("apply-keywords", (_e, text: string) => {
    return applyKeywords(text, windows);
  });

  ipcMain.handle("clear-keywords", () => {
    clearKeywords(windows);
  });

  ipcMain.handle(
    "import-keywords",
    (_e, keywords: Array<Omit<Keyword, "id" | "usageCount" | "createdAt">>) => {
      return importKeywords(keywords, windows);
    }
  );

  ipcMain.handle("export-keywords", () => {
    return exportKeywords();
  });
}

export { store };
