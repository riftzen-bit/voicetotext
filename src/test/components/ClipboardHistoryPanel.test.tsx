import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import ClipboardHistoryPanel from '../../components/ClipboardHistoryPanel';

// Mock useClipboardHistory hook with all required functions
vi.mock('../../hooks/useClipboardHistory', () => ({
  useClipboardHistory: () => ({
    history: [],
    addEntry: vi.fn(),
    removeEntry: vi.fn(),
    clearHistory: vi.fn(),
    copyToClipboard: vi.fn(),
    searchHistory: vi.fn().mockReturnValue([]),
  }),
}));

describe('ClipboardHistoryPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    const { container } = render(<ClipboardHistoryPanel />);
    expect(container.querySelector('.clipboard-history-panel')).toBeInTheDocument();
  });

  it('shows header', () => {
    render(<ClipboardHistoryPanel />);
    // Use getAllByText since "Clipboard History" may appear multiple times
    const elements = screen.getAllByText(/clipboard history/i);
    expect(elements.length).toBeGreaterThan(0);
  });
});
