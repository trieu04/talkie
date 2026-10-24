import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  CircularProgress,
  Grid,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import GroupRoundedIcon from '@mui/icons-material/GroupRounded';
import LanguageRoundedIcon from '@mui/icons-material/LanguageRounded';
import LinkRoundedIcon from '@mui/icons-material/LinkRounded';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';

import LanguageSelector from '@/components/LanguageSelector';
import { PageHeader, PageShell } from '@/components/PageShell';
import ProcessingStatus from '@/components/ProcessingStatus';
import RecordingControls from '@/components/RecordingControls';
import { ErrorState, LoadingState } from '@/components/StatePanels';
import SummaryView from '@/components/SummaryView';
import { MetricChip, SectionCard, SectionStack, StatusBadge } from '@/components/SurfacePrimitives';
import TranscriptView from '@/components/TranscriptView';
import { formatMeetingDate, getMeetingStatusIcon, getMeetingStatusTone } from '@/components/meetingUi';
import { useAudioRecorder, type AudioChunk } from '@/hooks/useAudioRecorder';
import { useMeetingWebSocket, type ProcessingStatus as ProcessingStatusData } from '@/hooks/useMeetingWebSocket';
import { meetingApi } from '@/services/meetingApi';
import { showError, showSuccess, useAuthStore, useMeetingStore, useTranscriptStore } from '@/stores';
import type { MeetingSummary } from '@/types';

const buildPublicJoinUrl = (roomCode: string): string => `${window.location.origin}/join/${roomCode}`;

