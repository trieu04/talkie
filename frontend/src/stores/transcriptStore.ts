import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

import type { TranscriptSegment, TranslationMap } from '@/types';

interface TranscriptStore {
  segments: TranscriptSegment[];
  translations: TranslationMap;
  isLoading: boolean;
  isBackfillInProgress: boolean;
  backfillLanguage: string | null;
  addSegment: (segment: TranscriptSegment) => void;
  updateSegment: (segmentId: string, updates: Partial<TranscriptSegment>) => void;
  setTranslation: (segmentId: string, language: string, translatedText: string) => void;
  setBackfillStatus: (inProgress: boolean, language: string | null) => void;
  clearSegments: () => void;
  setLoading: (isLoading: boolean) => void;
}

const sortSegments = (segments: TranscriptSegment[]) =>
  [...segments].sort((left, right) => left.sequence - right.sequence);

export const useTranscriptStore = create<TranscriptStore>()(
  devtools(
    (set) => ({
      segments: [],
      translations: {},
      isLoading: false,
      isBackfillInProgress: false,
      backfillLanguage: null,
      addSegment(segment) {
        set((state) => {
          const existingIndex = state.segments.findIndex((item) => item.id === segment.id);

          if (existingIndex >= 0) {
            const nextSegments = [...state.segments];
            nextSegments[existingIndex] = { ...nextSegments[existingIndex], ...segment };

            return { segments: sortSegments(nextSegments) };
          }

          return { segments: sortSegments([...state.segments, segment]) };
        });
      },
      updateSegment(segmentId, updates) {
        set((state) => ({
          segments: state.segments.map((segment) =>
            segment.id === segmentId ? { ...segment, ...updates } : segment,
          ),
        }));
      },
      setTranslation(segmentId, language, translatedText) {
        set((state) => ({
          translations: {
            ...state.translations,
            [segmentId]: {
              ...state.translations[segmentId],
              [language]: translatedText,
            },
          },
        }));
      },
      setBackfillStatus(inProgress, language) {
        set({ isBackfillInProgress: inProgress, backfillLanguage: language });
      },
      clearSegments() {
        set({ segments: [], translations: {}, isLoading: false, isBackfillInProgress: false, backfillLanguage: null });
      },
      setLoading(isLoading) {
        set({ isLoading });
      },
    }),
    { name: 'transcript-store' },
  ),
);
