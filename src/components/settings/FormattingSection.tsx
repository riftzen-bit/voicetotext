import { useSettings, AppSettings } from "../../hooks/useSettings";
import { Section, Row, Toggle, Segmented } from "./primitives";

type FormattingOpts = NonNullable<AppSettings["formatting"]>;

const DEFAULTS: FormattingOpts = {
  autoCapitalize: true,
  smartPunctuation: true,
  smartQuotes: true,
  numberFormatting: "auto",
  listDetection: true,
  trimWhitespace: true,
};

export default function FormattingSection() {
  const { settings, loaded, updateSetting } = useSettings();
  if (!loaded) return null;

  const fmt: FormattingOpts = { ...DEFAULTS, ...(settings.formatting || {}) };

  const set = <K extends keyof FormattingOpts>(key: K, value: FormattingOpts[K]) => {
    updateSetting("formatting", { ...fmt, [key]: value });
  };

  return (
    <Section
      num="04"
      eyebrow="Formatting"
      title="Text polish"
      lede="Rules applied after transcription, before the text reaches your cursor."
    >
      <Row label="Auto-capitalize" hint="Start sentences with a capital letter.">
        <Toggle checked={fmt.autoCapitalize} onChange={(v) => set("autoCapitalize", v)} />
      </Row>
      <Row label="Smart punctuation" hint="Insert periods, commas, and question marks where implied.">
        <Toggle
          checked={fmt.smartPunctuation}
          onChange={(v) => set("smartPunctuation", v)}
        />
      </Row>
      <Row label="Smart quotes" hint="Convert straight quotes to curly.">
        <Toggle checked={fmt.smartQuotes} onChange={(v) => set("smartQuotes", v)} />
      </Row>
      <Row label="Numbers" hint="How spoken numbers are rendered.">
        <Segmented
          value={fmt.numberFormatting}
          options={[
            { value: "auto", label: "Auto" },
            { value: "digits", label: "Digits" },
            { value: "words", label: "Words" },
          ]}
          onChange={(v) => set("numberFormatting", v)}
        />
      </Row>
      <Row label="List detection" hint="Turn &quot;first, second, third&quot; sequences into bullets.">
        <Toggle checked={fmt.listDetection} onChange={(v) => set("listDetection", v)} />
      </Row>
      <Row label="Trim whitespace" hint="Collapse runs of spaces and tidy edges.">
        <Toggle checked={fmt.trimWhitespace} onChange={(v) => set("trimWhitespace", v)} />
      </Row>
    </Section>
  );
}
