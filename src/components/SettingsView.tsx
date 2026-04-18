import { useEffect, useState } from "react";
import { getApi } from "../lib/ipc";
import RecordSection from "./settings/RecordSection";
import EngineSection from "./settings/EngineSection";
import RefinementSection from "./settings/RefinementSection";
import FormattingSection from "./settings/FormattingSection";
import KeywordsSection from "./settings/KeywordsSection";
import HistorySection from "./settings/HistorySection";
import AppearanceSection from "./settings/AppearanceSection";
import AboutSection from "./settings/AboutSection";
import "../styles/settings.css";

type SectionId =
  | "record"
  | "engine"
  | "refinement"
  | "formatting"
  | "keywords"
  | "history"
  | "appearance"
  | "about";

const NAV: Array<{ id: SectionId; label: string }> = [
  { id: "record", label: "Record" },
  { id: "engine", label: "Engine" },
  { id: "refinement", label: "Refinement" },
  { id: "formatting", label: "Formatting" },
  { id: "keywords", label: "Keywords" },
  { id: "history", label: "History" },
  { id: "appearance", label: "Appearance" },
  { id: "about", label: "About" },
];

function pad2(n: number) {
  return n.toString().padStart(2, "0");
}

export default function SettingsView() {
  const [active, setActive] = useState<SectionId>("record");

  useEffect(() => {
    document.body.style.background = "var(--bg-raised)";
  }, []);

  return (
    <div className="settings-shell">
      <div className="settings-titlebar">
        <div className="settings-title">
          <span className="settings-title-accent">●</span>
          VoiceToText · Settings
        </div>
        <div className="window-controls">
          <button
            className="window-btn"
            onClick={() => getApi()?.windowMinimize()}
            aria-label="Minimise"
            title="Minimise"
          >
            <svg viewBox="0 0 10 10" fill="none">
              <line x1="1" y1="5" x2="9" y2="5" stroke="currentColor" strokeWidth="1" />
            </svg>
          </button>
          <button
            className="window-btn window-btn--close"
            onClick={() => getApi()?.windowClose()}
            aria-label="Close"
            title="Close"
          >
            <svg viewBox="0 0 10 10" fill="none">
              <line x1="1" y1="1" x2="9" y2="9" stroke="currentColor" strokeWidth="1" />
              <line x1="9" y1="1" x2="1" y2="9" stroke="currentColor" strokeWidth="1" />
            </svg>
          </button>
        </div>
      </div>

      <div className="settings-body">
        <nav className="settings-nav">
          <div className="nav-eyebrow">Sections</div>
          {NAV.map((item, i) => (
            <button
              key={item.id}
              type="button"
              className={`nav-item${active === item.id ? " is-active" : ""}`}
              onClick={() => setActive(item.id)}
            >
              <span className="nav-item-num">{pad2(i + 1)}</span>
              <span className="nav-item-label">{item.label}</span>
            </button>
          ))}
        </nav>

        <main className="settings-main">
          {active === "record" && <RecordSection />}
          {active === "engine" && <EngineSection />}
          {active === "refinement" && <RefinementSection />}
          {active === "formatting" && <FormattingSection />}
          {active === "keywords" && <KeywordsSection />}
          {active === "history" && <HistorySection />}
          {active === "appearance" && <AppearanceSection />}
          {active === "about" && <AboutSection />}
        </main>
      </div>
    </div>
  );
}
