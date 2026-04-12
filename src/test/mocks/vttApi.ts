import { vi } from 'vitest';

export interface Keyword {
  id: string;
  trigger: string;
  correction: string;
  caseSensitive: boolean;
  wholeWord: boolean;
  usageCount: number;
  createdAt: number;
  source: 'manual' | 'learned';
}

export interface KeywordSuggestion {
  original: string;
  corrected: string;
}

export interface VttApi {
  onRecordingState: (cb: (state: 'start' | 'stop' | 'cancel') => void) => () => void;
  onHotkeyMode: (cb: (mode: 'ptt' | 'ttt') => void) => () => void;
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
  getKeywords: () => Promise<Keyword[]>;
  addKeyword: (entry: Omit<Keyword, 'id' | 'usageCount' | 'createdAt'>) => Promise<Keyword>;
  updateKeyword: (id: string, partial: Partial<Omit<Keyword, 'id' | 'createdAt'>>) => Promise<Keyword | null>;
  deleteKeyword: (id: string) => Promise<boolean>;
  applyKeywords: (text: string) => Promise<{ text: string; appliedCount: number }>;
  clearKeywords: () => Promise<void>;
  importKeywords: (keywords: Array<Omit<Keyword, 'id' | 'usageCount' | 'createdAt'>>) => Promise<number>;
  exportKeywords: () => Promise<Keyword[]>;
  onKeywordsChanged: (cb: (keywords: Keyword[]) => void) => () => void;
  onKeywordSuggestion: (cb: (suggestions: KeywordSuggestion[]) => void) => () => void;
}

// Create mock functions with proper return types
const createUnsubscribe = () => vi.fn();

export const mockVttApi: VttApi = {
  // Event subscriptions
  onRecordingState: vi.fn(() => createUnsubscribe()),
  onHotkeyMode: vi.fn(() => createUnsubscribe()),
  onSettingsChanged: vi.fn(() => createUnsubscribe()),
  onBackendStatus: vi.fn(() => createUnsubscribe()),
  onModelProgress: vi.fn(() => createUnsubscribe()),
  onModelEvent: vi.fn(() => createUnsubscribe()),
  onPasteStatus: vi.fn(() => createUnsubscribe()),
  onHistoryChanged: vi.fn(() => createUnsubscribe()),
  onKeywordsChanged: vi.fn(() => createUnsubscribe()),
  onKeywordSuggestion: vi.fn(() => createUnsubscribe()),

  // Actions (void returns)
  sendAudioChunk: vi.fn(),
  sendEndSignal: vi.fn(),
  sendCancel: vi.fn(),
  pasteText: vi.fn(),
  openSettings: vi.fn(),
  resizeOverlay: vi.fn(),
  windowMinimize: vi.fn(),
  windowMaximize: vi.fn(),
  windowClose: vi.fn(),
  startModelDownload: vi.fn(),
  loadModel: vi.fn(),
  addHistory: vi.fn(),
  clearHistory: vi.fn(),

  // Async getters
  windowIsMaximized: vi.fn().mockResolvedValue(false),
  getSettings: vi.fn().mockResolvedValue({}),
  setSetting: vi.fn().mockResolvedValue(undefined),
  getBackendStatus: vi.fn().mockResolvedValue('ready'),
  getModelStatus: vi.fn().mockResolvedValue({ status: 'ready', model: 'large-v3' }),
  getModelCatalog: vi.fn().mockResolvedValue({ models: [], default_model: 'large-v3' }),
  setTranscriptionConfig: vi.fn().mockResolvedValue({ status: 'ok' }),
  getHistory: vi.fn().mockResolvedValue([]),
  updateHistory: vi.fn().mockResolvedValue({}),
  deleteHistory: vi.fn().mockResolvedValue(true),

  // Keywords
  getKeywords: vi.fn().mockResolvedValue([]),
  addKeyword: vi.fn().mockResolvedValue({
    id: 'test-id',
    trigger: 'test',
    correction: 'Test',
    caseSensitive: false,
    wholeWord: true,
    usageCount: 0,
    createdAt: Date.now(),
    source: 'manual',
  }),
  updateKeyword: vi.fn().mockResolvedValue(null),
  deleteKeyword: vi.fn().mockResolvedValue(true),
  applyKeywords: vi.fn().mockImplementation((text: string) =>
    Promise.resolve({ text, appliedCount: 0 })
  ),
  clearKeywords: vi.fn().mockResolvedValue(undefined),
  importKeywords: vi.fn().mockResolvedValue(0),
  exportKeywords: vi.fn().mockResolvedValue([]),
};

// Helper to reset all mock implementations
export function resetVttApiMocks() {
  Object.values(mockVttApi).forEach((mock) => {
    if (typeof mock === 'function' && 'mockClear' in mock) {
      (mock as ReturnType<typeof vi.fn>).mockClear();
    }
  });
}

// Helper to configure mock responses
export function configureMockSettings(settings: Record<string, unknown>) {
  mockVttApi.getSettings.mockResolvedValue(settings);
}

export function configureMockHistory(history: any[]) {
  mockVttApi.getHistory.mockResolvedValue(history);
}

export function configureMockKeywords(keywords: Keyword[]) {
  mockVttApi.getKeywords.mockResolvedValue(keywords);
}