export default function MeetingRoom() {
  const { id: meetingId } = useParams<{ id: string }>();
  const { t } = useTranslation();

  const accessToken = useAuthStore((state) => state.accessToken);
  const currentMeeting = useMeetingStore((state) => state.currentMeeting);
  const setCurrentMeeting = useMeetingStore((state) => state.setCurrentMeeting);

  const segments = useTranscriptStore((state) => state.segments);
  const translations = useTranscriptStore((state) => state.translations);
  const isBackfillInProgress = useTranscriptStore((state) => state.isBackfillInProgress);
  const clearSegments = useTranscriptStore((state) => state.clearSegments);

  const [isLoadingMeeting, setIsLoadingMeeting] = useState(false);
  const [meetingError, setMeetingError] = useState<string | null>(null);
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatusData | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<string | null>(null);

  const [summary, setSummary] = useState<MeetingSummary | null>(null);
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const meeting = currentMeeting?.id === meetingId ? currentMeeting : null;

  useEffect(() => {
    if (!meetingId || meeting) {
      return;
    }

    const fetchMeeting = async () => {
      setIsLoadingMeeting(true);
      setMeetingError(null);

      try {
        const data = await meetingApi.get(meetingId);
        setCurrentMeeting({
          id: data.id,
          room_code: data.room_code,
          title: data.title,
          source_language: data.source_language,
          status: data.status,
          created_at: data.created_at,
          started_at: data.started_at,
          ended_at: data.ended_at,
          join_url: data.join_url,
        });
      } catch {
        setMeetingError(t('meeting.fetchError'));
      } finally {
        setIsLoadingMeeting(false);
      }
    };

    void fetchMeeting();
  }, [meeting, meetingId, setCurrentMeeting, t]);

  useEffect(() => {
    clearSegments();
    return () => {
      clearSegments();
    };
  }, [clearSegments]);

  const handleProcessingStatus = useCallback((status: ProcessingStatusData) => {
    setProcessingStatus(status);
  }, []);

  const { connectionState, participantCount, sendAudioChunk, sendRecordingControl, setLanguage } = useMeetingWebSocket({
    meetingId: meetingId ?? '',
    token: accessToken ?? '',
    role: 'host',
    onProcessingStatus: handleProcessingStatus,
  });

  const handleChunkReady = useCallback(
    (chunk: AudioChunk) => {
      sendAudioChunk(chunk.data, chunk.sequence, chunk.durationMs);
    },
    [sendAudioChunk],
  );

  const { isRecording, error: audioError, permissionStatus, startRecording, stopRecording, pauseRecording, resumeRecording } =
    useAudioRecorder({ onChunkReady: handleChunkReady });

  const handleStartRecording = useCallback(async () => {
    sendRecordingControl('start');
    await startRecording();
  }, [sendRecordingControl, startRecording]);

  const handleStopRecording = useCallback(() => {
    stopRecording();
    sendRecordingControl('stop');
  }, [sendRecordingControl, stopRecording]);

  const handlePauseRecording = useCallback(() => {
    pauseRecording();
    sendRecordingControl('pause');
  }, [pauseRecording, sendRecordingControl]);

  const handleResumeRecording = useCallback(() => {
    sendRecordingControl('resume');
    resumeRecording();
  }, [resumeRecording, sendRecordingControl]);

  const handleCopyLink = useCallback(async () => {
    if (!meeting?.room_code) {
      return;
    }

    try {
      await navigator.clipboard.writeText(buildPublicJoinUrl(meeting.room_code));
      showSuccess(t('common.copied'));
    } catch {
      showError(t('common.copyFailed'));
    }
  }, [meeting?.room_code, t]);

  const handleCopyRoomCode = useCallback(async () => {
    if (!meeting?.room_code) {
      return;
    }

    try {
      await navigator.clipboard.writeText(meeting.room_code);
      showSuccess(t('common.copied'));
    } catch {
      showError(t('common.copyFailed'));
    }
  }, [meeting?.room_code, t]);

  const handleLanguageChange = useCallback(
    (languageCode: string | null) => {
      setSelectedLanguage(languageCode);
      setLanguage(languageCode);
    },
    [setLanguage],
  );

  const handleGenerateSummary = useCallback(async () => {
    if (!meetingId) {
      return;
    }

    setIsSummaryLoading(true);
    setSummaryError(null);

    try {
      const result = await meetingApi.generateSummary(meetingId, { regenerate: false });

      if (result.status === 'completed' && result.summary) {
        setSummary(result.summary);
        setIsSummaryLoading(false);
        return;
      }

      const pollInterval = 3000;
      const maxAttempts = 20;
      let attempts = 0;

      const poll = async () => {
        attempts += 1;
        try {
          const summaryData = await meetingApi.getSummary(meetingId);
          setSummary(summaryData);
          setIsSummaryLoading(false);
        } catch {
          if (attempts < maxAttempts) {
            setTimeout(() => {
              void poll();
            }, pollInterval);
          } else {
            setSummaryError(t('summary.generateError'));
            setIsSummaryLoading(false);
          }
        }
      };

      setTimeout(() => {
        void poll();
      }, pollInterval);
    } catch {
      setSummaryError(t('summary.generateError'));
      setIsSummaryLoading(false);
    }
  }, [meetingId, t]);

  const joinUrl = useMemo(
    () => (meeting ? buildPublicJoinUrl(meeting.room_code) : ''),
    [meeting],
  );

  if (isLoadingMeeting) {
    return <LoadingState title={t('meeting.loadingTitle')} description={t('meeting.loadingDescription')} />;
  }

  if (meetingError || !meeting) {
    return <ErrorState title={t('meeting.errorTitle')} description={meetingError ?? t('meeting.notFound')} />;
  }

  return (
    <PageShell
      header={
        <PageHeader
          eyebrow={t('meeting.workspaceEyebrow')}
          title={meeting.title ?? t('meeting.untitled')}
          description={t('meeting.workspaceDescription')}
          aside={
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              <StatusBadge
                label={t(`meeting.status.${meeting.status}`)}
                tone={getMeetingStatusTone(meeting.status)}
                icon={getMeetingStatusIcon(meeting.status)}
              />
              <MetricChip icon={<LanguageRoundedIcon sx={{ fontSize: 18, color: 'text.secondary' }} />} label={t('home.sourceLanguage')} value={t(`translation.languages.${meeting.source_language}`)} />
              <MetricChip icon={<GroupRoundedIcon sx={{ fontSize: 18, color: 'text.secondary' }} />} label={t('meeting.participants')} value={participantCount} />
            </Stack>
          }
        />
      }
    >
      <Grid container spacing={3}>
        <Grid item xs={12} xl={8}>
          <SectionStack>
            <SectionCard title={t('meeting.recordingControls')} description={t('meeting.recordingControlsDescription')}>
              <RecordingControls
                status={meeting.status}
                isConnected={connectionState === 'connected'}
                isRecording={isRecording}
                permissionStatus={permissionStatus}
                startedAt={meeting.started_at ?? null}
                onStart={handleStartRecording}
                onStop={handleStopRecording}
                onPause={handlePauseRecording}
                onResume={handleResumeRecording}
                error={audioError}
              />
            </SectionCard>

            {processingStatus ? <ProcessingStatus status={processingStatus} /> : null}

            <SectionCard
              title={t('meeting.liveTranscript')}
              description={t('meeting.transcriptDescription')}
              actions={
                <LanguageSelector value={selectedLanguage} onChange={handleLanguageChange} disabled={connectionState !== 'connected'} />
              }
            >
              <TranscriptView
                segments={segments}
                translations={translations}
                selectedLanguage={selectedLanguage}
                isBackfillInProgress={isBackfillInProgress}
                autoScroll
              />
            </SectionCard>
          </SectionStack>
        </Grid>

        <Grid item xs={12} xl={4}>
          <SectionStack>
            <SectionCard title={t('meeting.shareSection')} description={t('meeting.shareDescription')}>
              <Stack spacing={2}>
                <MetricChip label={t('home.roomCode')} value={meeting.room_code} icon={<LinkRoundedIcon sx={{ fontSize: 18, color: 'text.secondary' }} />} />
                <Stack direction="row" spacing={1}>
                  <Button variant="outlined" onClick={() => void handleCopyRoomCode()} startIcon={<ContentCopyRoundedIcon />}>
                    {t('meeting.copyRoomCode')}
                  </Button>
                  <Button variant="outlined" onClick={() => void handleCopyLink()} startIcon={<ContentCopyRoundedIcon />}>
                    {t('meeting.copyLink')}
                  </Button>
                </Stack>
                <TextField value={joinUrl} size="small" inputProps={{ 'aria-label': t('meeting.joinUrlLabel') }} InputProps={{ readOnly: true }} />
                <Typography variant="body2" color="text.secondary">
                  {t('meeting.participantsConnected', { count: participantCount })}
                </Typography>
              </Stack>
            </SectionCard>

            <SectionCard
              title={t('summary.title')}
              description={t('summary.description')}
              actions={
                !summary && !isSummaryLoading ? (
                  <Button
                    variant="contained"
                    onClick={handleGenerateSummary}
                    startIcon={isSummaryLoading ? <CircularProgress size={16} color="inherit" /> : <AutoAwesomeRoundedIcon />}
                    disabled={meeting.status !== 'ended' && meeting.status !== 'ended_abnormal'}
                  >
                    {t('summary.generateButton')}
                  </Button>
                ) : null
              }
            >
              <SummaryView summary={summary} isLoading={isSummaryLoading} error={summaryError} />
            </SectionCard>

            <SectionCard title={t('meeting.detailsTitle')} description={t('meeting.detailsDescription')} tone="muted">
              <Stack spacing={1.5}>
                <MetricChip label={t('meeting.createdAt')} value={formatMeetingDate(meeting.created_at)} />
                <MetricChip label={t('meeting.startedAt')} value={formatMeetingDate(meeting.started_at)} />
                <MetricChip label={t('meeting.connectionState')} value={connectionState} />
              </Stack>
            </SectionCard>
          </SectionStack>
        </Grid>
      </Grid>
    </PageShell>
  );
}
