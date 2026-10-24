import { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import { Box, CircularProgress, Fade, LinearProgress, Stack, Typography } from '@mui/material';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import MoreHorizRoundedIcon from '@mui/icons-material/MoreHorizRounded';
import { keyframes } from '@mui/system';
import { useTranslation } from 'react-i18next';

import type { TranscriptSegment, TranslationMap } from '@/types';
import { EmptyState } from './StatePanels';
import { SectionCard } from './SurfacePrimitives';

interface TranscriptViewProps {
  segments: TranscriptSegment[];
  translations?: TranslationMap;
  selectedLanguage?: string | null;
  isLoading?: boolean;
  isBackfillInProgress?: boolean;
  autoScroll?: boolean;
}

const pulseAnimation = keyframes`
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.45;
  }
`;

const formatTimestamp = (ms: number): string => {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

interface SegmentItemProps {
  segment: TranscriptSegment;
  translation: string | undefined;
  selectedLanguage: string | null | undefined;
  isTranslationPending: boolean;
  t: (key: string) => string;
}

const SegmentItem = memo(function SegmentItem({
  segment,
  translation,
  selectedLanguage,
  isTranslationPending,
  t,
}: SegmentItemProps) {
  const isPartial = segment.is_partial ?? false;
  const showConfidence = !isPartial && segment.confidence !== undefined && segment.confidence >= 0.8;

  return (
    <Fade in timeout={240}>
      <Box
        component="article"
        id={`segment-${segment.id}`}
        sx={{
          position: 'relative',
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '80px minmax(0, 1fr)' },
          gap: 1.5,
          px: { xs: 2, sm: 2.5 },
          py: 2,
          borderRadius: 4,
          border: 1,
          borderColor: isPartial ? 'talkie.borderStrong' : 'transparent',
          bgcolor: isPartial ? 'talkie.transcriptPending' : 'background.paper',
          transition: 'background-color 0.2s ease, border-color 0.2s ease',
        }}
      >
        <Typography
          variant="monoLabel"
          color="text.tertiary"
          sx={{ pt: { sm: 0.5 } }}
        >
          {formatTimestamp(segment.start_time_ms)}
        </Typography>

        <Box minWidth={0}>
          <Stack direction="row" spacing={1} alignItems="flex-start">
            <Typography
              variant="body1"
              sx={{
                flex: 1,
                color: isPartial ? 'text.secondary' : 'text.primary',
                fontStyle: isPartial ? 'italic' : 'normal',
                animation: isPartial ? `${pulseAnimation} 1.6s ease-in-out infinite` : 'none',
              }}
            >
              {segment.text}
            </Typography>
            {isPartial ? (
              <MoreHorizRoundedIcon sx={{ fontSize: 18, color: 'primary.main', animation: `${pulseAnimation} 1s ease-in-out infinite` }} />
            ) : null}
            {showConfidence ? <CheckCircleOutlineRoundedIcon sx={{ fontSize: 18, color: 'success.main' }} /> : null}
          </Stack>

          {selectedLanguage ? (
            <Box
              sx={{
                mt: 1.25,
                pl: 1.5,
                borderLeft: 2,
                borderColor: 'primary.main',
              }}
            >
              {translation ? (
                <Stack spacing={0.5}>
                  <Typography variant="monoLabel" color="primary.main">
                    {selectedLanguage.toUpperCase()}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                    {translation}
                  </Typography>
                </Stack>
              ) : isTranslationPending ? (
                <Stack direction="row" spacing={1} alignItems="center">
                  <CircularProgress size={12} />
                  <Typography variant="body2" color="text.disabled">
                    {t('translation.translating')}
                  </Typography>
                </Stack>
              ) : null}
            </Box>
          ) : null}
        </Box>
      </Box>
    </Fade>
  );
});

export default function TranscriptView({
  segments,
  translations = {},
  selectedLanguage,
  isLoading = false,
  isBackfillInProgress = false,
  autoScroll = true,
}: TranscriptViewProps) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const prevSegmentCountRef = useRef(segments.length);

  const sortedSegments = useMemo(() => [...segments].sort((a, b) => a.sequence - b.sequence), [segments]);

  const scrollToBottom = useCallback(() => {
    if (containerRef.current) {
      containerRef.current.scrollTo({ top: containerRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, []);

  useEffect(() => {
    if (autoScroll && segments.length > prevSegmentCountRef.current) {
      scrollToBottom();
    }
    prevSegmentCountRef.current = segments.length;
  }, [autoScroll, scrollToBottom, segments.length]);

  if (!sortedSegments.length) {
    return (
      <Box
        component="section"
        role="log"
        aria-label="Live transcript"
        aria-live="polite"
        aria-relevant="additions text"
        aria-atomic="false"
        aria-busy={isLoading || isBackfillInProgress}
        tabIndex={0}
      >
        {isLoading ? (
          <SectionCard tone="muted">
            <Stack spacing={2} alignItems="flex-start" sx={{ py: 2 }}>
              <CircularProgress size={28} />
              <Typography variant="body2" color="text.secondary">
                {t('translation.loadingTranscript')}
              </Typography>
            </Stack>
          </SectionCard>
        ) : (
          <EmptyState title={t('translation.waitingTitle')} description={t('translation.waitingForSpeech')} />
        )}
      </Box>
    );
  }

  return (
    <Box
      component="section"
      ref={containerRef}
      role="log"
      aria-label="Live transcript"
      aria-live="polite"
      aria-relevant="additions text"
      aria-atomic="false"
      aria-busy={isLoading || isBackfillInProgress}
      tabIndex={0}
      sx={{
        maxHeight: 560,
        overflowY: 'auto',
        scrollBehavior: 'smooth',
        bgcolor: 'background.level1',
        borderRadius: 6,
        border: 1,
        borderColor: 'talkie.borderSubtle',
        outline: 'none',
        px: { xs: 0.5, sm: 1 },
        py: 1,
        '&:focus-visible': {
          outline: '3px solid',
          outlineColor: 'primary.main',
          outlineOffset: 2,
        },
      }}
    >
      {isBackfillInProgress && selectedLanguage ? (
        <Box sx={{ px: 2, pt: 1.5 }}>
          <Stack spacing={0.75}>
            <Typography variant="caption" color="text.secondary">
              {t('translation.backfillInProgress')}
            </Typography>
            <LinearProgress variant="indeterminate" sx={{ borderRadius: 999 }} />
          </Stack>
        </Box>
      ) : null}

      <Stack spacing={1.25} sx={{ position: 'relative', py: 1 }}>
        {sortedSegments.map((segment) => {
          const segmentTranslations = translations[segment.id];
          const translation = selectedLanguage && segmentTranslations ? segmentTranslations[selectedLanguage] : undefined;
          const isTranslationPending = Boolean(selectedLanguage && !segment.is_partial && !translation);

          return (
            <SegmentItem
              key={segment.id}
              segment={segment}
              translation={translation}
              selectedLanguage={selectedLanguage}
              isTranslationPending={isTranslationPending}
              t={t}
            />
          );
        })}
      </Stack>
    </Box>
  );
}
