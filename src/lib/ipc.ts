export interface ModelProgress {
  type: "download_progress";
  downloaded: number;
  total: number;
  progress: number;
  downloaded_mb: number;
  total_mb: number;
  speed_mbps: number;
  file: string;
}

export interface RuntimeInfo {
  requested_device: string;
  resolved_device: string;
  compute_type: string;
  has_cuda_driver: boolean;
  gpu_ready: boolean;
  missing_runtime_libraries: string[];
  runtime_issue: string | null;
  profile: string;
  language_hint: string;
}

export interface TranscriptionConfigInfo {
  profile: string;
  language: string;
  beam_size: number;
  vad_filter: boolean;
  condition_on_previous_text: boolean;
}

export interface ModelStatusInfo {
  status: "not_downloaded" | "downloading" | "downloaded" | "loading" | "loaded";
  model: string;
  loaded_model?: string | null;
  size_mb: number;
  device: string;
  runtime: RuntimeInfo;
  transcription: TranscriptionConfigInfo;
}

export interface ModelCatalogEntry {
  value: string;
  label: string;
  description: string;
  size_mb: number;
  recommended: boolean;
}

export interface ModelCatalogInfo {
  default_model: string;
  models: ModelCatalogEntry[];
}

export interface PasteStatusInfo {
  type: "paste_status";
  status: "pasted" | "skipped" | "error";
  message: string;
}

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
  getModelStatus: (model?: string) => Promise<ModelStatusInfo>;
  getModelCatalog: () => Promise<ModelCatalogInfo>;
  setTranscriptionConfig: (profile: string, languageHint: string) => Promise<Record<string, unknown>>;
  startModelDownload: (model: string) => void;
  loadModel: (model: string) => void;
  onModelProgress: (cb: (data: Record<string, unknown>) => void) => () => void;
  onModelEvent: (cb: (data: Record<string, unknown>) => void) => () => void;
  onPasteStatus: (cb: (data: PasteStatusInfo) => void) => () => void;
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

declare global {
  interface Window {
    vttApi: VttApi;
  }
}

export function getApi(): VttApi {
  return window.vttApi;
}
