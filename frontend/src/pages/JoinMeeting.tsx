import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import LanguageRoundedIcon from '@mui/icons-material/LanguageRounded';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';

import LanguageSelector from '@/components/LanguageSelector';
import ParticipantCount from '@/components/ParticipantCount';
import SummaryView from '@/components/SummaryView';
import TranscriptSearch from '@/components/TranscriptSearch';
import TranscriptView from '@/components/TranscriptView';
import { useMeetingWebSocket } from '@/hooks/useMeetingWebSocket';
import { meetingApi, type JoinMeetingResponse } from '@/services/meetingApi';
import { useTranscriptStore } from '@/stores';
import type { MeetingSummary, TranscriptSegment, TranslationMap } from '@/types';

type JoinStatus = 'loading' | 'active' | 'ended' | 'error';

const TRANSCRIPT_PAGE_SIZE = 100;

const mergeTranslations = (segments: TranscriptSegment[]): TranslationMap => {
  return segments.reduce<TranslationMap>((accumulator, segment) => {
    if (!segment.translations?.length) {
      return accumulator;
    }

    accumulator[segment.id] = {
      ...(accumulator[segment.id] ?? {}),
      ...Object.fromEntries(
        segment.translations.map((translation) => [translation.target_language, translation.translated_text]),
      ),
    };
    return accumulator;
  }, {});
};

const getStatusColor = (
  status: string,
): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' => {
  switch (status) {
    case 'created':
      return 'default';
    case 'recording':
      return 'error';
    case 'paused':
      return 'warning';
    case 'ended':
      return 'success';
    case 'ended_abnormal':
      return 'error';
    default:
      return 'default';
  }
};

