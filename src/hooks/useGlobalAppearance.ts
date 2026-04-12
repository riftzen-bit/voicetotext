import { useEffect } from "react";
import { useSettings } from "./useSettings";

interface AppearanceSettings {
  theme: "system" | "dark" | "light";
  accentColor: string;
  reducedMotion: boolean;
}

const ACCENT_COLORS: Record<string, string> = {
  gold: "#C4A052",
  blue: "#4A90A4",
  green: "#5C9A6B",
  purple: "#8B6BA4",
  red: "#B54A47",
  orange: "#C4782A",
};

function adjustBrightness(hex: string, percent: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + percent));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + percent));
  const b = Math.min(255, Math.max(0, (num & 0x0000ff) + percent));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

/**
 * Hook that applies global appearance settings (theme, accent color, animations)
 * on app startup and whenever settings change.
 */
export function useGlobalAppearance() {
  const { settings, loaded } = useSettings();

  useEffect(() => {
    if (!loaded) return;

    const appearance = settings.appearance as AppearanceSettings | undefined;
    if (!appearance) return;

    const root = document.documentElement;

    // Apply theme
    if (appearance.theme === "system") {
      root.removeAttribute("data-theme");
    } else {
      root.setAttribute("data-theme", appearance.theme);
    }

    // Apply accent color
    const colorValue = ACCENT_COLORS[appearance.accentColor] || ACCENT_COLORS.gold;
    root.style.setProperty("--accent", colorValue);
    root.style.setProperty("--accent-muted", adjustBrightness(colorValue, -20));
    root.style.setProperty("--accent-subtle", `${colorValue}1e`);
    root.style.setProperty("--accent-ghost", `${colorValue}0f`);

    // Apply reduced motion
    if (appearance.reducedMotion) {
      root.style.setProperty("--duration-fast", "0ms");
      root.style.setProperty("--duration-normal", "0ms");
      root.style.setProperty("--duration-slow", "0ms");
    } else {
      root.style.removeProperty("--duration-fast");
      root.style.removeProperty("--duration-normal");
      root.style.removeProperty("--duration-slow");
    }
  }, [loaded, settings.appearance]);
}
