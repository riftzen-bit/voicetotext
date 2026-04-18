import { useEffect } from "react";
import { useSettings } from "./useSettings";
import {
  AppearanceSettings,
  DEFAULT_APPEARANCE,
  applyAppearance,
} from "../lib/appearance";

/**
 * Applies persisted appearance on every window (overlay, settings, setup).
 * Single source of truth for accent palette, theme, motion, overlay chrome.
 */
export function useGlobalAppearance() {
  const { settings, loaded } = useSettings();

  useEffect(() => {
    if (!loaded) return;
    const saved = (settings.appearance as Partial<AppearanceSettings>) || {};
    applyAppearance({ ...DEFAULT_APPEARANCE, ...saved });
  }, [loaded, settings.appearance]);
}
