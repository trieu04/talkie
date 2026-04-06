import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Paper,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import AccessTimeRoundedIcon from '@mui/icons-material/AccessTimeRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import LanguageRoundedIcon from '@mui/icons-material/LanguageRounded';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useParams } from 'react-router-dom';

import LanguageSelector from '@/components/LanguageSelector';
import SummaryView from '@/components/SummaryView';
import { SummarySkeleton, TranscriptSkeleton } from '@/components/Skeleton';
import TranscriptSearch from '@/components/TranscriptSearch';
import TranscriptView from '@/components/TranscriptView';
import { meetingApi, type MeetingResponse } from '@/services/meetingApi';
import type { MeetingSummary, MeetingStatus, TranscriptSegment, TranslationMap } from '@/types';

const TRANSCRIPT_PAGE_SIZE = 100;

const STATUS_COLORS: Record<MeetingStatus, 'default' | 'success' | 'warning' | 'error' | 'info'> = {
  created: 'default',
  recording: 'success',
  paused: 'warning',
  ended: 'info',
  ended_abnormal: 'error',
};

function formatDuration(seconds: number | undefined): string {
  if (seconds === undefined || seconds === 0) {
    return '-';
  }
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }
  return `${secs}s`;
}

function LoadingPage() {
  return (
    <Stack spacing={3}>
      <Skeleton variant="rounded" height={96} />
      <TranscriptSkeleton />
      <SummarySkeleton />
    </Stack>
  );
}

