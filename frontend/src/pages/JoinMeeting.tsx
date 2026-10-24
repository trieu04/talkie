import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, CircularProgress, Grid, Stack } from '@mui/material';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import LanguageRoundedIcon from '@mui/icons-material/LanguageRounded';
import SensorsRoundedIcon from '@mui/icons-material/SensorsRounded';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';

import LanguageSelector from '@/components/LanguageSelector';
import { PageHeader, PageShell } from '@/components/PageShell';
import ParticipantCount from '@/components/ParticipantCount';
import { ErrorState, LoadingState } from '@/components/StatePanels';
import SummaryView from '@/components/SummaryView';
import { MetricChip, SectionCard, SectionStack, StatusBadge } from '@/components/SurfacePrimitives';
import TranscriptSearch from '@/components/TranscriptSearch';
import TranscriptView from '@/components/TranscriptView';
import { getMeetingStatusIcon, getMeetingStatusTone } from '@/components/meetingUi';
import { useMeetingWebSocket } from '@/hooks/useMeetingWebSocket';
import { meetingApi, type JoinMeetingResponse } from '@/services/meetingApi';
import { useTranscriptStore } from '@/stores';
import type { MeetingSummary, TranscriptSegment, TranslationMap } from '@/types';

type JoinStatus = 'loading' | 'active' | 'ended' | 'error';
const TRANSCRIPT_PAGE_SIZE = 100;
const TRANSLATION_ERROR_KEYS = new Set(['replay.transcriptLoadError', 'replay.translationError']);
const SUMMARY_ERROR_KEYS = new Set(['summary.fetchError', 'replay.summaryError']);

const mergeTranslations = (segments: TranscriptSegment[]): TranslationMap =>
  segments.reduce<TranslationMap>((accumulator, segment) => {
    if (!segment.translations?.length) {
      return accumulator;
    }

    accumulator[segment.id] = {
      ...(accumulator[segment.id] ?? {}),
      ...Object.fromEntries(segment.translations.map((translation) => [translation.target_language, translation.translated_text])),
    };
    return accumulator;
  }, {});

