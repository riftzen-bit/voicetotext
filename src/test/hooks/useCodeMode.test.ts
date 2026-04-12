import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useCodeMode } from '../../hooks/useCodeMode';
import { mockVttApi, configureMockSettings } from '../mocks/vttApi';

describe('useCodeMode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    configureMockSettings({ codeMode: false });
  });

  it('returns initial codeMode as false', async () => {
    const { result } = renderHook(() => useCodeMode());

    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
    });

    expect(result.current.codeMode).toBe(false);
  });

  it('loads codeMode from settings', async () => {
    configureMockSettings({ codeMode: true });

    const { result } = renderHook(() => useCodeMode());

    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
    });

    expect(result.current.codeMode).toBe(true);
  });

  it('toggleCodeMode flips the value', async () => {
    const { result } = renderHook(() => useCodeMode());

    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
    });

    expect(result.current.codeMode).toBe(false);

    await act(async () => {
      await result.current.toggleCodeMode();
    });

    expect(result.current.codeMode).toBe(true);
    expect(mockVttApi.setSetting).toHaveBeenCalledWith('codeMode', true);
  });

  it('setCodeMode sets value directly', async () => {
    const { result } = renderHook(() => useCodeMode());

    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
    });

    await act(async () => {
      await result.current.setCodeMode(true);
    });

    expect(result.current.codeMode).toBe(true);
    expect(mockVttApi.setSetting).toHaveBeenCalledWith('codeMode', true);

    await act(async () => {
      await result.current.setCodeMode(false);
    });

    expect(result.current.codeMode).toBe(false);
    expect(mockVttApi.setSetting).toHaveBeenCalledWith('codeMode', false);
  });
});