export default function MeetingReplay() {
  const { id: meetingId } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const transcriptContainerRef = useRef<HTMLDivElement>(null);

  const [meeting, setMeeting] = useState<MeetingResponse | null>(null);
  const [isLoadingMeeting, setIsLoadingMeeting] = useState(true);
  const [meetingError, setMeetingError] = useState<string | null>(null);

  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [translations, setTranslations] = useState<TranslationMap>({});
  const [isLoadingTranscript, setIsLoadingTranscript] = useState(false);
  const [transcriptTotal, setTranscriptTotal] = useState(0);
  const [hasMoreSegments, setHasMoreSegments] = useState(true);

  const [selectedLanguage, setSelectedLanguage] = useState<string | null>(null);
  const [isRequestingTranslation, setIsRequestingTranslation] = useState(false);
  const [translationError, setTranslationError] = useState<string | null>(null);

  const [summary, setSummary] = useState<MeetingSummary | null>(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  useEffect(() => {
    if (!meetingId) {
      return;
    }

    const fetchMeeting = async () => {
      setIsLoadingMeeting(true);
      setMeetingError(null);

      try {
        const data = await meetingApi.get(meetingId);
        setMeeting(data);
      } catch {
        setMeetingError(t('meeting.fetchError'));
      } finally {
        setIsLoadingMeeting(false);
      }
    };

    void fetchMeeting();
  }, [meetingId, t]);

  const loadTranscriptPage = useCallback(
    async (offset: number) => {
      if (!meetingId) {
        return;
      }

      setIsLoadingTranscript(true);

      try {
        const response = await meetingApi.getTranscript(meetingId, {
          limit: TRANSCRIPT_PAGE_SIZE,
          offset,
        });

        setSegments((prev) => {
          const newSegments = response.segments.filter(
            (segment) => !prev.some((p) => p.id === segment.id),
          );
          return [...prev, ...newSegments].sort((a, b) => a.sequence - b.sequence);
        });
        setTranscriptTotal(response.total);
        setHasMoreSegments(offset + response.segments.length < response.total);
      } catch (_error) {
        // Silently fail - transcript loading is non-critical for UX
      } finally {
        setIsLoadingTranscript(false);
      }
    },
    [meetingId],
  );

  useEffect(() => {
    if (!meetingId || isLoadingMeeting || meetingError) {
      return;
    }

    setSegments([]);
    setTranslations({});
    void loadTranscriptPage(0);
  }, [meetingId, isLoadingMeeting, meetingError, loadTranscriptPage]);

  useEffect(() => {
    if (!meetingId || !meeting?.has_summary) {
      return;
    }

    const fetchSummary = async () => {
      setIsLoadingSummary(true);
      setSummaryError(null);

      try {
        const data = await meetingApi.getSummary(meetingId);
        setSummary(data);
      } catch (_error) {
        // Silently fail - summary loading is non-critical for UX
      } finally {
        setIsLoadingSummary(false);
      }
    };

    void fetchSummary();
  }, [meetingId, meeting?.has_summary]);

  const handleLoadMore = useCallback(() => {
    if (isLoadingTranscript || !hasMoreSegments) {
      return;
    }
    void loadTranscriptPage(segments.length);
  }, [isLoadingTranscript, hasMoreSegments, segments.length, loadTranscriptPage]);

  const handleSearchResultClick = useCallback((segmentId: string) => {
    const element = document.getElementById(`segment-${segmentId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element.style.transition = 'background-color 0.3s';
      element.style.backgroundColor = 'rgba(25, 118, 210, 0.12)';
      setTimeout(() => {
        element.style.backgroundColor = '';
      }, 2000);
    }
  }, []);

  const handleLanguageChange = useCallback(
    async (languageCode: string | null) => {
      setSelectedLanguage(languageCode);
      setTranslationError(null);

      if (!meetingId || !languageCode) {
        return;
      }

      if (meeting?.available_translations?.includes(languageCode)) {
        return;
      }

      setIsRequestingTranslation(true);

      try {
        await meetingApi.requestTranslation(meetingId, languageCode);
        setMeeting((prev) =>
          prev
            ? {
                ...prev,
                available_translations: [...(prev.available_translations ?? []), languageCode],
              }
            : prev,
        );
      } catch {
        setTranslationError(t('replay.translationError'));
      } finally {
        setIsRequestingTranslation(false);
      }
    },
    [meetingId, meeting?.available_translations, t],
  );

  const handleGenerateSummary = useCallback(async () => {
    if (!meetingId) {
      return;
    }

    setIsGeneratingSummary(true);
    setSummaryError(null);

    try {
      const response = await meetingApi.generateSummary(meetingId);
      if (response.status === 'completed' && response.summary) {
        setSummary(response.summary);
        setMeeting((prev) => (prev ? { ...prev, has_summary: true } : prev));
      }
    } catch {
      setSummaryError(t('replay.summaryError'));
    } finally {
      setIsGeneratingSummary(false);
    }
  }, [meetingId, t]);

  if (isLoadingMeeting) {
    return <LoadingPage />;
  }

  if (meetingError || !meeting) {
    return (
      <Stack spacing={2}>
        <Button
          component={RouterLink}
          to="/history"
          startIcon={<ArrowBackRoundedIcon />}
          sx={{ alignSelf: 'flex-start' }}
        >
          {t('replay.backToHistory')}
        </Button>
        <Alert severity="error">{meetingError ?? t('meeting.notFound')}</Alert>
      </Stack>
    );
  }

  return (
    <Stack spacing={3}>
      <Button
        component={RouterLink}
        to="/history"
        startIcon={<ArrowBackRoundedIcon />}
        sx={{ alignSelf: 'flex-start' }}
      >
        {t('replay.backToHistory')}
      </Button>

      <Paper sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Stack
            direction="row"
            spacing={2}
            alignItems="flex-start"
            justifyContent="space-between"
            flexWrap="wrap"
          >
            <Box>
              <Typography variant="h5" gutterBottom>
                {meeting.title ?? t('meeting.untitled')}
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                <Chip
                  size="small"
                  color={STATUS_COLORS[meeting.status]}
                  label={t(`meeting.status.${meeting.status}`)}
                />
                <Chip
                  size="small"
                  icon={<LanguageRoundedIcon />}
                  label={meeting.source_language.toUpperCase()}
                  variant="outlined"
                />
                {meeting.duration_seconds !== undefined && meeting.duration_seconds > 0 && (
                  <Chip
                    size="small"
                    icon={<AccessTimeRoundedIcon />}
                    label={formatDuration(meeting.duration_seconds)}
                    variant="outlined"
                  />
                )}
              </Stack>
            </Box>

            <Typography variant="body2" color="text.secondary">
              {meeting.created_at
                ? new Date(meeting.created_at).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : ''}
            </Typography>
          </Stack>
        </Stack>
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={2}
            alignItems={{ xs: 'stretch', sm: 'center' }}
            justifyContent="space-between"
          >
            <Typography variant="h6">{t('replay.transcript')}</Typography>

            <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
              <LanguageSelector
                value={selectedLanguage}
                onChange={handleLanguageChange}
                disabled={isRequestingTranslation}
              />
              {isRequestingTranslation && <CircularProgress size={20} />}
            </Stack>
          </Stack>

          {translationError && (
            <Alert severity="warning" onClose={() => setTranslationError(null)}>
              {translationError}
            </Alert>
          )}

          {meetingId && (
            <TranscriptSearch
              meetingId={meetingId}
              onResultClick={handleSearchResultClick}
            />
          )}

          <Box ref={transcriptContainerRef}>
            <TranscriptView
              segments={segments}
              translations={translations}
              selectedLanguage={selectedLanguage}
              isLoading={isLoadingTranscript && segments.length === 0}
              autoScroll={false}
            />
          </Box>

          {hasMoreSegments && (
            <Box display="flex" justifyContent="center">
              <Button
                variant="outlined"
                onClick={handleLoadMore}
                disabled={isLoadingTranscript}
                startIcon={isLoadingTranscript ? <CircularProgress size={18} /> : undefined}
              >
                {isLoadingTranscript ? t('common.loading') : t('replay.loadMore')}
              </Button>
            </Box>
          )}

          {transcriptTotal > 0 && (
            <Typography variant="body2" color="text.secondary" textAlign="center">
              {t('replay.segmentCount', {
                loaded: segments.length,
                total: transcriptTotal,
              })}
            </Typography>
          )}
        </Stack>
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Stack
            direction="row"
            spacing={2}
            alignItems="center"
            justifyContent="space-between"
            flexWrap="wrap"
          >
            <Typography variant="h6">{t('summary.title')}</Typography>

            {!summary && !isLoadingSummary && !isGeneratingSummary && (
              <Button
                variant="contained"
                onClick={handleGenerateSummary}
                startIcon={<AutoAwesomeRoundedIcon />}
                disabled={segments.length === 0}
              >
                {t('replay.generateSummary')}
              </Button>
            )}
          </Stack>

          <Divider />

          <SummaryView
            summary={summary}
            isLoading={isLoadingSummary || isGeneratingSummary}
            error={summaryError}
          />
        </Stack>
      </Paper>
    </Stack>
  );
}
