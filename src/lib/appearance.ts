export type ThemeMode = "system" | "dark" | "light";
export type AccentColor =
  | "gold" | "blue" | "green" | "purple" | "red" | "orange"
  | "pink" | "teal" | "cyan" | "indigo" | "rose" | "slate"
  | "emerald" | "violet" | "fuchsia" | "amber";
export type OverlaySize = "compact" | "normal" | "large";
export type OverlayPosition = "top-right" | "top-left" | "bottom-right" | "bottom-left";

export interface AppearanceSettings {
  theme: ThemeMode;
  accentColor: AccentColor;
  overlaySize: OverlaySize;
  overlayPosition: OverlayPosition;
  overlayOpacity: number;
  showOverlayTooltip: boolean;
  animationsEnabled: boolean;
  reducedMotion: boolean;
}

export const ACCENT_COLORS: Record<
  AccentColor,
  { name: string; value: string; category: "warm" | "cool" | "neutral" }
> = {
  gold: { name: "Champagne Gold", value: "#C4A052", category: "warm" },
  amber: { name: "Amber", value: "#F59E0B", category: "warm" },
  orange: { name: "Tangerine", value: "#EA580C", category: "warm" },
  red: { name: "Ruby", value: "#DC2626", category: "warm" },
  rose: { name: "Rose", value: "#E11D48", category: "warm" },
  pink: { name: "Sakura Pink", value: "#EC4899", category: "warm" },
  fuchsia: { name: "Fuchsia", value: "#C026D3", category: "warm" },
  violet: { name: "Violet", value: "#7C3AED", category: "cool" },
  purple: { name: "Amethyst", value: "#9333EA", category: "cool" },
  indigo: { name: "Indigo", value: "#4F46E5", category: "cool" },
  blue: { name: "Ocean Blue", value: "#2563EB", category: "cool" },
  cyan: { name: "Cyan", value: "#0891B2", category: "cool" },
  teal: { name: "Teal", value: "#0D9488", category: "cool" },
  emerald: { name: "Emerald", value: "#059669", category: "cool" },
  green: { name: "Forest Green", value: "#16A34A", category: "cool" },
  slate: { name: "Slate", value: "#64748B", category: "neutral" },
};

export const DEFAULT_APPEARANCE: AppearanceSettings = {
  theme: "system",
  accentColor: "gold",
  overlaySize: "normal",
  overlayPosition: "top-right",
  overlayOpacity: 100,
  showOverlayTooltip: true,
  animationsEnabled: true,
  reducedMotion: false,
};

export function adjustBrightness(hex: string, percent: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + percent));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + percent));
  const b = Math.min(255, Math.max(0, (num & 0x0000ff) + percent));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

export function applyAppearance(appearance: AppearanceSettings): void {
  const root = document.documentElement;

  if (appearance.theme === "system") {
    root.removeAttribute("data-theme");
  } else {
    root.setAttribute("data-theme", appearance.theme);
  }

  const colorEntry = ACCENT_COLORS[appearance.accentColor] ?? ACCENT_COLORS.gold;
  const colorValue = colorEntry.value;
  root.style.setProperty("--accent", colorValue);
  root.style.setProperty("--accent-hover", adjustBrightness(colorValue, 20));
  root.style.setProperty("--accent-muted", adjustBrightness(colorValue, -20));
  root.style.setProperty("--accent-subtle", `${colorValue}1e`);
  root.style.setProperty("--accent-ghost", `${colorValue}0f`);

  if (appearance.reducedMotion || !appearance.animationsEnabled) {
    root.style.setProperty("--duration-fast", "0ms");
    root.style.setProperty("--duration-normal", "0ms");
    root.style.setProperty("--duration-slow", "0ms");
  } else {
    root.style.removeProperty("--duration-fast");
    root.style.removeProperty("--duration-normal");
    root.style.removeProperty("--duration-slow");
  }

  root.style.setProperty("--overlay-opacity", String(appearance.overlayOpacity / 100));
  root.setAttribute("data-overlay-size", appearance.overlaySize);
  root.setAttribute("data-overlay-position", appearance.overlayPosition);
}
