import { useEffect, useState } from "react";
import { getApi, KeywordSuggestion } from "../lib/ipc";

/**
 * KeywordSuggestionBanner - Shows suggestions when user corrections are detected.
 * Displays a banner that allows users to quickly add learned keywords.
 */
export default function KeywordSuggestionBanner() {
  const [suggestions, setSuggestions] = useState<KeywordSuggestion[]>([]);
  const [visible, setVisible] = useState(false);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    const api = getApi();
    if (!api) return;

    const unsubscribe = api.onKeywordSuggestion((newSuggestions) => {
      if (newSuggestions && newSuggestions.length > 0) {
        setSuggestions(newSuggestions);
        setVisible(true);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handleAddAll = async () => {
    const api = getApi();
    if (!api) return;

    setAdding(true);
    try {
      for (const suggestion of suggestions) {
        await api.addKeyword({
          trigger: suggestion.original,
          correction: suggestion.corrected,
          caseSensitive: false,
          wholeWord: true,
          source: "learned",
        });
      }
    } finally {
      setAdding(false);
      setVisible(false);
      setSuggestions([]);
    }
  };

  const handleDismiss = () => {
    setVisible(false);
    setSuggestions([]);
  };

  if (!visible || suggestions.length === 0) {
    return null;
  }

  return (
    <div className="suggestion-banner">
      <div className="suggestion-icon">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
        </svg>
      </div>

      <div className="suggestion-content">
        <div className="suggestion-title">Corrections detected</div>
        <div className="suggestion-list">
          {suggestions.map((s, i) => (
            <span key={i} className="suggestion-item">
              <span className="suggestion-original">{s.original}</span>
              <span className="suggestion-arrow">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </span>
              <span className="suggestion-corrected">{s.corrected}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="suggestion-actions">
        <button
          className="btn btn-sm"
          onClick={handleDismiss}
          disabled={adding}
        >
          Dismiss
        </button>
        <button
          className="btn btn-sm btn-primary"
          onClick={handleAddAll}
          disabled={adding}
        >
          {adding ? "Adding..." : "Add to Keywords"}
        </button>
      </div>
    </div>
  );
}
