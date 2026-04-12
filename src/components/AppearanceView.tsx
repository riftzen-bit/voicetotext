import { useState, useEffect } from "react";
import { useSettings } from "../hooks/useSettings";

type ThemeMode = "system" | "dark" | "light";
type AccentColor =
  | "gold" | "blue" | "green" | "purple" | "red" | "orange"
  | "pink" | "teal" | "cyan" | "indigo" | "rose" | "slate"
  | "emerald" | "violet" | "fuchsia" | "amber";
type OverlaySize = "compact" | "normal" | "large";
type OverlayPosition = "top-right" | "top-left" | "bottom-right" | "bottom-left";

interface AppearanceSettings {
  theme: ThemeMode;
  accentColor: AccentColor;
  overlaySize: OverlaySize;
  overlayPosition: OverlayPosition;
  overlayOpacity: number;
  showOverlayTooltip: boolean;
  animationsEnabled: boolean;
  reducedMotion: boolean;
}

const ACCENT_COLORS: Record<AccentColor, { name: string; value: string; category: string }> = {
  // Warm tones
  gold: { name: "Champagne Gold", value: "#C4A052", category: "warm" },
  amber: { name: "Amber", value: "#F59E0B", category: "warm" },
  orange: { name: "Tangerine", value: "#EA580C", category: "warm" },
  red: { name: "Ruby", value: "#DC2626", category: "warm" },
  rose: { name: "Rose", value: "#E11D48", category: "warm" },
  pink: { name: "Sakura Pink", value: "#EC4899", category: "warm" },
  fuchsia: { name: "Fuchsia", value: "#C026D3", category: "warm" },

  // Cool tones
  violet: { name: "Violet", value: "#7C3AED", category: "cool" },
  purple: { name: "Amethyst", value: "#9333EA", category: "cool" },
  indigo: { name: "Indigo", value: "#4F46E5", category: "cool" },
  blue: { name: "Ocean Blue", value: "#2563EB", category: "cool" },
  cyan: { name: "Cyan", value: "#0891B2", category: "cool" },
  teal: { name: "Teal", value: "#0D9488", category: "cool" },
  emerald: { name: "Emerald", value: "#059669", category: "cool" },
  green: { name: "Forest Green", value: "#16A34A", category: "cool" },

  // Neutral
  slate: { name: "Slate", value: "#64748B", category: "neutral" },
};

const DEFAULT_APPEARANCE: AppearanceSettings = {
  theme: "system",
  accentColor: "gold",
  overlaySize: "normal",
  overlayPosition: "top-right",
  overlayOpacity: 100,
  showOverlayTooltip: true,
  animationsEnabled: true,
  reducedMotion: false,
};

// Helper function to adjust color brightness (moved outside for hoisting)
const adjustBrightness = (hex: string, percent: number): string => {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + percent));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + percent));
  const b = Math.min(255, Math.max(0, (num & 0x0000ff) + percent));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
};

