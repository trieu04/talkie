import { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Box,
  CircularProgress,
  Fade,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import { keyframes } from '@mui/system';

import type { TranscriptSegment, TranslationMap } from '@/types';

interface TranscriptViewProps {
  segments: TranscriptSegment[];
  translations?: TranslationMap;
  selectedLanguage?: string | null;
  isLoading?: boolean;
  autoScroll?: boolean;
}

const pulseAnimation = keyframes`
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
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
}

const SegmentItem = memo(function SegmentItem({
  segment,
  translation,
  selectedLanguage,
  isTranslationPending,
}: SegmentItemProps) {
  const isPartial = segment.is_partial ?? false;
  const showConfidence = !isPartial && segment.confidence !== undefined && segment.confidence >= 0.8;

  return (
    <Fade in timeout={300}>
      <Paper
        elevation={0}
        sx={{
          p: 2,
          bgcolor: isPartial ? 'action.hover' : 'background.paper',
          border: 1,
          borderColor: isPartial ? 'divider' : 'transparent',
          transition: 'all 0.2s ease-in-out',
        }}
      >
        <Stack direction="row" spacing={2} alignItems="flex-start">
          <Typography
            variant="caption"
            sx={{
              color: 'text.secondary',
              fontFamily: 'monospace',
              fontWeight: 500,
              minWidth: 48,
              pt: 0.25,
            }}
          >
            {formatTimestamp(segment.start_time_ms)}
          </Typography>

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography
                variant="body1"
                sx={{
                  fontStyle: isPartial ? 'italic' : 'normal',
                  color: isPartial ? 'text.secondary' : 'text.primary',
                  animation: isPartial ? `${pulseAnimation} 1.5s ease-in-out infinite` : 'none',
                  flex: 1,
                }}
              >
                {segment.text}
              </Typography>

              {isPartial && (
                <Box
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    bgcolor: 'primary.main',
                    animation: `${pulseAnimation} 1s ease-in-out infinite`,
                    flexShrink: 0,
                  }}
                />
              )}

              {showConfidence && (
                <CheckCircleOutlineRoundedIcon
                  sx={{
                    fontSize: 16,
                    color: 'success.main',
                    flexShrink: 0,
                  }}
                />
              )}
            </Stack>

            {selectedLanguage && (
              <Box sx={{ mt: 1, pl: 1, borderLeft: 2, borderColor: 'primary.main' }}>
                {translation ? (
                  <Typography
                    variant="body2"
                    sx={{
                      color: 'text.secondary',
                      fontStyle: 'italic',
                    }}
                  >
                    {translation}
                  </Typography>
                ) : isTranslationPending ? (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <CircularProgress size={12} />
                    <Typography variant="body2" color="text.disabled">
                      Translating...
                    </Typography>
                  </Stack>
                ) : null}
              </Box>
            )}
          </Box>
        </Stack>
      </Paper>
    </Fade>
  );
});

function EmptyState({ isLoading }: { isLoading: boolean }) {
  return (
    <Stack
      alignItems="center"
      justifyContent="center"
      spacing={2}
      sx={{ py: 8 }}
    >
      {isLoading ? (
        <>
          <CircularProgress size={32} />
          <Typography variant="body2" color="text.secondary">
            Loading transcript...
          </Typography>
        </>
      ) : (
        <>
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              bgcolor: 'action.hover',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Box
              sx={{
                width: 16,
                height: 16,
                borderRadius: '50%',
                bgcolor: 'text.disabled',
                animation: `${pulseAnimation} 2s ease-in-out infinite`,
              }}
            />
          </Box>
          <Typography variant="body2" color="text.secondary">
            Waiting for speech...
          </Typography>
        </>
      )}
    </Stack>
  );
}

export default function TranscriptView({
  segments,
  translations = {},
  selectedLanguage,
  isLoading = false,
  autoScroll = true,
}: TranscriptViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const prevSegmentCountRef = useRef(segments.length);

  const sortedSegments = useMemo(
    () => [...segments].sort((a, b) => a.sequence - b.sequence),
    [segments],
  );

  const scrollToBottom = useCallback(() => {
    if (containerRef.current) {
      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, []);

  useEffect(() => {
    if (autoScroll && segments.length > prevSegmentCountRef.current) {
      scrollToBottom();
    }
    prevSegmentCountRef.current = segments.length;
  }, [segments.length, autoScroll, scrollToBottom]);

  const hasSegments = sortedSegments.length > 0;

  return (
    <Box
      ref={containerRef}
      sx={{
        maxHeight: 480,
        overflowY: 'auto',
        scrollBehavior: 'smooth',
        bgcolor: 'background.default',
        borderRadius: 2,
        border: 1,
        borderColor: 'divider',
        position: 'relative',
      }}
    >
      {hasSegments && (
        <Box
          sx={{
            position: 'absolute',
            left: 32,
            top: 0,
            bottom: 0,
            width: 2,
            bgcolor: 'divider',
            zIndex: 0,
          }}
        />
      )}

      <Stack spacing={1} sx={{ p: 2, position: 'relative', zIndex: 1 }}>
        {hasSegments ? (
          sortedSegments.map((segment) => {
            const segmentTranslations = translations[segment.id];
            const translation = selectedLanguage && segmentTranslations
              ? segmentTranslations[selectedLanguage]
              : undefined;
            const isTranslationPending = Boolean(
              selectedLanguage && !segment.is_partial && !translation,
            );

            return (
              <SegmentItem
                key={segment.id}
                segment={segment}
                translation={translation}
                selectedLanguage={selectedLanguage}
                isTranslationPending={isTranslationPending}
              />
            );
          })
        ) : (
          <EmptyState isLoading={isLoading} />
        )}
      </Stack>
    </Box>
  );
}
