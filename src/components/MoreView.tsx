import type React from "react";

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

export default function MoreView({ items, onNavigate }: MoreViewProps) {
  return (
    <div className="more-panel">
      <header className="more-header">
        <h1 className="more-title">More Features</h1>
        <p className="more-subtitle">
          Every auxiliary page lives here. Pick one to open it.
        </p>
      </header>

      <div className="more-grid">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className="more-card"
            onClick={() => onNavigate(item.id)}
          >
            <span className="more-card-icon">{item.icon}</span>
            <span className="more-card-body">
              <span className="more-card-label">{item.label}</span>
              <span className="more-card-description">{item.description}</span>
            </span>
            <svg
              className="more-card-chevron"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        ))}
      </div>
    </div>
  );
}
