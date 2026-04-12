import '@testing-library/jest-dom';
import { vi } from 'vitest';
import { mockVttApi } from './mocks/vttApi';
import { mockElectron } from './mocks/electron';

// Mock window.vttApi globally
Object.defineProperty(window, 'vttApi', {
  value: mockVttApi,
  writable: true,
});

// Mock electron modules for any direct imports
vi.mock('electron', () => mockElectron);

// Mock fetch globally
global.fetch = vi.fn();

// Reset all mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
});

// Cleanup after each test
afterEach(() => {
  vi.restoreAllMocks();
});
