import { contextBridge, ipcRenderer } from "electron";

export interface Keyword {
  id: string;
  trigger: string;
  correction: string;
  caseSensitive: boolean;
  wholeWord: boolean;
  usageCount: number;
  createdAt: number;
  source: "manual" | "learned";
}

export interface KeywordSuggestion {
  original: string;
  corrected: string;
}

export interface VttApi {
  onRecordingState: (cb: (state: "start" | "stop" | "cancel") => void) => () => void;
  onHotkeyMode: (cb: (mode: "ptt" | "ttt") => void) => () => void;
  sendAudioChunk: (chunk: ArrayBuffer) => void;
  sendEndSignal: () => void;
  sendCancel: () => void;
  pasteText: (text: string) => void;
  openSettings: () => void;
  resizeOverlay: (w: number, h: number) => void;
  windowMinimize: () => void;
  windowMaximize: () => void;
  windowClose: () => void;
  windowIsMaximized: () => Promise<boolean>;
  getSettings: () => Promise<Record<string, unknown>>;
  setSetting: (key: string, value: unknown) => Promise<void>;
  onSettingsChanged: (cb: (settings: Record<string, unknown>) => void) => () => void;
  getBackendStatus: () => Promise<string>;
  onBackendStatus: (cb: (status: string) => void) => () => void;
  getModelStatus: (model?: string) => Promise<Record<string, unknown>>;
  getModelCatalog: () => Promise<Record<string, unknown>>;
  setTranscriptionConfig: (profile: string, languageHint: string) => Promise<Record<string, unknown>>;
  startModelDownload: (model: string) => void;
  loadModel: (model: string) => void;
  onModelProgress: (cb: (data: Record<string, unknown>) => void) => () => void;
  onModelEvent: (cb: (data: Record<string, unknown>) => void) => () => void;
  onPasteStatus: (cb: (data: Record<string, unknown>) => void) => () => void;
  getHistory: () => Promise<any[]>;
  addHistory: (entry: any) => void;
  updateHistory: (id: string, partial: any) => Promise<any>;
  deleteHistory: (id: string) => Promise<boolean>;
  clearHistory: () => void;
  onHistoryChanged: (cb: (history: any[]) => void) => () => void;
  // Keywords API
  getKeywords: () => Promise<Keyword[]>;
  addKeyword: (entry: Omit<Keyword, "id" | "usageCount" | "createdAt">) => Promise<Keyword>;
  updateKeyword: (id: string, partial: Partial<Omit<Keyword, "id" | "createdAt">>) => Promise<Keyword | null>;
  deleteKeyword: (id: string) => Promise<boolean>;
  applyKeywords: (text: string) => Promise<{ text: string; appliedCount: number }>;
  clearKeywords: () => Promise<void>;
  importKeywords: (keywords: Array<Omit<Keyword, "id" | "usageCount" | "createdAt">>) => Promise<number>;
  exportKeywords: () => Promise<Keyword[]>;
  onKeywordsChanged: (cb: (keywords: Keyword[]) => void) => () => void;
  onKeywordSuggestion: (cb: (suggestions: KeywordSuggestion[]) => void) => () => void;
}

