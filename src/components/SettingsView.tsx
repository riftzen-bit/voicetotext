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
  const [navCollapsed, setNavCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem("vtt.navCollapsed") === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    document.body.style.background = "var(--bg-raised)";
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("vtt.navCollapsed", navCollapsed ? "1" : "0");
    } catch {}
  }, [navCollapsed]);

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

      <div className={`settings-body${navCollapsed ? " nav-collapsed" : ""}`}>
        <nav className={`settings-nav${navCollapsed ? " is-collapsed" : ""}`}>
          <div className="nav-header">
            <div className="nav-eyebrow">Sections</div>
            <button
              type="button"
              className="nav-collapse-btn"
              onClick={() => setNavCollapsed((c) => !c)}
              aria-label={navCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={navCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <svg viewBox="0 0 12 12" fill="none" aria-hidden="true">
                {navCollapsed ? (
                  <polyline points="4.5,2.5 8,6 4.5,9.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                ) : (
                  <polyline points="7.5,2.5 4,6 7.5,9.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                )}
              </svg>
            </button>
          </div>
          {NAV.map((item, i) => (
            <button
              key={item.id}
              type="button"
              className={`nav-item${active === item.id ? " is-active" : ""}`}
              onClick={() => setActive(item.id)}
              title={navCollapsed ? item.label : undefined}
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