export default function AppearanceView() {
  const { settings, updateSetting } = useSettings();
  const [appearance, setAppearance] = useState<AppearanceSettings>(DEFAULT_APPEARANCE);

  useEffect(() => {
    const saved = settings.appearance as AppearanceSettings | undefined;
    if (saved) {
      setAppearance({ ...DEFAULT_APPEARANCE, ...saved });
    }
  }, [settings.appearance]);

  // Apply all appearance settings on initial load and when appearance changes
  useEffect(() => {
    const root = document.documentElement;

    // Apply theme
    if (appearance.theme === "system") {
      root.removeAttribute("data-theme");
    } else {
      root.setAttribute("data-theme", appearance.theme);
    }

    // Apply accent color
    const colorValue = ACCENT_COLORS[appearance.accentColor].value;
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
  }, [appearance]);

  const updateAppearance = async <K extends keyof AppearanceSettings>(
    key: K,
    value: AppearanceSettings[K]
  ) => {
    const newAppearance = { ...appearance, [key]: value };
    setAppearance(newAppearance);
    await updateSetting("appearance", newAppearance);

    // Apply theme changes immediately
    if (key === "theme") {
      applyTheme(value as ThemeMode);
    } else if (key === "accentColor") {
      applyAccentColor(value as AccentColor);
    } else if (key === "reducedMotion") {
      applyReducedMotion(value as boolean);
    }
  };

  const applyTheme = (theme: ThemeMode) => {
    const root = document.documentElement;
    if (theme === "system") {
      root.removeAttribute("data-theme");
    } else {
      root.setAttribute("data-theme", theme);
    }
  };

  const applyAccentColor = (color: AccentColor) => {
    const root = document.documentElement;
    const colorValue = ACCENT_COLORS[color].value;
    root.style.setProperty("--accent", colorValue);
    root.style.setProperty("--accent-muted", adjustBrightness(colorValue, -20));
    root.style.setProperty("--accent-subtle", `${colorValue}1e`);
    root.style.setProperty("--accent-ghost", `${colorValue}0f`);
  };

  const applyReducedMotion = (reduced: boolean) => {
    const root = document.documentElement;
    if (reduced) {
      root.style.setProperty("--duration-fast", "0ms");
      root.style.setProperty("--duration-normal", "0ms");
      root.style.setProperty("--duration-slow", "0ms");
    } else {
      root.style.removeProperty("--duration-fast");
      root.style.removeProperty("--duration-normal");
      root.style.removeProperty("--duration-slow");
    }
  };

  return (
    <div className="appearance-view">
      <h2 className="section-header">Appearance</h2>
      <p className="section-description">
        Customize the look and feel of VoiceToText.
      </p>

      {/* Theme */}
      <div className="settings-section">
        <h3 className="subsection-header">Theme</h3>
        <div className="theme-options">
          {([
            { value: "system", label: "System", icon: "auto" },
            { value: "dark", label: "Dark", icon: "dark" },
            { value: "light", label: "Light", icon: "light" },
          ] as const).map((theme) => (
            <button
              key={theme.value}
              className={`theme-btn ${appearance.theme === theme.value ? "active" : ""}`}
              onClick={() => updateAppearance("theme", theme.value)}
            >
              <div className={`theme-preview ${theme.value}`}>
                {theme.icon === "auto" && (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="5" />
                    <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                  </svg>
                )}
                {theme.icon === "dark" && (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                  </svg>
                )}
                {theme.icon === "light" && (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="5" />
                    <line x1="12" y1="1" x2="12" y2="3" />
                    <line x1="12" y1="21" x2="12" y2="23" />
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                    <line x1="1" y1="12" x2="3" y2="12" />
                    <line x1="21" y1="12" x2="23" y2="12" />
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                  </svg>
                )}
              </div>
              <span className="theme-label">{theme.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Accent Color */}
      <div className="settings-section">
        <h3 className="subsection-header">Accent Color</h3>
        <p className="section-description" style={{ marginBottom: "16px" }}>
          Choose a color that reflects your style.
        </p>

        {/* Warm Colors */}
        <div className="color-category">
          <span className="color-category-label">Warm</span>
          <div className="color-grid">
            {(Object.entries(ACCENT_COLORS) as [AccentColor, { name: string; value: string; category: string }][])
              .filter(([, { category }]) => category === "warm")
              .map(([key, { name, value }]) => (
                <button
                  key={key}
                  className={`color-swatch-btn ${appearance.accentColor === key ? "active" : ""}`}
                  onClick={() => updateAppearance("accentColor", key)}
                  title={name}
                  style={{ "--swatch-color": value } as React.CSSProperties}
                >
                  <span className="swatch-ring">
                    <span className="swatch-fill" />
                  </span>
                </button>
              ))}
          </div>
        </div>

        {/* Cool Colors */}
        <div className="color-category">
          <span className="color-category-label">Cool</span>
          <div className="color-grid">
            {(Object.entries(ACCENT_COLORS) as [AccentColor, { name: string; value: string; category: string }][])
              .filter(([, { category }]) => category === "cool")
              .map(([key, { name, value }]) => (
                <button
                  key={key}
                  className={`color-swatch-btn ${appearance.accentColor === key ? "active" : ""}`}
                  onClick={() => updateAppearance("accentColor", key)}
                  title={name}
                  style={{ "--swatch-color": value } as React.CSSProperties}
                >
                  <span className="swatch-ring">
                    <span className="swatch-fill" />
                  </span>
                </button>
              ))}
          </div>
        </div>

        {/* Neutral Colors */}
        <div className="color-category">
          <span className="color-category-label">Neutral</span>
          <div className="color-grid">
            {(Object.entries(ACCENT_COLORS) as [AccentColor, { name: string; value: string; category: string }][])
              .filter(([, { category }]) => category === "neutral")
              .map(([key, { name, value }]) => (
                <button
                  key={key}
                  className={`color-swatch-btn ${appearance.accentColor === key ? "active" : ""}`}
                  onClick={() => updateAppearance("accentColor", key)}
                  title={name}
                  style={{ "--swatch-color": value } as React.CSSProperties}
                >
                  <span className="swatch-ring">
                    <span className="swatch-fill" />
                  </span>
                </button>
              ))}
          </div>
        </div>

        {/* Current color display */}
        <div className="current-color-display">
          <span
            className="current-color-preview"
            style={{ background: ACCENT_COLORS[appearance.accentColor].value }}
          />
          <span className="current-color-name">
            {ACCENT_COLORS[appearance.accentColor].name}
          </span>
        </div>
      </div>

      {/* Overlay Settings */}
      <div className="settings-section">
        <h3 className="subsection-header">Floating Indicator</h3>

        <div className="field-row">
          <div className="field-info">
            <span className="field-label">Size</span>
            <span className="field-hint">Indicator dimensions</span>
          </div>
          <select
            className="form-select"
            value={appearance.overlaySize}
            onChange={(e) => updateAppearance("overlaySize", e.target.value as OverlaySize)}
          >
            <option value="compact">Compact (44px)</option>
            <option value="normal">Normal (52px)</option>
            <option value="large">Large (64px)</option>
          </select>
        </div>

        <div className="field-row">
          <div className="field-info">
            <span className="field-label">Position</span>
            <span className="field-hint">Screen corner for indicator</span>
          </div>
          <select
            className="form-select"
            value={appearance.overlayPosition}
            onChange={(e) => updateAppearance("overlayPosition", e.target.value as OverlayPosition)}
          >
            <option value="top-right">Top Right</option>
            <option value="top-left">Top Left</option>
            <option value="bottom-right">Bottom Right</option>
            <option value="bottom-left">Bottom Left</option>
          </select>
        </div>

        <div className="field-row">
          <div className="field-info">
            <span className="field-label">Opacity</span>
            <span className="field-hint">{appearance.overlayOpacity}%</span>
          </div>
          <div className="slider-container">
            <input
              type="range"
              min="30"
              max="100"
              value={appearance.overlayOpacity}
              onChange={(e) => updateAppearance("overlayOpacity", Number(e.target.value))}
              className="slider"
            />
          </div>
        </div>

        <div className="field-row">
          <div className="field-info">
            <span className="field-label">Show Tooltip</span>
            <span className="field-hint">Display status on hover</span>
          </div>
          <div
            className={`toggle-switch ${appearance.showOverlayTooltip ? "active" : ""}`}
            onClick={() => updateAppearance("showOverlayTooltip", !appearance.showOverlayTooltip)}
          />
        </div>
      </div>

      {/* Motion Settings */}
      <div className="settings-section">
        <h3 className="subsection-header">Motion</h3>

        <div className="field-row">
          <div className="field-info">
            <span className="field-label">Animations</span>
            <span className="field-hint">Enable UI animations</span>
          </div>
          <div
            className={`toggle-switch ${appearance.animationsEnabled ? "active" : ""}`}
            onClick={() => updateAppearance("animationsEnabled", !appearance.animationsEnabled)}
          />
        </div>

        <div className="field-row">
          <div className="field-info">
            <span className="field-label">Reduced Motion</span>
            <span className="field-hint">Minimize motion for accessibility</span>
          </div>
          <div
            className={`toggle-switch ${appearance.reducedMotion ? "active" : ""}`}
            onClick={() => updateAppearance("reducedMotion", !appearance.reducedMotion)}
          />
        </div>
      </div>
    </div>
  );
}
