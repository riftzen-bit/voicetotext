import { useMemo, useState } from "react";
import { BarChart3, Sparkles, Flame } from "lucide-react";
import type { TranscriptionEntry, TranscriptionCategory } from "../hooks/useTranscription";

const CATEGORY_LABELS: Record<TranscriptionCategory, { label: string; color: string; icon: string }> = {
  general: { label: "General", color: "#A8A5A0", icon: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" },
  code: { label: "Code", color: "#4A90A4", icon: "M16 18l6-6-6-6M8 6l-6 6 6 6" },
  design: { label: "Design", color: "#8B6BA4", icon: "M12 19l7-7 3 3-7 7-3-3z M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z M2 2l7.586 7.586" },
  meeting: { label: "Meeting", color: "#5C9A6B", icon: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75 M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" },
  note: { label: "Note", color: "#C4A052", icon: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8" },
  command: { label: "Command", color: "#C75450", icon: "M4 17l6-6-6-6 M12 19h8" },
};

interface AnalyticsViewProps {
  entries: TranscriptionEntry[];
}

interface DayStats {
  date: string;
  dayName: string;
  count: number;
  duration: number;
  words: number;
  entries: TranscriptionEntry[];
}

interface WeeklyBadge {
  id: string;
  label: string;
  description: string;
  icon: string;
  earned: boolean;
  progress?: string;
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(w => w.length > 0).length;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  if (mins < 60) return `${mins}m ${secs}s`;
  const hours = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return `${hours}h ${remainMins}m`;
}

function getDateKey(timestamp: number): string {
  const d = new Date(timestamp);
  return d.toISOString().split('T')[0];
}

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatWeekRange(startDate: Date, endDate: Date): string {
  const startStr = startDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const endStr = endDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  return `${startStr} - ${endStr}`;
}

function getDayName(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString(undefined, { weekday: 'short' });
}

function isSameDay(d1: Date, d2: Date): boolean {
  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getDate() === d2.getDate();
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  d.setDate(d.getDate() - day); // Go to Sunday
  return d;
}

function getWeekEnd(weekStart: Date): Date {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + 6); // Saturday
  return d;
}

/**
 * Compute consecutive streak of days with activity ending at today
 */
function computeStreak(entriesByDate: Map<string, number>): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let streak = 0;
  const current = new Date(today);

  const todayKey = current.toISOString().split('T')[0];
  if (!entriesByDate.has(todayKey)) {
    current.setDate(current.getDate() - 1);
  }

  while (true) {
    const key = current.toISOString().split('T')[0];
    if (entriesByDate.has(key) && entriesByDate.get(key)! > 0) {
      streak++;
      current.setDate(current.getDate() - 1);
    } else {
      break;
    }
  }

  return streak;
}

/**
 * Get list of weeks with activity (for week selector)
 */
function getWeeksWithActivity(entries: TranscriptionEntry[]): { weekStart: Date; label: string }[] {
  const weeksSet = new Set<string>();
  const today = new Date();
  const thisWeekStart = getWeekStart(today);

  entries.forEach(e => {
    const entryDate = new Date(e.timestamp);
    const weekStart = getWeekStart(entryDate);
    weeksSet.add(weekStart.toISOString().split('T')[0]);
  });

  // Always include current week
  weeksSet.add(thisWeekStart.toISOString().split('T')[0]);

  const weeks = Array.from(weeksSet)
    .map(dateStr => new Date(dateStr + 'T00:00:00'))
    .sort((a, b) => b.getTime() - a.getTime()) // Most recent first
    .slice(0, 12) // Limit to 12 weeks
    .map(weekStart => {
      const weekEnd = getWeekEnd(weekStart);
      const isThisWeek = isSameDay(weekStart, thisWeekStart);
      const label = isThisWeek ? "This Week" : formatWeekRange(weekStart, weekEnd);
      return { weekStart, label };
    });

  return weeks;
}

export default function AnalyticsView({ entries }: AnalyticsViewProps) {
  const [selectedWeekOffset, setSelectedWeekOffset] = useState(0); // 0 = this week, -1 = last week
  const [showWeekSelector, setShowWeekSelector] = useState(false);

  // Get available weeks
  const availableWeeks = useMemo(() => getWeeksWithActivity(entries), [entries]);

  // Calculate selected week dates
  const { weekStart, weekEnd, weekLabel } = useMemo(() => {
    const today = new Date();
    const thisWeekStart = getWeekStart(today);
    const selectedStart = new Date(thisWeekStart);
    selectedStart.setDate(selectedStart.getDate() + (selectedWeekOffset * 7));
    const selectedEnd = getWeekEnd(selectedStart);

    const isThisWeek = selectedWeekOffset === 0;
    const label = isThisWeek ? "This Week" : formatWeekRange(selectedStart, selectedEnd);

    return { weekStart: selectedStart, weekEnd: selectedEnd, weekLabel: label };
  }, [selectedWeekOffset]);

  // Build entries by date map
  const entriesByDate = useMemo(() => {
    const map = new Map<string, TranscriptionEntry[]>();
    entries.forEach(e => {
      const key = getDateKey(e.timestamp);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    });
    return map;
  }, [entries]);

  // Compute streak
  const currentStreak = useMemo(() => {
    const countMap = new Map<string, number>();
    entries.forEach(e => {
      const key = getDateKey(e.timestamp);
      countMap.set(key, (countMap.get(key) || 0) + 1);
    });
    return computeStreak(countMap);
  }, [entries]);

  // Week stats
  const weekStats = useMemo(() => {
    const days: DayStats[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().split('T')[0];
      const dayEntries = entriesByDate.get(key) || [];

      days.push({
        date: key,
        dayName: getDayName(key),
        count: dayEntries.length,
        duration: dayEntries.reduce((sum, e) => sum + e.duration, 0),
        words: dayEntries.reduce((sum, e) => sum + countWords(e.text), 0),
        entries: dayEntries,
      });
    }

    const weekEntries = days.flatMap(d => d.entries);
    const totalCount = weekEntries.length;
    const totalDuration = weekEntries.reduce((sum, e) => sum + e.duration, 0);
    const totalWords = weekEntries.reduce((sum, e) => sum + countWords(e.text), 0);
    const maxDaily = Math.max(...days.map(d => d.count), 1);
    const activeDays = days.filter(d => d.count > 0).length;

    return { days, totalCount, totalDuration, totalWords, maxDaily, activeDays, weekEntries };
  }, [weekStart, entriesByDate]);

  // Overall stats (all time)
  const overallStats = useMemo(() => {
    const totalTranscriptions = entries.length;
    const totalDuration = entries.reduce((sum, e) => sum + e.duration, 0);
    const totalWords = entries.reduce((sum, e) => sum + countWords(e.text), 0);
    const refinedCount = entries.filter(e => e.refined).length;

    // Language distribution
    const langCounts: Record<string, number> = {};
    entries.forEach(e => {
      const lang = e.language || 'unknown';
      langCounts[lang] = (langCounts[lang] || 0) + 1;
    });
    const languages = Object.entries(langCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    // Category distribution
    const categoryCounts: Record<TranscriptionCategory, number> = {
      general: 0, code: 0, design: 0, meeting: 0, note: 0, command: 0,
    };
    entries.forEach(e => {
      const cat = e.category || 'general';
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    });
    const categories = (Object.entries(categoryCounts) as [TranscriptionCategory, number][])
      .filter(([_, count]) => count > 0)
      .sort((a, b) => b[1] - a[1]);

    // Average stats
    const avgWords = totalTranscriptions > 0 ? Math.round(totalWords / totalTranscriptions) : 0;
    const avgDuration = totalTranscriptions > 0 ? totalDuration / totalTranscriptions : 0;

    // Time saved estimate
    const typingTimeMinutes = totalWords / 40;
    const speakingTimeMinutes = totalDuration / 60;
    const timeSavedMinutes = Math.max(0, typingTimeMinutes - speakingTimeMinutes);

    return {
      totalTranscriptions, totalDuration, totalWords, refinedCount,
      languages, categories, avgWords, avgDuration, timeSavedMinutes,
    };
  }, [entries]);

  // Weekly badges
  const badges = useMemo((): WeeklyBadge[] => {
    const { weekEntries, activeDays } = weekStats;
    const weekWords = weekEntries.reduce((sum, e) => sum + countWords(e.text), 0);
    const weekLanguages = new Set(weekEntries.map(e => e.language || 'unknown'));
    const weekAvgDuration = weekEntries.length > 0
      ? weekEntries.reduce((sum, e) => sum + e.duration, 0) / weekEntries.length
      : 0;

    const maxDayCount = Math.max(...weekStats.days.map(d => d.count), 0);
    const hasEarlyActivity = weekEntries.some(e => new Date(e.timestamp).getHours() < 7);
    const hasNightActivity = weekEntries.some(e => new Date(e.timestamp).getHours() >= 22);

    return [
      {
        id: "streak",
        label: "Streak Master",
        description: "Use app 7+ days in a row",
        icon: "M13 2L3 14h9l-1 8 10-12h-9l1-8z",
        earned: currentStreak >= 7,
        progress: `${currentStreak}/7 days`,
      },
      {
        id: "wordsmith",
        label: "Wordsmith",
        description: "Transcribe 1000+ words this week",
        icon: "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5",
        earned: weekWords >= 1000,
        progress: `${weekWords}/1000 words`,
      },
      {
        id: "consistent",
        label: "Consistent",
        description: "Active 5+ days this week",
        icon: "M22 11.08V12a10 10 0 1 1-5.93-9.14",
        earned: activeDays >= 5,
        progress: `${activeDays}/5 days`,
      },
      {
        id: "polyglot",
        label: "Polyglot",
        description: "Use 3+ languages this week",
        icon: "M5 8l6 6M4 14l6-6 2-3M2 5h12M7 2h1M22 22l-5-10-5 10M12 18h6",
        earned: weekLanguages.size >= 3,
        progress: `${weekLanguages.size}/3 languages`,
      },
      {
        id: "marathon",
        label: "Marathon",
        description: "50+ transcriptions in one day",
        icon: "M22 12h-4l-3 9L9 3l-3 9H2",
        earned: maxDayCount >= 50,
        progress: `${maxDayCount}/50 in a day`,
      },
      {
        id: "early",
        label: "Early Bird",
        description: "Transcribe before 7 AM",
        icon: "M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z",
        earned: hasEarlyActivity,
        progress: hasEarlyActivity ? "Achieved" : "Before 7 AM",
      },
    ];
  }, [weekStats, currentStreak]);

  // Check if can navigate
  const canGoPrev = selectedWeekOffset > -11; // Limit to 12 weeks back
  const canGoNext = selectedWeekOffset < 0;

  const totalWords = useMemo(
    () => entries.reduce((sum, e) => sum + countWords(e.text), 0),
    [entries],
  );

  return (
    <div className="analytics-view feature-view feature-view--wide">
      <header className="feature-hero">
        <span className="feature-medallion tone-green" aria-hidden>
          <BarChart3 />
        </span>
        <div className="feature-hero-body">
          <span className="feature-hero-eyebrow">
            <Sparkles size={12} strokeWidth={2.5} /> Insights
          </span>
          <h1 className="feature-hero-title">Analytics</h1>
          <p className="feature-hero-description">
            See how you use voice dictation — streaks, word counts, busy days,
            language mix, and time saved compared with typing by hand.
          </p>
          <div className="feature-hero-meta">
            <span className="feature-chip accent">
              {entries.length} {entries.length === 1 ? "entry" : "entries"}
            </span>
            <span className="feature-chip">{totalWords.toLocaleString()} words</span>
            <span className="feature-chip">
              <Flame size={12} strokeWidth={2.5} /> {currentStreak} day streak
            </span>
          </div>
        </div>
      </header>

      {entries.length === 0 ? (
        <div className="feature-empty">
          <div className="feature-empty-icon">
            <BarChart3 />
          </div>
          <p className="feature-empty-title">No data yet</p>
          <p className="feature-empty-description">
            Start transcribing to unlock streaks, badges, and insights.
          </p>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-value">{overallStats.totalTranscriptions}</div>
              <div className="stat-label">Transcriptions</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{overallStats.totalWords.toLocaleString()}</div>
              <div className="stat-label">Words</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{formatDuration(overallStats.totalDuration)}</div>
              <div className="stat-label">Audio Time</div>
            </div>
            <div className="stat-card accent">
              <div className="stat-value">{Math.round(overallStats.timeSavedMinutes)}</div>
              <div className="stat-label">Minutes Saved</div>
            </div>
          </div>

          {/* Weekly Activity Section */}
          <div className="analytics-section">
            <div className="section-header-row">
              <h3 className="subsection-header">Activity</h3>
              <div className="streak-badge">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                </svg>
                <span>{currentStreak} day streak</span>
              </div>
            </div>

            {/* Week Navigation */}
            <div className="week-navigator">
              <button
                className="week-nav-btn"
                onClick={() => setSelectedWeekOffset(o => o - 1)}
                disabled={!canGoPrev}
                title="Previous week"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>

              <button
                className="week-label-btn"
                onClick={() => setShowWeekSelector(!showWeekSelector)}
              >
                <span>{weekLabel}</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              <button
                className="week-nav-btn"
                onClick={() => setSelectedWeekOffset(o => o + 1)}
                disabled={!canGoNext}
                title="Next week"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>

              {selectedWeekOffset !== 0 && (
                <button
                  className="week-today-btn"
                  onClick={() => setSelectedWeekOffset(0)}
                  title="Go to this week"
                >
                  Today
                </button>
              )}
            </div>

            {/* Week Selector Dropdown */}
            {showWeekSelector && (
              <div className="week-selector">
                {availableWeeks.map((week, idx) => {
                  const today = new Date();
                  const thisWeekStart = getWeekStart(today);
                  const offset = Math.round((week.weekStart.getTime() - thisWeekStart.getTime()) / (7 * 24 * 60 * 60 * 1000));
                  const isSelected = offset === selectedWeekOffset;

                  return (
                    <button
                      key={idx}
                      className={`week-option ${isSelected ? 'selected' : ''}`}
                      onClick={() => {
                        setSelectedWeekOffset(offset);
                        setShowWeekSelector(false);
                      }}
                    >
                      {week.label}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Week Summary */}
            <div className="week-summary">
              <div className="week-stat">
                <span className="week-stat-value">{weekStats.totalCount}</span>
                <span className="week-stat-label">transcriptions</span>
              </div>
              <div className="week-stat">
                <span className="week-stat-value">{weekStats.totalWords}</span>
                <span className="week-stat-label">words</span>
              </div>
              <div className="week-stat">
                <span className="week-stat-value">{formatDuration(weekStats.totalDuration)}</span>
                <span className="week-stat-label">audio</span>
              </div>
              <div className="week-stat">
                <span className="week-stat-value">{weekStats.activeDays}</span>
                <span className="week-stat-label">active days</span>
              </div>
            </div>

            {/* Daily Activity Bars */}
            <div className="activity-chart">
              {weekStats.days.map((day) => {
                const today = new Date();
                const dayDate = new Date(day.date + 'T00:00:00');
                const isToday = isSameDay(dayDate, today);
                const isFuture = dayDate > today;

                return (
                  <div key={day.date} className={`activity-bar-container ${isToday ? 'today' : ''} ${isFuture ? 'future' : ''}`}>
                    <div
                      className="activity-bar"
                      style={{ height: `${(day.count / weekStats.maxDaily) * 100}%` }}
                      title={`${formatDateShort(day.date)}: ${day.count} transcriptions, ${day.words} words`}
                    >
                      {day.count > 0 && <span className="bar-value">{day.count}</span>}
                    </div>
                    <div className="activity-label">{day.dayName}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Weekly Badges */}
          <div className="analytics-section">
            <h3 className="subsection-header">Weekly Badges</h3>
            <div className="badges-grid">
              {badges.map(badge => (
                <div
                  key={badge.id}
                  className={`badge-card ${badge.earned ? 'earned' : ''}`}
                  title={badge.description}
                >
                  <div className="badge-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d={badge.icon} />
                    </svg>
                  </div>
                  <div className="badge-info">
                    <span className="badge-label">{badge.label}</span>
                    <span className="badge-progress">{badge.progress}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Details Grid */}
          <div className="analytics-details">
            <div className="analytics-section">
              <h3 className="subsection-header">Averages</h3>
              <div className="detail-list">
                <div className="detail-row">
                  <span className="detail-label">Words per transcription</span>
                  <span className="detail-value">{overallStats.avgWords}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Duration per transcription</span>
                  <span className="detail-value">{overallStats.avgDuration.toFixed(1)}s</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">AI refinement rate</span>
                  <span className="detail-value">
                    {overallStats.totalTranscriptions > 0
                      ? Math.round((overallStats.refinedCount / overallStats.totalTranscriptions) * 100)
                      : 0}%
                  </span>
                </div>
              </div>
            </div>

            <div className="analytics-section">
              <h3 className="subsection-header">Languages</h3>
              <div className="detail-list">
                {overallStats.languages.length === 0 ? (
                  <div className="detail-row">
                    <span className="detail-label">No data</span>
                  </div>
                ) : (
                  overallStats.languages.map(([lang, count]) => (
                    <div key={lang} className="detail-row">
                      <span className="detail-label">{lang.toUpperCase()}</span>
                      <span className="detail-value">{count}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Categories Distribution */}
          <div className="analytics-section">
            <h3 className="subsection-header">Content Categories</h3>
            <p className="section-description">
              Automatic classification of your transcriptions by content type.
            </p>
            <div className="categories-grid">
              {overallStats.categories.length === 0 ? (
                <div className="detail-row">
                  <span className="detail-label">No categorized content yet</span>
                </div>
              ) : (
                overallStats.categories.map(([category, count]) => {
                  const catInfo = CATEGORY_LABELS[category];
                  const percentage = overallStats.totalTranscriptions > 0
                    ? Math.round((count / overallStats.totalTranscriptions) * 100)
                    : 0;
                  return (
                    <div key={category} className="category-card">
                      <div className="category-icon" style={{ color: catInfo.color }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d={catInfo.icon} />
                        </svg>
                      </div>
                      <div className="category-info">
                        <span className="category-label">{catInfo.label}</span>
                        <span className="category-count">{count} ({percentage}%)</span>
                      </div>
                      <div className="category-bar">
                        <div
                          className="category-bar-fill"
                          style={{
                            width: `${percentage}%`,
                            backgroundColor: catInfo.color,
                          }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