export default function JoinMeeting() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const { t } = useTranslation();

  const [joinStatus, setJoinStatus] = useState<JoinStatus>('loading');
  const [meetingInfo, setMeetingInfo] = useState<JoinMeetingResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const liveSegments = useTranscriptStore((state) => state.segments);
  const liveTranslations = useTranscriptStore((state) => state.translations);
  const isBackfillInProgress = useTranscriptStore((state) => state.isBackfillInProgress);
  const clearSegments = useTranscriptStore((state) => state.clearSegments);

  const [selectedLanguage, setSelectedLanguage] = useState<string | null>(null);

  const [replaySegments, setReplaySegments] = useState<TranscriptSegment[]>([]);
  const [replayTranslations, setReplayTranslations] = useState<TranslationMap>({});
  const [isLoadingTranscript, setIsLoadingTranscript] = useState(false);
  const [transcriptTotal, setTranscriptTotal] = useState(0);
  const [hasMoreSegments, setHasMoreSegments] = useState(true);

  const [isRequestingTranslation, setIsRequestingTranslation] = useState(false);
  const [translationError, setTranslationError] = useState<string | null>(null);

  const [summary, setSummary] = useState<MeetingSummary | null>(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const shouldConnectWebSocket = joinStatus === 'active' && meetingInfo !== null;

  const {
    connectionState,
    participantCount,
    setLanguage,
  } = useMeetingWebSocket({
    meetingId: shouldConnectWebSocket ? meetingInfo.meeting_id : '',
    token: '',
    role: 'participant',
    roomCode: roomCode ?? '',
  });

  useEffect(() => {
    if (!roomCode) {
      setJoinStatus('error');
      setErrorMessage(t('join.invalidRoomCode'));
      return;
    }

    const fetchMeetingInfo = async () => {
      setJoinStatus('loading');
      setErrorMessage(null);

      try {
        const data = await meetingApi.join(roomCode);
        setMeetingInfo(data);

        if (data.status === 'ended' || data.status === 'ended_abnormal') {
          setJoinStatus('ended');
        } else {
          setJoinStatus('active');
        }
      } catch (error) {
        setJoinStatus('error');
        setErrorMessage(
          error instanceof Error ? error.message : t('join.fetchError'),
        );
      }
    };

    void fetchMeetingInfo();
  }, [roomCode, t]);

  useEffect(() => {
    clearSegments();

    return () => {
      clearSegments();
    };
  }, [roomCode, clearSegments]);

  const loadTranscriptPage = useCallback(
    async (offset: number) => {
      if (!meetingInfo?.meeting_id) {
        return;
      }

      setIsLoadingTranscript(true);

      try {
        const response = await meetingApi.getPublicTranscript(roomCode ?? '', {
          limit: TRANSCRIPT_PAGE_SIZE,
          offset,
          ...(selectedLanguage ? { include_translations: selectedLanguage } : {}),
        });

        setReplaySegments((prev) => {
          const newSegments = response.segments.filter(
            (segment) => !prev.some((p) => p.id === segment.id),
          );
          return [...prev, ...newSegments].sort((a, b) => a.sequence - b.sequence);
        });
        setReplayTranslations((prev) => ({ ...prev, ...mergeTranslations(response.segments) }));
        setTranscriptTotal(response.total);
        setHasMoreSegments(offset + response.segments.length < response.total);
      } catch (_error) {
        // Silently fail - transcript loading is non-critical for UX
      } finally {
        setIsLoadingTranscript(false);
      }
    },
    [roomCode, selectedLanguage],
  );

  useEffect(() => {
    if (joinStatus !== 'ended' || !meetingInfo?.meeting_id) {
      return;
    }

    setReplaySegments([]);
    setReplayTranslations({});
    void loadTranscriptPage(0);
  }, [joinStatus, meetingInfo?.meeting_id, loadTranscriptPage]);

  useEffect(() => {
    if (joinStatus !== 'ended' || !meetingInfo?.meeting_id || !meetingInfo?.has_summary) {
      return;
    }

    const fetchSummary = async () => {
      setIsLoadingSummary(true);
      setSummaryError(null);

      try {
        const data = await meetingApi.getPublicSummary(roomCode ?? '');
        setSummary(data);
      } catch (_error) {
        // Silently fail - summary loading is non-critical for UX
      } finally {
        setIsLoadingSummary(false);
      }
    };

    void fetchSummary();
  }, [joinStatus, meetingInfo?.meeting_id, meetingInfo?.has_summary, roomCode]);

  const handleLoadMore = useCallback(() => {
    if (isLoadingTranscript || !hasMoreSegments) {
      return;
    }
    void loadTranscriptPage(replaySegments.length);
  }, [isLoadingTranscript, hasMoreSegments, replaySegments.length, loadTranscriptPage]);

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

  const handleReplayLanguageChange = useCallback(
    async (languageCode: string | null) => {
      setSelectedLanguage(languageCode);
      setTranslationError(null);

      if (!meetingInfo?.meeting_id || !languageCode) {
        return;
      }

      if (meetingInfo.available_translations?.includes(languageCode)) {
        return;
      }

      setIsRequestingTranslation(true);

      try {
        await meetingApi.requestPublicTranslation(roomCode ?? '', languageCode);
        setMeetingInfo((prev) =>
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
    [meetingInfo, roomCode, t],
  );

  const handleGenerateSummary = useCallback(async () => {
    if (!meetingInfo?.meeting_id) {
      return;
    }

    setIsGeneratingSummary(true);
    setSummaryError(null);

    try {
      const response = await meetingApi.generatePublicSummary(roomCode ?? '');
      if (response.status === 'completed' && response.summary) {
        setSummary(response.summary);
        setMeetingInfo((prev) => (prev ? { ...prev, has_summary: true } : prev));
      }
    } catch {
      setSummaryError(t('replay.summaryError'));
    } finally {
      setIsGeneratingSummary(false);
    }
  }, [roomCode, meetingInfo?.meeting_id, t]);

  const getConnectionStatusLabel = useCallback(() => {
    switch (connectionState) {
      case 'connected':
        return t('recording.connected');
      case 'connecting':
      case 'reconnecting':
        return t('recording.reconnecting');
      case 'disconnected':
      case 'error':
        return t('recording.disconnected');
      default:
        return '';
    }
  }, [connectionState, t]);

  const getConnectionStatusColor = useCallback((): 'success' | 'warning' | 'error' => {
    switch (connectionState) {
      case 'connected':
        return 'success';
      case 'connecting':
      case 'reconnecting':
        return 'warning';
      default:
        return 'error';
    }
  }, [connectionState]);

  const handleLanguageChange = useCallback((languageCode: string | null) => {
    setSelectedLanguage(languageCode);
    setLanguage(languageCode);
  }, [setLanguage]);

  if (joinStatus === 'loading') {
    return (
      <Stack alignItems="center" justifyContent="center" spacing={2} sx={{ py: 8 }}>
        <CircularProgress />
        <Typography variant="body1" color="text.secondary">
          {t('common.loading')}
        </Typography>
      </Stack>
    );
  }

  if (joinStatus === 'error' || !meetingInfo) {
    return (
      <Alert severity="error">
        {errorMessage ?? t('join.fetchError')}
      </Alert>
    );
  }

  if (joinStatus === 'ended') {
    return (
      <Stack spacing={3}>
        <Paper sx={{ p: 3 }}>
          <Stack spacing={2}>
            <Typography role="status" aria-live="polite" sx={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
              {isRequestingTranslation ? t('translation.translating') : isGeneratingSummary ? t('summary.generating') : ''}
            </Typography>
            <Stack
              direction="row"
              spacing={2}
              alignItems="flex-start"
              justifyContent="space-between"
              flexWrap="wrap"
            >
              <Box>
                <Typography variant="h5" gutterBottom>
                  {meetingInfo.title ?? t('meeting.untitled')}
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                  <Chip
                    size="small"
                    color={getStatusColor(meetingInfo.status)}
                    label={t(`meeting.status.${meetingInfo.status}`)}
                  />
                  <Chip
                    size="small"
                    icon={<LanguageRoundedIcon />}
                    label={meetingInfo.source_language.toUpperCase()}
                    variant="outlined"
                  />
                </Stack>
              </Box>
            </Stack>

            <Alert severity="info">
              {t('join.meetingEnded')}
            </Alert>
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
              <Typography variant="h6">{t('join.transcriptReplay')}</Typography>

              <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
                <LanguageSelector
                  value={selectedLanguage}
                  onChange={handleReplayLanguageChange}
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

            {meetingInfo.meeting_id && (
              <TranscriptSearch
                roomCode={roomCode ?? ''}
                onResultClick={handleSearchResultClick}
              />
            )}

            <TranscriptView
              segments={replaySegments}
              translations={replayTranslations}
              selectedLanguage={selectedLanguage}
              isLoading={isLoadingTranscript && replaySegments.length === 0}
              autoScroll={false}
            />

            {hasMoreSegments && (
              <Box display="flex" justifyContent="center">
                <Button
                  variant="outlined"
                  onClick={handleLoadMore}
                  disabled={isLoadingTranscript}
                  aria-label={t('replay.loadMore')}
                  startIcon={isLoadingTranscript ? <CircularProgress size={18} /> : undefined}
                >
                  {isLoadingTranscript ? t('common.loading') : t('replay.loadMore')}
                </Button>
              </Box>
            )}

            {transcriptTotal > 0 && (
              <Typography variant="body2" color="text.secondary" textAlign="center">
                {t('replay.segmentCount', {
                  loaded: replaySegments.length,
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
                  aria-label={t('replay.generateSummary')}
                  startIcon={<AutoAwesomeRoundedIcon />}
                  disabled={replaySegments.length === 0}
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

  return (
    <Stack spacing={3}>
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
                {meetingInfo.title ?? t('meeting.untitled')}
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                <Chip
                  size="small"
                  color={getStatusColor(meetingInfo.status)}
                  label={t(`meeting.status.${meetingInfo.status}`)}
                />
                <Chip
                  size="small"
                  icon={<LanguageRoundedIcon />}
                  label={meetingInfo.source_language.toUpperCase()}
                  variant="outlined"
                />
                <ParticipantCount count={participantCount} />
              </Stack>
            </Box>

            <Stack direction="row" spacing={1} alignItems="center">
              <Chip
                size="small"
                color={getConnectionStatusColor()}
                label={getConnectionStatusLabel()}
                variant="filled"
              />
            </Stack>
          </Stack>
        </Stack>
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between" flexWrap="wrap">
            <Typography variant="h6">{t('meeting.liveTranscript')}</Typography>
            <LanguageSelector
              value={selectedLanguage}
              onChange={handleLanguageChange}
              disabled={connectionState !== 'connected'}
            />
          </Stack>
          <TranscriptView
            segments={liveSegments}
            translations={liveTranslations}
            selectedLanguage={selectedLanguage}
            isBackfillInProgress={isBackfillInProgress}
            autoScroll
          />
        </Stack>
      </Paper>
    </Stack>
  );
}
