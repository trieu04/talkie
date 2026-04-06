import { beforeEach, describe, expect, it } from 'vitest';

import { useTranscriptStore } from '@/stores/transcriptStore';
import type { TranscriptSegment } from '@/types';

const createMockSegment = (overrides: Partial<TranscriptSegment> = {}): TranscriptSegment => ({
  id: '1',
  sequence: 1,
  text: 'Hello world',
  start_time_ms: 0,
  end_time_ms: 1000,
  is_partial: false,
  ...overrides,
});

describe('transcriptStore', () => {
  beforeEach(() => {
    useTranscriptStore.setState({
      segments: [],
      translations: {},
      isLoading: false,
      isBackfillInProgress: false,
      backfillLanguage: null,
    });
  });

  it('has initial state with empty segments', () => {
    const state = useTranscriptStore.getState();
    expect(state.segments).toEqual([]);
    expect(state.translations).toEqual({});
    expect(state.isBackfillInProgress).toBe(false);
    expect(state.backfillLanguage).toBeNull();
  });

  it('addSegment adds new segment', () => {
    const segment = createMockSegment();

    useTranscriptStore.getState().addSegment(segment);

    expect(useTranscriptStore.getState().segments).toEqual([segment]);
  });

  it('addSegment updates existing segment by id', () => {
    const segment = createMockSegment({ text: 'Initial text' });
    useTranscriptStore.setState({ segments: [segment] });

    const updatedSegment = createMockSegment({ text: 'Updated text' });
    useTranscriptStore.getState().addSegment(updatedSegment);

    const segments = useTranscriptStore.getState().segments;
    expect(segments).toHaveLength(1);
    expect(segments[0].text).toBe('Updated text');
  });

  it('segments are sorted by sequence', () => {
    const segment1 = createMockSegment({ id: '1', sequence: 3 });
    const segment2 = createMockSegment({ id: '2', sequence: 1 });
    const segment3 = createMockSegment({ id: '3', sequence: 2 });

    useTranscriptStore.getState().addSegment(segment1);
    useTranscriptStore.getState().addSegment(segment2);
    useTranscriptStore.getState().addSegment(segment3);

    const segments = useTranscriptStore.getState().segments;
    expect(segments[0].sequence).toBe(1);
    expect(segments[1].sequence).toBe(2);
    expect(segments[2].sequence).toBe(3);
  });

  it('updateSegment modifies specific segment', () => {
    const segment1 = createMockSegment({ id: '1', text: 'First' });
    const segment2 = createMockSegment({ id: '2', sequence: 2, text: 'Second' });
    useTranscriptStore.setState({ segments: [segment1, segment2] });

    useTranscriptStore.getState().updateSegment('1', { text: 'Modified' });

    const segments = useTranscriptStore.getState().segments;
    expect(segments[0].text).toBe('Modified');
    expect(segments[1].text).toBe('Second');
  });

  it('setTranslation adds translation to map', () => {
    useTranscriptStore.getState().setTranslation('seg1', 'ja', 'こんにちは');

    const translations = useTranscriptStore.getState().translations;
    expect(translations['seg1']['ja']).toBe('こんにちは');
  });

  it('setTranslation preserves existing translations for segment', () => {
    useTranscriptStore.setState({
      translations: { seg1: { en: 'Hello' } },
    });

    useTranscriptStore.getState().setTranslation('seg1', 'ja', 'こんにちは');

    const translations = useTranscriptStore.getState().translations;
    expect(translations['seg1']['en']).toBe('Hello');
    expect(translations['seg1']['ja']).toBe('こんにちは');
  });

  it('clearSegments resets all state', () => {
    useTranscriptStore.setState({
      segments: [createMockSegment()],
      translations: { seg1: { en: 'Hello' } },
      isLoading: true,
      isBackfillInProgress: true,
      backfillLanguage: 'ja',
    });

    useTranscriptStore.getState().clearSegments();

    const state = useTranscriptStore.getState();
    expect(state.segments).toEqual([]);
    expect(state.translations).toEqual({});
    expect(state.isLoading).toBe(false);
    expect(state.isBackfillInProgress).toBe(false);
    expect(state.backfillLanguage).toBeNull();
  });

  it('setBackfillStatus updates backfill state', () => {
    useTranscriptStore.getState().setBackfillStatus(true, 'ja');

    const state = useTranscriptStore.getState();
    expect(state.isBackfillInProgress).toBe(true);
    expect(state.backfillLanguage).toBe('ja');
  });

  it('setBackfillStatus can clear backfill state', () => {
    useTranscriptStore.setState({ isBackfillInProgress: true, backfillLanguage: 'ja' });

    useTranscriptStore.getState().setBackfillStatus(false, null);

    const state = useTranscriptStore.getState();
    expect(state.isBackfillInProgress).toBe(false);
    expect(state.backfillLanguage).toBeNull();
  });
});
