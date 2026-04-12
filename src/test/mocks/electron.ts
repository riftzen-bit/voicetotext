import { vi } from 'vitest';

export const mockIpcRenderer = {
  on: vi.fn(),
  once: vi.fn(),
  send: vi.fn(),
  invoke: vi.fn(),
  removeListener: vi.fn(),
  removeAllListeners: vi.fn(),
};

export const mockContextBridge = {
  exposeInMainWorld: vi.fn(),
};

export const mockElectron = {
  ipcRenderer: mockIpcRenderer,
  contextBridge: mockContextBridge,
};
