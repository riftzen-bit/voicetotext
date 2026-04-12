import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useClipboardHistory } from '../../hooks/useClipboardHistory';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('useClipboardHistory', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it('starts with empty history', () => {
    const { result } = renderHook(() => useClipboardHistory());
    expect(result.current.history).toEqual([]);
    expect(result.current.loaded).toBe(true);
  });

  it('adds entry to history', () => {
    const { result } = renderHook(() => useClipboardHistory());

    act(() => {
      result.current.addEntry('test text', 'transcription');
    });

    expect(result.current.history).toHaveLength(1);
    expect(result.current.history[0].text).toBe('test text');
    expect(result.current.history[0].source).toBe('transcription');
  });

  it('adds entry with template', () => {
    const { result } = renderHook(() => useClipboardHistory());

    act(() => {
      result.current.addEntry('test text', 'transcription', 'Professional');
    });

    expect(result.current.history[0].template).toBe('Professional');
  });

  it('ignores empty text', () => {
    const { result } = renderHook(() => useClipboardHistory());

    act(() => {
      result.current.addEntry('', 'transcription');
      result.current.addEntry('   ', 'transcription');
    });

    expect(result.current.history).toHaveLength(0);
  });

  it('removes duplicate entries within a minute', () => {
    const { result } = renderHook(() => useClipboardHistory());

    act(() => {
      result.current.addEntry('same text', 'transcription');
      result.current.addEntry('same text', 'transcription');
    });

    expect(result.current.history).toHaveLength(1);
  });

  it('removes entry by id', () => {
    const { result } = renderHook(() => useClipboardHistory());

    act(() => {
      result.current.addEntry('text 1', 'transcription');
      result.current.addEntry('text 2', 'transcription');
    });

    const idToRemove = result.current.history[0].id;

    act(() => {
      result.current.removeEntry(idToRemove);
    });

    expect(result.current.history).toHaveLength(1);
    expect(result.current.history[0].text).toBe('text 1');
  });

  it('clears all history', () => {
    const { result } = renderHook(() => useClipboardHistory());

    act(() => {
      result.current.addEntry('text 1', 'transcription');
      result.current.addEntry('text 2', 'transcription');
    });

    act(() => {
      result.current.clearHistory();
    });

    expect(result.current.history).toHaveLength(0);
  });

  it('searches history by query', () => {
    const { result } = renderHook(() => useClipboardHistory());

    act(() => {
      result.current.addEntry('hello world', 'transcription');
      result.current.addEntry('goodbye world', 'transcription');
      result.current.addEntry('test text', 'transcription');
    });

    const searchResults = result.current.searchHistory('world');
    expect(searchResults).toHaveLength(2);
  });

  it('persists history to localStorage', () => {
    const { result } = renderHook(() => useClipboardHistory());

    act(() => {
      result.current.addEntry('persistent text', 'transcription');
    });

    expect(localStorageMock.setItem).toHaveBeenCalled();
    const savedData = localStorageMock.setItem.mock.calls.pop();
    expect(savedData[0]).toBe('vtt-clipboard-history');
    expect(savedData[1]).toContain('persistent text');
  });

  it('limits history to max items', () => {
    const { result } = renderHook(() => useClipboardHistory());

    // Add more than 50 items
    act(() => {
      for (let i = 0; i < 55; i++) {
        result.current.addEntry(`text ${i}`, 'manual');
      }
    });

    expect(result.current.history.length).toBeLessThanOrEqual(50);
  });
});
