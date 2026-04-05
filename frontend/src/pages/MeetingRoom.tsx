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
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import GroupRoundedIcon from '@mui/icons-material/GroupRounded';
import LanguageRoundedIcon from '@mui/icons-material/LanguageRounded';
import LinkRoundedIcon from '@mui/icons-material/LinkRounded';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';

import ProcessingStatus from '@/components/ProcessingStatus';
import RecordingControls from '@/components/RecordingControls';
import TranscriptView from '@/components/TranscriptView';
import { useAudioRecorder, type AudioChunk } from '@/hooks/useAudioRecorder';
import {
  useMeetingWebSocket,
  type ProcessingStatus as ProcessingStatusData,
} from '@/hooks/useMeetingWebSocket';
import { meetingApi } from '@/services/meetingApi';
import { useAuthStore, useMeetingStore, useTranscriptStore } from '@/stores';

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
  const clearSegments = useTranscriptStore((state) => state.clearSegments);

  const [isLoadingMeeting, setIsLoadingMeeting] = useState(false);
  const [meetingError, setMeetingError] = useState<string | null>(null);
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatusData | null>(null);
  const [copied, setCopied] = useState(false);

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

  if (isLoadingMeeting) {
    return (
      <Stack spacing={3}>
        <Skeleton variant="rounded" height={100} />
        <Skeleton variant="rounded" height={60} />
        <Skeleton variant="rounded" height={300} />
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
                <IconButton size="small" onClick={handleCopyRoomCode}>
                  <ContentCopyRoundedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
          </Stack>
        </Stack>
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Typography variant="h6">{t('meeting.recordingControls')}</Typography>

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

      <Paper sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Typography variant="h6">{t('meeting.liveTranscript')}</Typography>
          <TranscriptView
            segments={segments}
            translations={translations}
            autoScroll
          />
        </Stack>
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Typography variant="h6">{t('meeting.shareSection')}</Typography>

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
              InputProps={{
                readOnly: true,
              }}
            />
            <Tooltip title={copied ? t('common.copied') : t('meeting.copyLink')}>
              <Button
                variant="outlined"
                onClick={handleCopyLink}
                startIcon={<ContentCopyRoundedIcon />}
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
    </Stack>
  );
}
