import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  IconButton,
  Paper,
  Skeleton,
  Stack,
  TextField,
  Tooltip,
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
import ProcessingStatus from '@/components/ProcessingStatus';
import RecordingControls from '@/components/RecordingControls';
import SummaryView from '@/components/SummaryView';
import { SummarySkeleton, TranscriptSkeleton } from '@/components/Skeleton';
import TranscriptView from '@/components/TranscriptView';
import { useAudioRecorder, type AudioChunk } from '@/hooks/useAudioRecorder';
import {
  useMeetingWebSocket,
  type ProcessingStatus as ProcessingStatusData,
} from '@/hooks/useMeetingWebSocket';
import { meetingApi } from '@/services/meetingApi';
import { useAuthStore, useMeetingStore, useTranscriptStore } from '@/stores';
import type { MeetingSummary } from '@/types';

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
  const [copied, setCopied] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<string | null>(null);

  const [summary, setSummary] = useState<MeetingSummary | null>(null);
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const meeting = currentMeeting?.id === meetingId ? currentMeeting : null;

  useEffect(() => {
    if (!meetingId) {
      return;
    }

    if (meeting) {
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
  }, [meetingId, meeting, setCurrentMeeting, t]);

  useEffect(() => {
    clearSegments();

    return () => {
      clearSegments();
    };
  }, [meetingId, clearSegments]);

  const handleProcessingStatus = useCallback((status: ProcessingStatusData) => {
    setProcessingStatus(status);
  }, []);

  const {
    connectionState,
    participantCount,
    sendAudioChunk,
    sendRecordingControl,
    setLanguage,
  } = useMeetingWebSocket({
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

  const {
    isRecording,
    error: audioError,
    permissionStatus,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
  } = useAudioRecorder({
    onChunkReady: handleChunkReady,
  });

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
  }, [sendRecordingControl, pauseRecording]);

  const handleResumeRecording = useCallback(async () => {
    sendRecordingControl('resume');
    resumeRecording();
  }, [sendRecordingControl, resumeRecording]);

  const handleCopyLink = useCallback(async () => {
    if (!meeting?.join_url) {
      return;
    }

    try {
      await navigator.clipboard.writeText(meeting.join_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* empty */
    }
  }, [meeting?.join_url]);

  const handleCopyRoomCode = useCallback(async () => {
    if (!meeting?.room_code) {
      return;
    }

    try {
      await navigator.clipboard.writeText(meeting.room_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* empty */
    }
  }, [meeting?.room_code]);

  const handleLanguageChange = useCallback((languageCode: string | null) => {
    setSelectedLanguage(languageCode);
    setLanguage(languageCode);
  }, [setLanguage]);

  const handleGenerateSummary = useCallback(async () => {
    if (!meetingId) return;

    setIsSummaryLoading(true);
    setSummaryError(null);

    try {
      const result = await meetingApi.generateSummary(meetingId, { regenerate: false });

      if (result.status === 'completed' && result.summary) {
        setSummary(result.summary);
        setIsSummaryLoading(false);
        return;
      }

      // Poll for completion when status is 'processing'
      const pollInterval = 3000;
      const maxAttempts = 20; // ~60 seconds
      let attempts = 0;

      const poll = async () => {
        attempts += 1;
        try {
          const summaryData = await meetingApi.getSummary(meetingId);
          setSummary(summaryData);
          setIsSummaryLoading(false);
        } catch {
          if (attempts < maxAttempts) {
            setTimeout(() => void poll(), pollInterval);
          } else {
            setSummaryError(t('summary.generateError'));
            setIsSummaryLoading(false);
          }
        }
      };

      setTimeout(() => void poll(), pollInterval);
    } catch {
      setSummaryError(t('summary.generateError'));
      setIsSummaryLoading(false);
    }
  }, [meetingId, t]);

  if (isLoadingMeeting) {
    return (
      <Stack spacing={3}>
        <Skeleton variant="rounded" height={96} />
        <SummarySkeleton />
        <TranscriptSkeleton />
      </Stack>
    );
  }

  if (meetingError || !meeting) {
    return (
      <Alert severity="error">
        {meetingError ?? t('meeting.notFound')}
      </Alert>
    );
  }

  const joinUrl = meeting.join_url ?? `${window.location.origin}/join/${meeting.room_code}`;

  return (
    <Stack spacing={3}>
      <Paper component="section" sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Stack
            direction="row"
            spacing={2}
            alignItems="flex-start"
            justifyContent="space-between"
            flexWrap="wrap"
          >
            <Box>
              <Typography component="h1" variant="h5" gutterBottom>
                {meeting.title ?? t('meeting.untitled')}
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                <Chip
                  size="small"
                  color={getStatusColor(meeting.status)}
                  label={t(`meeting.status.${meeting.status}`)}
                />
                <Chip
                  size="small"
                  icon={<LanguageRoundedIcon />}
                  label={meeting.source_language.toUpperCase()}
                  variant="outlined"
                />
                <Chip
                  size="small"
                  icon={<GroupRoundedIcon />}
                  label={participantCount}
                  variant="outlined"
                />
              </Stack>
            </Box>

            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="body2" color="text.secondary" fontFamily="monospace">
                {meeting.room_code}
              </Typography>
              <Tooltip title={copied ? t('common.copied') : t('meeting.copyRoomCode')}>
                <IconButton size="small" onClick={handleCopyRoomCode} aria-label={t('meeting.copyRoomCode')}>
                  <ContentCopyRoundedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
          </Stack>
        </Stack>
      </Paper>

      <Paper component="section" sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Typography component="h2" variant="h6">
            {t('meeting.recordingControls')}
          </Typography>

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

          {processingStatus && (
            <>
              <Divider />
              <ProcessingStatus status={processingStatus} />
            </>
          )}
        </Stack>
      </Paper>

      <Paper component="section" sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between" flexWrap="wrap">
            <Typography component="h2" variant="h6">
              {t('meeting.liveTranscript')}
            </Typography>
            <LanguageSelector
              value={selectedLanguage}
              onChange={handleLanguageChange}
              disabled={connectionState !== 'connected'}
            />
          </Stack>
          <TranscriptView
            segments={segments}
            translations={translations}
            selectedLanguage={selectedLanguage}
            isBackfillInProgress={isBackfillInProgress}
            autoScroll
          />
        </Stack>
      </Paper>

      <Paper component="section" sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Typography component="h2" variant="h6">
            {t('meeting.shareSection')}
          </Typography>

          <Stack direction="row" spacing={1} alignItems="center">
            <LinkRoundedIcon color="action" />
            <Typography variant="body2" color="text.secondary">
              {t('meeting.joinUrlLabel')}
            </Typography>
          </Stack>

          <Stack direction="row" spacing={1}>
              <TextField
                value={joinUrl}
                size="small"
                fullWidth
                inputProps={{ 'aria-label': t('meeting.joinUrlLabel') }}
                InputProps={{
                  readOnly: true,
                }}
              />
              <Tooltip title={copied ? t('common.copied') : t('meeting.copyLink')}>
                <Button
                  variant="outlined"
                  onClick={handleCopyLink}
                  startIcon={<ContentCopyRoundedIcon />}
                  aria-label={t('meeting.copyLink')}
                >
                  {t('common.copy')}
                </Button>
              </Tooltip>
            </Stack>

          <Typography variant="caption" color="text.secondary">
            {t('meeting.participantsConnected', { count: participantCount })}
          </Typography>
        </Stack>
      </Paper>

      <Paper component="section" sx={{ p: 3 }}>
        <Stack spacing={2}>
          {!summary && !isSummaryLoading && (
            <Button
              variant="contained"
              onClick={handleGenerateSummary}
              startIcon={<AutoAwesomeRoundedIcon />}
              disabled={meeting.status !== 'ended' && meeting.status !== 'ended_abnormal'}
            >
              {t('summary.generateButton')}
            </Button>
          )}
          <SummaryView
            summary={summary}
            isLoading={isSummaryLoading}
            error={summaryError}
          />
        </Stack>
      </Paper>
    </Stack>
  );
}
