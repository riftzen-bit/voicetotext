import { useSettings } from "../../hooks/useSettings";
import { Section, Row, Segmented, Toggle } from "./primitives";

interface AppearanceSettings {
  theme: "system" | "dark" | "light";
  accentColor: string;
  reducedMotion: boolean;
}

const DEFAULTS: AppearanceSettings = {
  theme: "dark",
  accentColor: "gold",
  reducedMotion: false,
};

const ACCENT_SWATCHES: Array<{ id: string; color: string; label: string }> = [
  { id: "gold", color: "#C4A052", label: "Gold" },
  { id: "blue", color: "#4A90A4", label: "Steel" },
  { id: "green", color: "#5C9A6B", label: "Sage" },
  { id: "purple", color: "#8B6BA4", label: "Mauve" },
  { id: "red", color: "#B54A47", label: "Clay" },
  { id: "orange", color: "#C4782A", label: "Amber" },
];

export default function AppearanceSection() {
  const { settings, loaded, updateSetting } = useSettings();
  if (!loaded) return null;

  const appearance: AppearanceSettings = {
    ...DEFAULTS,
    ...((settings.appearance as Partial<AppearanceSettings>) || {}),
  };

  const set = <K extends keyof AppearanceSettings>(
    key: K,
    value: AppearanceSettings[K]
  ) => {
    updateSetting("appearance", { ...appearance, [key]: value });
  };

  return (
    <Section
      num="07"
      eyebrow="Appearance"
      title="Look and feel"
      lede="Everything else keeps its warm-graphite neutrals. Only the single accent you pick here is used throughout the interface."
    >
      <Row label="Theme">
        <Segmented
          value={appearance.theme}
          options={[
            { value: "system", label: "System" },
            { value: "dark", label: "Dark" },
            { value: "light", label: "Light" },
          ]}
          onChange={(v) => set("theme", v)}
        />
      </Row>

      <Row label="Accent" hint="Applied to active nav items, focus rings, and the overlay LED.">
        <div className="swatch-row">
          {ACCENT_SWATCHES.map((s) => (
            <button
              key={s.id}
              type="button"
              aria-label={s.label}
              title={s.label}
              className={`swatch${appearance.accentColor === s.id ? " is-active" : ""}`}
              style={{ background: s.color }}
              onClick={() => set("accentColor", s.id)}
            />
          ))}
        </div>
      </Row>

      <Row label="Reduce motion" hint="Disable breathing and pulse animations.">
        <Toggle
          checked={appearance.reducedMotion}
          onChange={(v) => set("reducedMotion", v)}
        />
      </Row>
    </Section>
  );
}
