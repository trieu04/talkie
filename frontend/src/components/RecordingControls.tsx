import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  CircularProgress,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import MicRoundedIcon from '@mui/icons-material/MicRounded';
import MicOffRoundedIcon from '@mui/icons-material/MicOffRounded';
import PauseRoundedIcon from '@mui/icons-material/PauseRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import RadioButtonCheckedRoundedIcon from '@mui/icons-material/RadioButtonCheckedRounded';
import StopRoundedIcon from '@mui/icons-material/StopRounded';
import { useTranslation } from 'react-i18next';

import type { MeetingStatus } from '@/types';
import { MetricChip, StatusBadge } from './SurfacePrimitives';

export interface RecordingControlsProps {
  status: MeetingStatus;
  isConnected: boolean;
  isRecording: boolean;
  permissionStatus: 'prompt' | 'granted' | 'denied' | 'unknown';
  startedAt: string | null;
  onStart: () => void | Promise<void>;
  onStop: () => void;
  onPause: () => void;
  onResume: () => void;
  error?: string | null;
}

const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  return `${minutes}:${String(secs).padStart(2, '0')}`;
};

export default function RecordingControls({
  status,
  isConnected,
  isRecording,
  permissionStatus,
  startedAt,
  onStart,
  onStop,
  onPause,
  onResume,
  error,
}: RecordingControlsProps) {
  const { t } = useTranslation();
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isStarting, setIsStarting] = useState(false);

  const isPaused = status === 'paused';
  const isEnded = status === 'ended' || status === 'ended_abnormal';
  const isActiveRecording = status === 'recording';
  const canStart = status === 'created' && isConnected && !isStarting;
  const canPause = isActiveRecording;
  const canResume = isPaused;
  const canStop = isActiveRecording || isPaused;

  useEffect(() => {
    if (!startedAt || isEnded) {
      setElapsedSeconds(0);
      return undefined;
    }

    const startedAtMs = new Date(startedAt).getTime();
    const updateElapsed = () => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000)));
    };

    updateElapsed();

    if (isPaused) {
      return undefined;
    }

    const intervalId = window.setInterval(updateElapsed, 1000);
    return () => window.clearInterval(intervalId);
  }, [isEnded, isPaused, startedAt]);

  const connectionTone = useMemo(() => {
    if (isConnected) {
      return 'completed' as const;
    }

    if (isActiveRecording || isPaused) {
      return 'reconnecting' as const;
    }

    return 'danger' as const;
  }, [isActiveRecording, isConnected, isPaused]);

  const connectionLabel = useMemo(() => {
    if (isConnected) {
      return t('recording.connected');
    }

    if (isActiveRecording || isPaused) {
      return t('recording.reconnecting');
    }

    return t('recording.disconnected');
  }, [isActiveRecording, isConnected, isPaused, t]);

  const handleStart = useCallback(async () => {
    setIsStarting(true);
    try {
      await onStart();
    } finally {
      setIsStarting(false);
    }
  }, [onStart]);

  const handleKeyboardToggle = useCallback(
    (event: React.KeyboardEvent<HTMLElement>) => {
      if (event.currentTarget !== event.target) {
        return;
      }

      if (event.key !== 'Enter' && event.key !== ' ') {
        return;
      }

      event.preventDefault();

      if (canStart) {
        void handleStart();
        return;
      }

      if (canStop) {
        onStop();
      }
    },
    [canStart, canStop, handleStart, onStop],
  );

  return (
    <Stack
      component="section"
      aria-label="Recording controls"
      spacing={2.5}
      alignItems="stretch"
      tabIndex={0}
      onKeyDown={handleKeyboardToggle}
      sx={{
        outline: 'none',
        '&:focus-visible': {
          outline: '3px solid',
          outlineColor: 'primary.main',
          outlineOffset: 2,
          borderRadius: 4,
        },
      }}
    >
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }}>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <StatusBadge label={connectionLabel} tone={connectionTone} />
          <StatusBadge
            label={t(`meeting.status.${status}`)}
            tone={isActiveRecording ? 'live' : isPaused ? 'paused' : isEnded ? 'completed' : 'default'}
          />
        </Stack>
        <MetricChip
          icon={<RadioButtonCheckedRoundedIcon sx={{ fontSize: 18, color: isPaused ? 'warning.main' : 'error.main' }} />}
          label={t('recording.elapsed')}
          value={canStop || isEnded ? formatDuration(elapsedSeconds) : '00:00'}
        />
      </Stack>

      <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ xs: 'stretch', lg: 'center' }}>
        <Stack spacing={0.5}>
          <Typography variant="sectionTitle">{t('recording.primaryActionTitle')}</Typography>
          <Typography variant="body2" color="text.secondary">
            {isActiveRecording
              ? t('recording.recordingInProgress')
              : isPaused
                ? t('recording.pausedHelper')
                : isEnded
                  ? t('recording.recordingEnded')
                  : t('recording.readyHelper')}
          </Typography>
        </Stack>

        <Stack direction="row" spacing={1.5} alignItems="center" justifyContent={{ xs: 'space-between', sm: 'flex-end' }} flexWrap="wrap" useFlexGap>
          {status === 'created' ? (
            <Button
              variant="contained"
              color="error"
              startIcon={isStarting ? <CircularProgress size={18} color="inherit" /> : <MicRoundedIcon />}
              disabled={!canStart}
              onClick={() => void handleStart()}
              sx={{ minWidth: 168 }}
            >
              {t('recording.start')}
            </Button>
          ) : null}

          {canPause ? (
            <IconButton onClick={onPause} aria-label={t('recording.pause')} sx={{ bgcolor: 'background.level1' }}>
              <PauseRoundedIcon />
            </IconButton>
          ) : null}

          {canResume ? (
            <IconButton onClick={onResume} aria-label={t('recording.resume')} sx={{ bgcolor: 'success.main', color: 'success.contrastText', '&:hover': { bgcolor: 'success.dark' } }}>
              <PlayArrowRoundedIcon />
            </IconButton>
          ) : null}

          {canStop ? (
            <Button variant="outlined" color="error" startIcon={<StopRoundedIcon />} onClick={onStop}>
              {t('recording.stop')}
            </Button>
          ) : null}
        </Stack>
      </Stack>

      {permissionStatus === 'denied' ? (
        <Alert severity="warning" icon={<MicOffRoundedIcon />}>
          {t('recording.microphoneDenied')}
        </Alert>
      ) : null}

      {permissionStatus === 'prompt' && status === 'created' ? (
        <Button variant="text" startIcon={<MicRoundedIcon />} onClick={() => void handleStart()} sx={{ alignSelf: 'flex-start' }}>
          {t('recording.grantMicrophoneAccess')}
        </Button>
      ) : null}

      {error ? <Alert severity="error">{error}</Alert> : null}

      {isRecording && isActiveRecording ? (
        <Typography variant="caption" color="error.main" fontWeight={700}>
          {t('recording.recordingInProgress')}
        </Typography>
      ) : null}
    </Stack>
  );
}
