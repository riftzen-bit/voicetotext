import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import TemplatesView from '../../components/TemplatesView';

// Mock useSettings hook
vi.mock('../../hooks/useSettings', () => ({
  useSettings: () => ({
    settings: {
      contextTemplates: [],
      activeTemplateId: null,
    },
    updateSetting: vi.fn().mockResolvedValue(undefined),
    isLoading: false,
  }),
}));

describe('TemplatesView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    const { container } = render(<TemplatesView />);
    expect(container.querySelector('.templates-view')).toBeInTheDocument();
  });

  it('renders template elements', () => {
    render(<TemplatesView />);
    // Component has default templates, so there should be multiple buttons
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
  });
});