export default function JoinMeeting() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const { t } = useTranslation();

  const [joinStatus, setJoinStatus] = useState<JoinStatus>('loading');
  const [meetingInfo, setMeetingInfo] = useState<JoinMeetingResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const liveSegments = useTranscriptStore((state) => state.segments);
  const liveTranslations = useTranscriptStore((state) => state.translations);
  const isBackfillInProgress = useTranscriptStore((state) => state.isBackfillInProgress);

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

  const { connectionState, participantCount, setLanguage } = useMeetingWebSocket({
    meetingId: shouldConnectWebSocket ? meetingInfo.meeting_id : '',
    token: '',
    role: 'participant',
    roomCode: roomCode ?? '',
  });

  useEffect(() => {
    let ignore = false;

    useTranscriptStore.getState().clearSegments();
    setMeetingInfo(null);
    setSelectedLanguage(null);
    setReplaySegments([]);
    setReplayTranslations({});
    setTranscriptTotal(0);
    setHasMoreSegments(true);
    setTranslationError(null);
    setSummary(null);
    setSummaryError(null);

    if (!roomCode) {
      setJoinStatus('error');
      setErrorMessage('join.invalidRoomCode');
      return;
    }

    const fetchMeetingInfo = async () => {
      setJoinStatus('loading');
      setErrorMessage(null);

      try {
        const data = await meetingApi.join(roomCode);
        if (ignore) {
          return;
        }
        setMeetingInfo(data);
        setJoinStatus(data.status === 'ended' || data.status === 'ended_abnormal' ? 'ended' : 'active');
      } catch (error) {
        if (ignore) {
          return;
        }
        setJoinStatus('error');
        setErrorMessage(error instanceof Error ? error.message : 'join.fetchError');
      }
    };

    void fetchMeetingInfo();

    return () => {
      ignore = true;
    };
  }, [roomCode]);

  useEffect(() => {
    return () => {
      useTranscriptStore.getState().clearSegments();
    };
  }, []);

  const loadTranscriptPage = useCallback(
    async (offset: number, languageCode?: string | null) => {
      if (!meetingInfo?.meeting_id) {
        return;
      }

      setIsLoadingTranscript(true);

      try {
        const response = await meetingApi.getPublicTranscript(roomCode ?? '', {
          limit: TRANSCRIPT_PAGE_SIZE,
          offset,
          ...(languageCode ? { include_translations: languageCode } : {}),
        });

        setReplaySegments((previous) => {
          const newSegments = response.segments.filter((segment) => !previous.some((current) => current.id === segment.id));
          return [...previous, ...newSegments].sort((a, b) => a.sequence - b.sequence);
        });
        setReplayTranslations((previous) => ({ ...previous, ...mergeTranslations(response.segments) }));
        setTranscriptTotal(response.total);
        setHasMoreSegments(offset + response.segments.length < response.total);
      } catch {
        setTranslationError('replay.transcriptLoadError');
      } finally {
        setIsLoadingTranscript(false);
      }
    },
    [meetingInfo?.meeting_id, roomCode],
  );

  useEffect(() => {
    if (joinStatus !== 'ended' || !meetingInfo?.meeting_id) {
      return;
    }

    setReplaySegments([]);
    setReplayTranslations({});
    void loadTranscriptPage(0, null);
  }, [joinStatus, loadTranscriptPage, meetingInfo?.meeting_id]);

  useEffect(() => {
    if (joinStatus !== 'ended' || !meetingInfo?.meeting_id || !meetingInfo.has_summary) {
      return;
    }

    const fetchSummary = async () => {
      setIsLoadingSummary(true);
      setSummaryError(null);

      try {
        const data = await meetingApi.getPublicSummary(roomCode ?? '');
        setSummary(data);
      } catch {
        setSummaryError('summary.fetchError');
      } finally {
        setIsLoadingSummary(false);
      }
    };

    void fetchSummary();
  }, [joinStatus, meetingInfo?.has_summary, meetingInfo?.meeting_id, roomCode]);

  const handleLoadMore = useCallback(() => {
    if (isLoadingTranscript || !hasMoreSegments) {
      return;
    }
    void loadTranscriptPage(replaySegments.length, selectedLanguage);
  }, [hasMoreSegments, isLoadingTranscript, loadTranscriptPage, replaySegments.length, selectedLanguage]);

  const handleSearchResultClick = useCallback((segmentId: string) => {
    const element = document.getElementById(`segment-${segmentId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element.classList.add('talkie-segment-highlight');
      setTimeout(() => {
        element.classList.remove('talkie-segment-highlight');
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
        void loadTranscriptPage(0, languageCode);
        return;
      }

      setIsRequestingTranslation(true);

      try {
        await meetingApi.requestPublicTranslation(roomCode ?? '', languageCode);
        setMeetingInfo((previous) =>
          previous
            ? {
                ...previous,
                available_translations: [...(previous.available_translations ?? []), languageCode],
              }
            : previous,
        );
        void loadTranscriptPage(0, languageCode);
      } catch {
        setTranslationError('replay.translationError');
      } finally {
        setIsRequestingTranslation(false);
      }
    },
    [loadTranscriptPage, meetingInfo, roomCode],
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
        setMeetingInfo((previous) => (previous ? { ...previous, has_summary: true } : previous));
      }
    } catch {
      setSummaryError('replay.summaryError');
    } finally {
      setIsGeneratingSummary(false);
    }
  }, [meetingInfo?.meeting_id, roomCode]);

  const handleLanguageChange = useCallback(
    (languageCode: string | null) => {
      setSelectedLanguage(languageCode);
      setLanguage(languageCode);
    },
    [setLanguage],
  );

  const connectionTone = useMemo(() => {
    switch (connectionState) {
      case 'connected':
        return 'completed' as const;
      case 'connecting':
      case 'reconnecting':
        return 'reconnecting' as const;
      default:
        return 'danger' as const;
    }
  }, [connectionState]);

  const connectionLabel = useMemo(() => {
    switch (connectionState) {
      case 'connected':
        return t('recording.connected');
      case 'connecting':
      case 'reconnecting':
        return t('recording.reconnecting');
      default:
        return t('recording.disconnected');
    }
  }, [connectionState, t]);

  if (joinStatus === 'loading') {
    return <LoadingState title={t('join.loadingTitle')} description={t('join.loadingDescription')} />;
  }

  if (joinStatus === 'error' || !meetingInfo) {
    const translatedErrorMessage = errorMessage?.startsWith('join.') ? t(errorMessage) : errorMessage;
    return <ErrorState title={t('join.errorTitle')} description={translatedErrorMessage ?? t('join.fetchError')} />;
  }

  if (joinStatus === 'ended') {
    const translatedTranslationError = translationError && TRANSLATION_ERROR_KEYS.has(translationError) ? t(translationError) : translationError;
    const translatedSummaryError = summaryError && SUMMARY_ERROR_KEYS.has(summaryError) ? t(summaryError) : summaryError;

    return (
      <PageShell
        header={
          <PageHeader
            eyebrow={t('join.replayEyebrow')}
            title={meetingInfo.title ?? t('meeting.untitled')}
            description={t('join.meetingEnded')}
            aside={
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                <StatusBadge
                  label={t(`meeting.status.${meetingInfo.status}`)}
                  tone={getMeetingStatusTone(meetingInfo.status)}
                  icon={getMeetingStatusIcon(meetingInfo.status)}
                />
                <MetricChip icon={<LanguageRoundedIcon sx={{ fontSize: 18, color: 'text.secondary' }} />} label={t('home.sourceLanguage')} value={t(`translation.languages.${meetingInfo.source_language}`)} />
              </Stack>
            }
          />
        }
      >
        <Grid container spacing={3}>
          <Grid item xs={12} xl={8}>
            <SectionStack>
              {translatedTranslationError ? <Alert severity="warning">{translatedTranslationError}</Alert> : null}
              <TranscriptSearch roomCode={roomCode ?? ''} onResultClick={handleSearchResultClick} />
              <SectionCard
                title={t('join.transcriptReplay')}
                description={t('replay.segmentCount', { loaded: replaySegments.length, total: transcriptTotal || replaySegments.length })}
                actions={<LanguageSelector value={selectedLanguage} onChange={handleReplayLanguageChange} disabled={isRequestingTranslation} />}
              >
                <Stack spacing={2}>
                  <TranscriptView
                    segments={replaySegments}
                    translations={replayTranslations}
                    selectedLanguage={selectedLanguage}
                    isLoading={isLoadingTranscript && replaySegments.length === 0}
                    autoScroll={false}
                  />
                  {hasMoreSegments ? (
                    <Button variant="outlined" onClick={handleLoadMore} disabled={isLoadingTranscript} startIcon={isLoadingTranscript ? <CircularProgress size={18} /> : undefined}>
                      {isLoadingTranscript ? t('common.loading') : t('replay.loadMore')}
                    </Button>
                  ) : null}
                </Stack>
              </SectionCard>
            </SectionStack>
          </Grid>

          <Grid item xs={12} xl={4}>
            <SectionCard
              title={t('summary.title')}
              description={t('summary.description')}
              actions={
                !summary && !isLoadingSummary && !isGeneratingSummary ? (
                  <Button variant="contained" onClick={handleGenerateSummary} startIcon={<AutoAwesomeRoundedIcon />} disabled={replaySegments.length === 0}>
                    {t('replay.generateSummary')}
                  </Button>
                ) : null
              }
            >
              <SummaryView summary={summary} isLoading={isLoadingSummary || isGeneratingSummary} error={translatedSummaryError} />
            </SectionCard>
          </Grid>
        </Grid>
      </PageShell>
    );
  }

  return (
    <PageShell
      header={
        <PageHeader
          eyebrow={t('join.liveEyebrow')}
          title={meetingInfo.title ?? t('meeting.untitled')}
          description={t('join.liveDescription')}
          aside={
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              <StatusBadge
                label={t(`meeting.status.${meetingInfo.status}`)}
                tone={getMeetingStatusTone(meetingInfo.status)}
                icon={getMeetingStatusIcon(meetingInfo.status)}
              />
              <StatusBadge icon={<SensorsRoundedIcon sx={{ fontSize: 16 }} />} label={connectionLabel} tone={connectionTone} />
              <MetricChip icon={<LanguageRoundedIcon sx={{ fontSize: 18, color: 'text.secondary' }} />} label={t('home.sourceLanguage')} value={t(`translation.languages.${meetingInfo.source_language}`)} />
              <ParticipantCount count={participantCount} />
            </Stack>
          }
        />
      }
    >
      <SectionCard
        title={t('meeting.liveTranscript')}
        description={t('join.liveTranscriptDescription')}
        actions={<LanguageSelector value={selectedLanguage} onChange={handleLanguageChange} disabled={connectionState !== 'connected'} />}
      >
        <TranscriptView
          segments={liveSegments}
          translations={liveTranslations}
          selectedLanguage={selectedLanguage}
          isBackfillInProgress={isBackfillInProgress}
          autoScroll
        />
      </SectionCard>
    </PageShell>
  );
}