const api: VttApi = {
  onRecordingState(cb) {
    const handler = (_e: Electron.IpcRendererEvent, state: "start" | "stop" | "cancel") => cb(state);
    ipcRenderer.on("recording-state", handler);
    return () => ipcRenderer.removeListener("recording-state", handler);
  },

  onHotkeyMode(cb) {
    const handler = (_e: Electron.IpcRendererEvent, mode: "ptt" | "ttt") => cb(mode);
    ipcRenderer.on("hotkey-mode", handler);
    return () => ipcRenderer.removeListener("hotkey-mode", handler);
  },

  sendAudioChunk(chunk: ArrayBuffer) {
    ipcRenderer.send("audio-chunk", Buffer.from(chunk));
  },

  sendEndSignal() {
    ipcRenderer.send("audio-end");
  },

  sendCancel() {
    ipcRenderer.send("audio-cancel");
  },

  pasteText(text: string) {
    ipcRenderer.send("paste-text", text);
  },

  openSettings() {
    ipcRenderer.send("open-settings");
  },

  resizeOverlay(w: number, h: number) {
    ipcRenderer.send("resize-overlay", w, h);
  },

  windowMinimize() {
    ipcRenderer.send("window-minimize");
  },

  windowMaximize() {
    ipcRenderer.send("window-maximize");
  },

  windowClose() {
    ipcRenderer.send("window-close");
  },

  async windowIsMaximized() {
    return ipcRenderer.invoke("window-is-maximized");
  },

  async getSettings() {
    return ipcRenderer.invoke("get-settings");
  },

  async setSetting(key: string, value: unknown) {
    return ipcRenderer.invoke("set-setting", key, value);
  },

  onSettingsChanged(cb) {
    const handler = (_e: Electron.IpcRendererEvent, settings: Record<string, unknown>) => cb(settings);
    ipcRenderer.on("settings-changed", handler);
    return () => ipcRenderer.removeListener("settings-changed", handler);
  },

  async getBackendStatus() {
    return ipcRenderer.invoke("get-backend-status");
  },

  onBackendStatus(cb) {
    const handler = (_e: Electron.IpcRendererEvent, status: string) => cb(status);
    ipcRenderer.on("backend-status", handler);
    return () => ipcRenderer.removeListener("backend-status", handler);
  },

  async getModelStatus(model?: string) {
    return ipcRenderer.invoke("get-model-status", model);
  },

  async getModelCatalog() {
    return ipcRenderer.invoke("get-model-catalog");
  },

  async setTranscriptionConfig(profile: string, languageHint: string) {
    return ipcRenderer.invoke("set-transcription-config", profile, languageHint);
  },

  startModelDownload(model: string) {
    ipcRenderer.send("model-download", model);
  },

  loadModel(model: string) {
    ipcRenderer.send("model-load", model);
  },

  onModelProgress(cb) {
    const handler = (_e: Electron.IpcRendererEvent, data: Record<string, unknown>) => cb(data);
    ipcRenderer.on("model-progress", handler);
    return () => ipcRenderer.removeListener("model-progress", handler);
  },

  onModelEvent(cb) {
    const handler = (_e: Electron.IpcRendererEvent, data: Record<string, unknown>) => cb(data);
    ipcRenderer.on("model-event", handler);
    return () => ipcRenderer.removeListener("model-event", handler);
  },

  onPasteStatus(cb) {
    const handler = (_e: Electron.IpcRendererEvent, data: Record<string, unknown>) => cb(data);
    ipcRenderer.on("paste-status", handler);
    return () => ipcRenderer.removeListener("paste-status", handler);
  },

  getHistory() {
    return ipcRenderer.invoke("get-history");
  },

  addHistory(entry: any) {
    ipcRenderer.send("add-history", entry);
  },

  updateHistory(id: string, partial: any) {
    return ipcRenderer.invoke("update-history", id, partial);
  },

  deleteHistory(id: string) {
    return ipcRenderer.invoke("delete-history", id);
  },

  clearHistory() {
    ipcRenderer.send("clear-history");
  },

  onHistoryChanged(cb) {
    const handler = (_e: Electron.IpcRendererEvent, history: any[]) => cb(history);
    ipcRenderer.on("history-changed", handler);
    return () => ipcRenderer.removeListener("history-changed", handler);
  },

  // Keywords API
  getKeywords() {
    return ipcRenderer.invoke("get-keywords");
  },

  addKeyword(entry: Omit<Keyword, "id" | "usageCount" | "createdAt">) {
    return ipcRenderer.invoke("add-keyword", entry);
  },

  updateKeyword(id: string, partial: Partial<Omit<Keyword, "id" | "createdAt">>) {
    return ipcRenderer.invoke("update-keyword", id, partial);
  },

  deleteKeyword(id: string) {
    return ipcRenderer.invoke("delete-keyword", id);
  },

  applyKeywords(text: string) {
    return ipcRenderer.invoke("apply-keywords", text);
  },

  clearKeywords() {
    return ipcRenderer.invoke("clear-keywords");
  },

  importKeywords(keywords: Array<Omit<Keyword, "id" | "usageCount" | "createdAt">>) {
    return ipcRenderer.invoke("import-keywords", keywords);
  },

  exportKeywords() {
    return ipcRenderer.invoke("export-keywords");
  },

  onKeywordsChanged(cb) {
    const handler = (_e: Electron.IpcRendererEvent, keywords: Keyword[]) => cb(keywords);
    ipcRenderer.on("keywords-changed", handler);
    return () => ipcRenderer.removeListener("keywords-changed", handler);
  },

  onKeywordSuggestion(cb) {
    const handler = (_e: Electron.IpcRendererEvent, suggestions: KeywordSuggestion[]) => cb(suggestions);
    ipcRenderer.on("keyword-suggestion", handler);
    return () => ipcRenderer.removeListener("keyword-suggestion", handler);
  },
};

contextBridge.exposeInMainWorld("vttApi", api);
