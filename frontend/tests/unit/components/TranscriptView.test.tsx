import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import TranscriptView from '@/components/TranscriptView';
import type { TranscriptSegment, TranslationMap } from '@/types';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const createSegment = (overrides: Partial<TranscriptSegment> = {}): TranscriptSegment => ({
  id: 'seg-1',
  sequence: 1,
  text: 'Hello world',
  start_time_ms: 0,
  end_time_ms: 1000,
  is_partial: false,
  ...overrides,
});

describe('TranscriptView', () => {
  it('renders empty state when no segments', () => {
    render(<TranscriptView segments={[]} />);
    expect(screen.getByText('translation.waitingForSpeech')).toBeInTheDocument();
  });

  it('renders loading state when isLoading', () => {
    render(<TranscriptView segments={[]} isLoading />);
    expect(screen.getByText('translation.loadingTranscript')).toBeInTheDocument();
  });

  it('renders segments in sequence order', () => {
    const segments = [
      createSegment({ id: 'seg-2', sequence: 2, text: 'Second', start_time_ms: 2000, end_time_ms: 3000 }),
      createSegment({ id: 'seg-1', sequence: 1, text: 'First', start_time_ms: 0, end_time_ms: 1000 }),
    ];

    render(<TranscriptView segments={segments} />);

    const items = screen.getAllByRole('article');
    expect(items[0]).toHaveTextContent('First');
    expect(items[1]).toHaveTextContent('Second');
  });

  it('shows timestamp for each segment', () => {
    const segments = [
      createSegment({ start_time_ms: 65000 }),
    ];

    render(<TranscriptView segments={segments} />);
    expect(screen.getByText('01:05')).toBeInTheDocument();
  });

  it('shows translation when selectedLanguage and translation exist', () => {
    const segments = [createSegment()];
    const translations: TranslationMap = {
      'seg-1': {
        en: 'Hello world in English',
      },
    };

    render(
      <TranscriptView
        segments={segments}
        translations={translations}
        selectedLanguage="en"
      />
    );

    expect(screen.getByText('Hello world in English')).toBeInTheDocument();
  });

  it('shows backfill progress bar when isBackfillInProgress', () => {
    render(
      <TranscriptView
        segments={[createSegment({ is_partial: true })]}
        isBackfillInProgress
        selectedLanguage="en"
      />
    );

    expect(screen.getByText('translation.backfillInProgress')).toBeInTheDocument();
    const progressBars = screen.getAllByRole('progressbar');
    expect(progressBars.length).toBeGreaterThan(0);
  });

  it('has proper accessibility attributes', () => {
    render(<TranscriptView segments={[]} />);

    const log = screen.getByRole('log');
    expect(log).toHaveAttribute('aria-live', 'polite');
    expect(log).toHaveAttribute('aria-label', 'Live transcript');
  });
});
