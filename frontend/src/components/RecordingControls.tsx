import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import { useTranslation } from 'react-i18next';

import type { MeetingStatus } from '@/types';

export interface RecordingControlsProps {
  status: MeetingStatus;
  isConnected: boolean;
  isRecording: boolean;
  permissionStatus: 'prompt' | 'granted' | 'denied' | 'unknown';
  startedAt: string | null;
  onStart: () => void;
  onStop: () => void;
  onPause: () => void;
  onResume: () => void;
  error?: string | null;
}

type ConnectionIndicatorStatus = 'connected' | 'reconnecting' | 'disconnected';

const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  return `${minutes}:${String(secs).padStart(2, '0')}`;
};

const CONNECTION_INDICATOR_COLORS: Record<ConnectionIndicatorStatus, string> = {
  connected: '#22c55e',
  reconnecting: '#eab308',
  disconnected: '#ef4444',
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
  const [isErrorDismissed, setIsErrorDismissed] = useState(false);

  const connectionIndicatorStatus: ConnectionIndicatorStatus = (() => {
    if (isConnected) {
      return 'connected';
    }

    if (status === 'recording' || status === 'paused') {
      return 'reconnecting';
    }

    return 'disconnected';
  })();

  const connectionStatusText = (() => {
    switch (connectionIndicatorStatus) {
      case 'connected':
        return t('recording.connected');
      case 'reconnecting':
        return t('recording.reconnecting');
      case 'disconnected':
        return t('recording.disconnected');
    }
  })();

  const isActiveRecording = status === 'recording';
  const isPaused = status === 'paused';
  const isEnded = status === 'ended' || status === 'ended_abnormal';
  const canStart = status === 'created' && isConnected;
  const canStop = isActiveRecording || isPaused;
  const canPause = isActiveRecording;
  const canResume = isPaused;

  useEffect(() => {
    if (!startedAt || isEnded) {
      setElapsedSeconds(0);
      return undefined;
    }

    const startTime = new Date(startedAt).getTime();

    const updateElapsed = () => {
      const now = Date.now();
      setElapsedSeconds(Math.floor((now - startTime) / 1000));
    };

    updateElapsed();

    if (isPaused) {
      return undefined;
    }

    const intervalId = window.setInterval(updateElapsed, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [startedAt, isEnded, isPaused]);

  useEffect(() => {
    setIsErrorDismissed(false);
  }, [error]);

  const handleDismissError = useCallback(() => {
    setIsErrorDismissed(true);
  }, []);

  const handleRequestPermission = useCallback(() => {
    onStart();
  }, [onStart]);

  const showError = error && !isErrorDismissed;
  const showPermissionWarning = permissionStatus === 'denied';
  const showPermissionPrompt = permissionStatus === 'prompt' && status === 'created';

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
        onStart();
        return;
      }

      if (canStop) {
        onStop();
      }
    },
    [canStart, canStop, onStart, onStop],
  );

  return (
    <Stack
      component="section"
      spacing={2}
      alignItems="center"
      aria-label="Recording controls"
      tabIndex={0}
      onKeyDown={handleKeyboardToggle}
      sx={{ outline: 'none', '&:focus-visible': { outline: '3px solid', outlineColor: 'primary.main', outlineOffset: 2, borderRadius: 2 } }}
    >
      <Tooltip title={connectionStatusText} placement="top">
        <Box
          role="status"
          aria-live="polite"
          aria-atomic="true"
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            px: 1.5,
            py: 0.5,
            borderRadius: 2,
            bgcolor: 'action.hover',
          }}
        >
          <Box
            sx={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              bgcolor: CONNECTION_INDICATOR_COLORS[connectionIndicatorStatus],
              boxShadow:
                connectionIndicatorStatus === 'reconnecting'
                  ? `0 0 8px ${CONNECTION_INDICATOR_COLORS.reconnecting}`
                  : 'none',
              animation:
                connectionIndicatorStatus === 'reconnecting'
                  ? 'pulseReconnect 1.5s ease-in-out infinite'
                  : 'none',
              '@keyframes pulseReconnect': {
                '0%, 100%': { opacity: 1 },
                '50%': { opacity: 0.4 },
              },
            }}
          />
          <Typography variant="caption" color="text.secondary">
            {connectionStatusText}
          </Typography>
        </Box>
      </Tooltip>

      {(isActiveRecording || isPaused) && (
        <Stack direction="row" alignItems="center" spacing={1}>
          <FiberManualRecordIcon
            sx={{
              fontSize: 12,
              color: isActiveRecording ? '#ef4444' : 'text.disabled',
              animation: isActiveRecording ? 'blink 1s ease-in-out infinite' : 'none',
              '@keyframes blink': {
                '0%, 100%': { opacity: 1 },
                '50%': { opacity: 0.3 },
              },
            }}
          />
          <Typography
            variant="h5"
            fontWeight={600}
            fontFamily="monospace"
            color={isPaused ? 'text.disabled' : 'text.primary'}
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            {formatDuration(elapsedSeconds)}
          </Typography>
          {isPaused && (
            <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
              {t('recording.paused')}
            </Typography>
          )}
        </Stack>
      )}

      <Stack direction="row" spacing={2} alignItems="center">
        {status === 'created' && (
          <Tooltip title={canStart ? t('recording.start') : t('recording.waitingConnection')}>
            <span>
              <IconButton
                onClick={onStart}
                disabled={!canStart}
                aria-label={t('recording.start')}
                sx={{
                  bgcolor: canStart ? '#ef4444' : 'action.disabledBackground',
                  color: canStart ? 'white' : 'action.disabled',
                  width: 64,
                  height: 64,
                  '&:hover': {
                    bgcolor: canStart ? '#dc2626' : 'action.disabledBackground',
                  },
                  '&:disabled': {
                    bgcolor: 'action.disabledBackground',
                    color: 'action.disabled',
                  },
                }}
              >
                <MicIcon sx={{ fontSize: 32 }} />
              </IconButton>
            </span>
          </Tooltip>
        )}

        {canPause && (
          <Tooltip title={t('recording.pause')}>
            <IconButton
              onClick={onPause}
              aria-label={t('recording.pause')}
              sx={{
                bgcolor: 'action.hover',
                width: 48,
                height: 48,
                '&:hover': {
                  bgcolor: 'action.selected',
                },
              }}
            >
              <PauseIcon sx={{ fontSize: 24 }} />
            </IconButton>
          </Tooltip>
        )}

        {canResume && (
          <Tooltip title={t('recording.resume')}>
            <IconButton
              onClick={onResume}
              aria-label={t('recording.resume')}
              sx={{
                bgcolor: '#22c55e',
                color: 'white',
                width: 48,
                height: 48,
                '&:hover': {
                  bgcolor: '#16a34a',
                },
              }}
            >
              <PlayArrowIcon sx={{ fontSize: 24 }} />
            </IconButton>
          </Tooltip>
        )}

        {canStop && (
          <Tooltip title={t('recording.stop')}>
            <IconButton
              onClick={onStop}
              aria-label={t('recording.stop')}
              sx={{
                bgcolor: '#ef4444',
                color: 'white',
                width: 64,
                height: 64,
                '&:hover': {
                  bgcolor: '#dc2626',
                },
              }}
            >
              <StopIcon sx={{ fontSize: 32 }} />
            </IconButton>
          </Tooltip>
        )}
      </Stack>

      {isRecording && isActiveRecording && (
        <Typography variant="caption" color="error" fontWeight={500}>
          {t('recording.recordingInProgress')}
        </Typography>
      )}

      {isEnded && (
        <Typography color="text.secondary">{t('recording.recordingEnded')}</Typography>
      )}

      {showPermissionWarning && (
        <Alert
          severity="warning"
          icon={<MicOffIcon />}
          sx={{ width: '100%', maxWidth: 400 }}
        >
          {t('recording.microphoneDenied')}
        </Alert>
      )}

      {showPermissionPrompt && (
        <Button
          variant="outlined"
          startIcon={<MicIcon />}
          onClick={handleRequestPermission}
          sx={{ mt: 1 }}
        >
          {t('recording.grantMicrophoneAccess')}
        </Button>
      )}

      {showError && (
        <Alert
          severity="error"
          sx={{ width: '100%', maxWidth: 400 }}
          action={
            <IconButton
              aria-label={t('common.cancel')}
              color="inherit"
              size="small"
              onClick={handleDismissError}
            >
              <CloseIcon fontSize="inherit" />
            </IconButton>
          }
        >
          {error}
        </Alert>
      )}
    </Stack>
  );
}
