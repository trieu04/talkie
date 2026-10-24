import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, CircularProgress, Grid, Stack } from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import LanguageRoundedIcon from '@mui/icons-material/LanguageRounded';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useParams } from 'react-router-dom';

import LanguageSelector from '@/components/LanguageSelector';
import { PageHeader, PageShell } from '@/components/PageShell';
import { ErrorState, LoadingState } from '@/components/StatePanels';
import SummaryView from '@/components/SummaryView';
import { MetricChip, SectionCard, SectionStack, StatusBadge } from '@/components/SurfacePrimitives';
import TranscriptSearch from '@/components/TranscriptSearch';
import TranscriptView from '@/components/TranscriptView';
import {
  formatDuration,
  formatMeetingDate,
  getDurationMetricIcon,
  getMeetingStatusIcon,
  getMeetingStatusTone,
} from '@/components/meetingUi';
import { meetingApi, type MeetingResponse } from '@/services/meetingApi';
import type { MeetingSummary, TranscriptSegment, TranslationMap } from '@/types';

const TRANSCRIPT_PAGE_SIZE = 100;

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

export default function MeetingReplay() {
  const { id: meetingId } = useParams<{ id: string }>();
  const { t } = useTranslation();

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
          ...(selectedLanguage ? { include_translations: selectedLanguage } : {}),
        });

        setSegments((previous) => {
          const newSegments = response.segments.filter((segment) => !previous.some((current) => current.id === segment.id));
          return [...previous, ...newSegments].sort((a, b) => a.sequence - b.sequence);
        });
        setTranslations((previous) => ({ ...previous, ...mergeTranslations(response.segments) }));
        setTranscriptTotal(response.total);
        setHasMoreSegments(offset + response.segments.length < response.total);
      } catch {
        setTranslationError(t('replay.transcriptLoadError'));
      } finally {
        setIsLoadingTranscript(false);
      }
    },
    [meetingId, selectedLanguage, t],
  );

  useEffect(() => {
    if (!meetingId || isLoadingMeeting || meetingError) {
      return;
    }

    setSegments([]);
    setTranslations({});
    void loadTranscriptPage(0);
  }, [isLoadingMeeting, loadTranscriptPage, meetingError, meetingId]);

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
      } catch {
        setSummaryError(t('summary.fetchError'));
      } finally {
        setIsLoadingSummary(false);
      }
    };

    void fetchSummary();
  }, [meeting?.has_summary, meetingId, t]);

  const handleLoadMore = useCallback(() => {
    if (isLoadingTranscript || !hasMoreSegments) {
      return;
    }
    void loadTranscriptPage(segments.length);
  }, [hasMoreSegments, isLoadingTranscript, loadTranscriptPage, segments.length]);

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
        setMeeting((previous) =>
          previous
            ? {
                ...previous,
                available_translations: [...(previous.available_translations ?? []), languageCode],
              }
            : previous,
        );
      } catch {
        setTranslationError(t('replay.translationError'));
      } finally {
        setIsRequestingTranslation(false);
      }
    },
    [meeting?.available_translations, meetingId, t],
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
        setMeeting((previous) => (previous ? { ...previous, has_summary: true } : previous));
      }
    } catch {
      setSummaryError(t('replay.summaryError'));
    } finally {
      setIsGeneratingSummary(false);
    }
  }, [meetingId, t]);

  const transcriptDescription = useMemo(
    () => t('replay.segmentCount', { loaded: segments.length, total: transcriptTotal || segments.length }),
    [segments.length, t, transcriptTotal],
  );

  if (isLoadingMeeting) {
    return <LoadingState title={t('replay.loadingTitle')} description={t('replay.loadingDescription')} />;
  }

  if (meetingError || !meeting) {
    return (
      <ErrorState
        title={t('replay.errorTitle')}
        description={meetingError ?? t('meeting.notFound')}
        action={
          <Button component={RouterLink} to="/history" startIcon={<ArrowBackRoundedIcon />}>
            {t('replay.backToHistory')}
          </Button>
        }
      />
    );
  }

  return (
    <PageShell
      header={
        <PageHeader
          eyebrow={t('replay.eyebrow')}
          title={meeting.title ?? t('meeting.untitled')}
          description={t('replay.pageDescription')}
          actions={
            <Button component={RouterLink} to="/history" startIcon={<ArrowBackRoundedIcon />}>
              {t('replay.backToHistory')}
            </Button>
          }
          aside={
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              <StatusBadge
                label={t(`meeting.status.${meeting.status}`)}
                tone={getMeetingStatusTone(meeting.status)}
                icon={getMeetingStatusIcon(meeting.status)}
              />
              <MetricChip icon={<LanguageRoundedIcon sx={{ fontSize: 18, color: 'text.secondary' }} />} label={t('home.sourceLanguage')} value={meeting.source_language.toUpperCase()} />
              <MetricChip icon={getDurationMetricIcon()} label={t('history.duration')} value={formatDuration(meeting.duration_seconds)} />
              <MetricChip label={t('history.createdAt')} value={formatMeetingDate(meeting.created_at)} />
            </Stack>
          }
        />
      }
    >
      <Grid container spacing={3}>
        <Grid item xs={12} xl={8}>
          <SectionStack>
            {translationError ? <Alert severity="warning">{translationError}</Alert> : null}

            {meetingId ? <TranscriptSearch meetingId={meetingId} onResultClick={handleSearchResultClick} /> : null}

            <SectionCard
              title={t('replay.transcript')}
              description={transcriptDescription}
              actions={
                <Stack direction="row" spacing={1} alignItems="center">
                  <LanguageSelector value={selectedLanguage} onChange={handleLanguageChange} disabled={isRequestingTranslation} />
                  {isRequestingTranslation ? <CircularProgress size={18} /> : null}
                </Stack>
              }
            >
              <Stack spacing={2}>
                <TranscriptView
                  segments={segments}
                  translations={translations}
                  selectedLanguage={selectedLanguage}
                  isLoading={isLoadingTranscript && segments.length === 0}
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
                <Button variant="contained" onClick={handleGenerateSummary} startIcon={<AutoAwesomeRoundedIcon />} disabled={segments.length === 0}>
                  {t('replay.generateSummary')}
                </Button>
              ) : null
            }
          >
            <SummaryView summary={summary} isLoading={isLoadingSummary || isGeneratingSummary} error={summaryError} />
          </SectionCard>
        </Grid>
      </Grid>
    </PageShell>
  );
}
