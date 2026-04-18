import { ReactNode, useEffect, useRef, useState } from "react";

export function Section({
  num,
  eyebrow,
  title,
  lede,
  children,
}: {
  num: string;
  eyebrow: string;
  title: string;
  lede?: string;
  children: ReactNode;
}) {
  return (
    <section className="section">
      <div className="section-eyebrow">
        <span className="section-eyebrow-num">{num}</span>
        <span>{eyebrow}</span>
        <span className="section-eyebrow-rule" />
      </div>
      <h1 className="section-title">{title}</h1>
      {lede ? <p className="section-lede">{lede}</p> : null}
      {children}
    </section>
  );
}

export function Row({
  label,
  hint,
  children,
  stacked,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  stacked?: boolean;
}) {
  return (
    <div className={`row${stacked ? " row--stacked" : ""}`}>
      <div>
        <div className="row-label">{label}</div>
        {hint ? <div className="row-hint">{hint}</div> : null}
      </div>
      <div className="row-control">{children}</div>
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: string;
}) {
  return (
    <label className={`toggle${checked ? " is-on" : ""}`} aria-label={label}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (v: T) => void;
}) {
  return (
    <div className="btn-group">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={`seg${opt.value === value ? " is-active" : ""}`}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

const MODIFIER_KEYS = new Set(["Control", "Shift", "Alt", "Meta"]);

function formatAccelerator(keys: string[]): string {
  return keys.join("+");
}

function eventToAccelerator(e: KeyboardEvent): string | null {
  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push("CommandOrControl");
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey) parts.push("Shift");
  const key = e.key;
  if (MODIFIER_KEYS.has(key)) return null;
  let normal = key.length === 1 ? key.toUpperCase() : key;
  if (normal === " ") normal = "Space";
  parts.push(normal);
  return formatAccelerator(parts);
}

export function KeyCapture({
  value,
  onChange,
  placeholder = "Click to record",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [listening, setListening] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!listening) return;
    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Escape") {
        setListening(false);
        return;
      }
      const accel = eventToAccelerator(e);
      if (accel) {
        onChange(accel);
        setListening(false);
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [listening, onChange]);

  return (
    <button
      ref={btnRef}
      type="button"
      className={`kbd-capture${listening ? " is-listening" : ""}`}
      onClick={() => setListening((v) => !v)}
    >
      {listening ? "Press keys…" : value || placeholder}
    </button>
  );
}
