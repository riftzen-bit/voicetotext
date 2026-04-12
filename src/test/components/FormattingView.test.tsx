import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import FormattingView from '../../components/FormattingView';

// Mock useSettings hook
vi.mock('../../hooks/useSettings', () => ({
  useSettings: () => ({
    settings: {
      formatting: null,
    },
    updateSetting: vi.fn().mockResolvedValue(undefined),
    isLoading: false,
  }),
}));

describe('FormattingView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    const { container } = render(<FormattingView />);
    expect(container.querySelector('.formatting-view')).toBeInTheDocument();
  });
});
