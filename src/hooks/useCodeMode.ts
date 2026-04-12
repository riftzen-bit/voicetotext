import { useState, useEffect, useCallback } from "react";
import { getApi } from "../lib/ipc";

/**
 * Hook for managing Code Mode state.
 * When Code Mode is active, AI refinement is skipped to preserve exact transcription.
 * This is useful for dictating code, technical terms, or when you want raw output.
 */
export function useCodeMode() {
  const [codeMode, setCodeMode] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Load initial state from settings
  useEffect(() => {
    const api = getApi();
    if (!api) return;

    api.getSettings().then((settings) => {
      setCodeMode(Boolean(settings.codeMode));
      setLoaded(true);
    });

    // Listen for settings changes
    const unsub = api.onSettingsChanged((settings) => {
      setCodeMode(Boolean(settings.codeMode));
    });

    return unsub;
  }, []);

  // Toggle code mode
  const toggleCodeMode = useCallback(async () => {
    const api = getApi();
    if (!api) return;

    const newValue = !codeMode;
    setCodeMode(newValue);
    await api.setSetting("codeMode", newValue);
  }, [codeMode]);

  // Set code mode directly
  const setCodeModeValue = useCallback(async (value: boolean) => {
    const api = getApi();
    if (!api) return;

    setCodeMode(value);
    await api.setSetting("codeMode", value);
  }, []);

  return {
    codeMode,
    loaded,
    toggleCodeMode,
    setCodeMode: setCodeModeValue,
  };
}
