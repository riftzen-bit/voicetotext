import type React from "react";
import { ChevronRight } from "lucide-react";

export interface MoreViewItem {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
}

interface MoreViewProps {
  items: MoreViewItem[];
  onNavigate: (id: string) => void;
}

type GroupId = "intelligence" | "library" | "system";

const GROUPS: Array<{ id: GroupId; label: string; description: string; ids: string[] }> = [
  {
    id: "intelligence",
    label: "Intelligence",
    description: "Prompts, refinement rules, and vocabulary that shape the output.",
    ids: ["templates", "formatting", "keywords", "phrases"],
  },
  {
    id: "library",
    label: "Library",
    description: "Usage data, exports, and saved transcripts.",
    ids: ["analytics", "export"],
  },
  {
    id: "system",
    label: "System",
    description: "Appearance, shortcuts, and app metadata.",
    ids: ["appearance", "shortcuts", "about"],
  },
];

export default function MoreView({ items, onNavigate }: MoreViewProps) {
  const byId = new Map(items.map((item) => [item.id, item]));
  const placed = new Set<string>();

  const sections = GROUPS.map((group) => {
    const rows = group.ids
      .map((id) => byId.get(id))
      .filter((item): item is MoreViewItem => {
        if (!item) return false;
        placed.add(item.id);
        return true;
      });
    return { ...group, rows };
  }).filter((s) => s.rows.length > 0);

  const orphans = items.filter((item) => !placed.has(item.id));

  return (
    <div className="more-panel">
      <header className="more-header">
        <span className="more-eyebrow">Browse</span>
        <h1 className="more-title">More features</h1>
        <p className="more-subtitle">
          Every auxiliary page lives here, grouped by purpose. Pick a corner to dive in.
        </p>
      </header>

      {sections.map((section) => (
        <section className="more-section" key={section.id}>
          <div className="more-section-heading">
            <span className="more-section-eyebrow">{section.label}</span>
            <p className="more-section-hint">{section.description}</p>
          </div>
          <div className="more-grid">
            {section.rows.map((item) => (
              <MoreCard key={item.id} item={item} onNavigate={onNavigate} />
            ))}
          </div>
        </section>
      ))}

      {orphans.length > 0 && (
        <section className="more-section">
          <div className="more-section-heading">
            <span className="more-section-eyebrow">Other</span>
          </div>
          <div className="more-grid">
            {orphans.map((item) => (
              <MoreCard key={item.id} item={item} onNavigate={onNavigate} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function MoreCard({ item, onNavigate }: { item: MoreViewItem; onNavigate: (id: string) => void }) {
  return (
    <button
      type="button"
      className="more-card"
      onClick={() => onNavigate(item.id)}
    >
      <span className="more-card-icon">{item.icon}</span>
      <span className="more-card-body">
        <span className="more-card-label">{item.label}</span>
        <span className="more-card-description">{item.description}</span>
      </span>
      <ChevronRight className="more-card-chevron" size={16} strokeWidth={2} />
    </button>
  );
}
