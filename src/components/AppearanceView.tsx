import { useEffect, useState } from "react";
import {
  Palette,
  Sun,
  Moon,
  MonitorSmartphone,
  Pin,
  Zap,
} from "lucide-react";
import { useSettings } from "../hooks/useSettings";
import {
  ACCENT_COLORS,
  AccentColor,
  AppearanceSettings,
  DEFAULT_APPEARANCE,
  OverlayPosition,
  OverlaySize,
  ThemeMode,
  applyAppearance,
} from "../lib/appearance";

export default function AppearanceView() {
  const { settings, updateSetting } = useSettings();
  const [appearance, setAppearance] = useState<AppearanceSettings>(DEFAULT_APPEARANCE);

  useEffect(() => {
    const saved = settings.appearance as Partial<AppearanceSettings> | undefined;
    setAppearance({ ...DEFAULT_APPEARANCE, ...(saved || {}) });
  }, [settings.appearance]);

  useEffect(() => {
    applyAppearance(appearance);
  }, [appearance]);

  const updateAppearance = async <K extends keyof AppearanceSettings>(
    key: K,
    value: AppearanceSettings[K],
  ) => {
    const next = { ...appearance, [key]: value };
    setAppearance(next);
    applyAppearance(next);
    await updateSetting("appearance", next);
  };

  const categories: Array<{ id: "warm" | "cool" | "neutral"; label: string }> = [
    { id: "warm", label: "Warm" },
    { id: "cool", label: "Cool" },
    { id: "neutral", label: "Neutral" },
  ];

  const themeOptions: Array<{
    value: ThemeMode;
    label: string;
    hint: string;
    Icon: typeof Sun;
  }> = [
    { value: "system", label: "System", hint: "Match your OS theme", Icon: MonitorSmartphone },
    { value: "dark", label: "Dark", hint: "Low-light comfort", Icon: Moon },
    { value: "light", label: "Light", hint: "Bright daytime mode", Icon: Sun },
  ];

  return (
    <div className="appearance-view feature-view feature-view--wide">
      <header className="feature-hero">
        <span className="feature-medallion tone-red" aria-hidden>
          <Palette />
        </span>
        <div className="feature-hero-body">
          <span className="feature-hero-eyebrow">Appearance</span>
          <h1 className="feature-hero-title">Look and feel</h1>
          <p className="feature-hero-description">
            Tune the theme, accent tone, and floating indicator. Changes apply
            instantly and sync across every window.
          </p>
          <div className="feature-hero-meta">
            <span className="feature-chip accent">
              {ACCENT_COLORS[appearance.accentColor].name}
            </span>
            <span className="feature-chip">
              {appearance.theme === "system"
                ? "Auto theme"
                : appearance.theme === "dark"
                  ? "Dark theme"
                  : "Light theme"}
            </span>
          </div>
        </div>
      </header>

      <section className="feature-card feature-card--flat">
        <h3 className="feature-section-title">Theme</h3>
        <div className="appearance-theme-grid">
          {themeOptions.map(({ value, label, hint, Icon }) => {
            const active = appearance.theme === value;
            return (
              <button
                key={value}
                className={`appearance-theme-btn ${active ? "active" : ""}`}
                onClick={() => updateAppearance("theme", value)}
              >
                <span className={`appearance-theme-preview ${value}`}>
                  <Icon />
                </span>
                <span className="appearance-theme-label">{label}</span>
                <span className="appearance-theme-hint">{hint}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="feature-card feature-card--flat">
        <h3 className="feature-section-title">Accent colour</h3>
        <p className="feature-section-hint">
          Pick a highlight tone. Saved instantly and shared across every window.
        </p>

        {categories.map(({ id, label }) => (
          <div className="appearance-color-group" key={id}>
            <span className="appearance-color-group-label">{label}</span>
            <div className="appearance-color-grid">
              {(Object.entries(ACCENT_COLORS) as [AccentColor, typeof ACCENT_COLORS[AccentColor]][])
                .filter(([, v]) => v.category === id)
                .map(([key, v]) => (
                  <button
                    key={key}
                    className={`appearance-swatch ${appearance.accentColor === key ? "active" : ""}`}
                    onClick={() => updateAppearance("accentColor", key)}
                    title={v.name}
                    aria-label={v.name}
                    style={{ ["--swatch-color" as string]: v.value } as React.CSSProperties}
                  >
                    <span className="appearance-swatch-ring">
                      <span className="appearance-swatch-fill" />
                    </span>
                  </button>
                ))}
            </div>
          </div>
        ))}

        <div className="appearance-current-color">
          <span
            className="appearance-current-color-swatch"
            style={{ background: ACCENT_COLORS[appearance.accentColor].value }}
          />
          <span className="appearance-current-color-name">
            {ACCENT_COLORS[appearance.accentColor].name}
          </span>
        </div>
      </section>

      <section className="feature-card feature-card--flat">
        <h3 className="feature-section-title">
          <Pin size={18} strokeWidth={2} /> Floating indicator
        </h3>

        <div className="feature-field-row">
          <div className="feature-field-info">
            <span className="feature-field-label">Size</span>
            <span className="feature-field-hint">Overlay dimensions</span>
          </div>
          <select
            className="feature-select"
            value={appearance.overlaySize}
            onChange={(e) => updateAppearance("overlaySize", e.target.value as OverlaySize)}
          >
            <option value="compact">Compact</option>
            <option value="normal">Normal</option>
            <option value="large">Large</option>
          </select>
        </div>

        <div className="feature-field-row">
          <div className="feature-field-info">
            <span className="feature-field-label">Position</span>
            <span className="feature-field-hint">Screen corner</span>
          </div>
          <select
            className="feature-select"
            value={appearance.overlayPosition}
            onChange={(e) =>
              updateAppearance("overlayPosition", e.target.value as OverlayPosition)
            }
          >
            <option value="top-right">Top right</option>
            <option value="top-left">Top left</option>
            <option value="bottom-right">Bottom right</option>
            <option value="bottom-left">Bottom left</option>
          </select>
        </div>

        <div className="feature-field-row">
          <div className="feature-field-info">
            <span className="feature-field-label">Opacity</span>
            <span className="feature-field-hint">{appearance.overlayOpacity}%</span>
          </div>
          <div className="appearance-slider">
            <input
              type="range"
              min={30}
              max={100}
              value={appearance.overlayOpacity}
              onChange={(e) => updateAppearance("overlayOpacity", Number(e.target.value))}
            />
          </div>
        </div>

        <div className="feature-field-row">
          <div className="feature-field-info">
            <span className="feature-field-label">Show tooltip</span>
            <span className="feature-field-hint">Status text on hover</span>
          </div>
          <div
            role="switch"
            aria-checked={appearance.showOverlayTooltip}
            className={`toggle-switch ${appearance.showOverlayTooltip ? "active" : ""}`}
            onClick={() =>
              updateAppearance("showOverlayTooltip", !appearance.showOverlayTooltip)
            }
          />
        </div>
      </section>

      <section className="feature-card feature-card--flat">
        <h3 className="feature-section-title">
          <Zap size={18} strokeWidth={2} /> Motion
        </h3>

        <div className="feature-field-row">
          <div className="feature-field-info">
            <span className="feature-field-label">Animations</span>
            <span className="feature-field-hint">Enable UI animations</span>
          </div>
          <div
            role="switch"
            aria-checked={appearance.animationsEnabled}
            className={`toggle-switch ${appearance.animationsEnabled ? "active" : ""}`}
            onClick={() =>
              updateAppearance("animationsEnabled", !appearance.animationsEnabled)
            }
          />
        </div>

        <div className="feature-field-row">
          <div className="feature-field-info">
            <span className="feature-field-label">Reduced motion</span>
            <span className="feature-field-hint">Minimise motion for accessibility</span>
          </div>
          <div
            role="switch"
            aria-checked={appearance.reducedMotion}
            className={`toggle-switch ${appearance.reducedMotion ? "active" : ""}`}
            onClick={() => updateAppearance("reducedMotion", !appearance.reducedMotion)}
          />
        </div>
      </section>
    </div>
  );
}
