import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import SummaryView from '../../../src/components/SummaryView';
import type { MeetingSummary } from '../../../src/types';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const summary: MeetingSummary = {
  id: 'summary-1',
  content: 'Weekly sync covered roadmap and blockers.',
  key_points: ['Roadmap reviewed', 'Blockers identified'],
  decisions: [{ decision: 'Ship beta next week', context: 'After QA sign-off' }],
  action_items: [{ task: 'Prepare release notes', assignee: 'Alex', deadline: 'Friday' }],
  created_at: new Date().toISOString(),
};

describe('SummaryView', () => {
  it('renders loading state accessibly', () => {
    render(<SummaryView summary={null} isLoading />);
    expect(screen.getByLabelText('Summary loading state')).toBeInTheDocument();
    expect(screen.getByText('summary.generating')).toBeInTheDocument();
  });

  it('renders empty state when summary is absent', () => {
    render(<SummaryView summary={null} />);
    expect(screen.getByLabelText('Empty meeting summary')).toBeInTheDocument();
  });

  it('renders summary sections', () => {
    render(<SummaryView summary={summary} />);
    expect(screen.getByLabelText('Meeting summary')).toBeInTheDocument();
    expect(screen.getByText(summary.content)).toBeInTheDocument();
    expect(screen.getByText('Roadmap reviewed')).toBeInTheDocument();
    expect(screen.getByText('Ship beta next week')).toBeInTheDocument();
    expect(screen.getByText('Prepare release notes')).toBeInTheDocument();
  });
});
