import AccessTimeRoundedIcon from '@mui/icons-material/AccessTimeRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import HourglassTopRoundedIcon from '@mui/icons-material/HourglassTopRounded';
import PauseCircleRoundedIcon from '@mui/icons-material/PauseCircleRounded';
import RadioButtonCheckedRoundedIcon from '@mui/icons-material/RadioButtonCheckedRounded';
import ReportProblemRoundedIcon from '@mui/icons-material/ReportProblemRounded';
import type { ReactNode } from 'react';

import type { MeetingStatus } from '@/types';

export const SUPPORTED_SOURCE_LANGUAGES = [
  { code: 'vi', translationKey: 'translation.languages.vi' },
  { code: 'en', translationKey: 'translation.languages.en' },
  { code: 'ja', translationKey: 'translation.languages.ja' },
  { code: 'ko', translationKey: 'translation.languages.ko' },
  { code: 'zh', translationKey: 'translation.languages.zh' },
] as const;

export function formatMeetingDate(value?: string | null): string {
  if (!value) {
    return '—';
  }

  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDuration(seconds: number | undefined): string {
  if (!seconds) {
    return '—';
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

export function getMeetingStatusTone(status: MeetingStatus): 'default' | 'live' | 'paused' | 'completed' | 'danger' {
  switch (status) {
    case 'recording':
      return 'live';
    case 'paused':
      return 'paused';
    case 'ended':
      return 'completed';
    case 'ended_abnormal':
      return 'danger';
    default:
      return 'default';
  }
}

export function getMeetingStatusIcon(status: MeetingStatus): ReactNode {
  switch (status) {
    case 'recording':
      return <RadioButtonCheckedRoundedIcon sx={{ fontSize: 16 }} />;
    case 'paused':
      return <PauseCircleRoundedIcon sx={{ fontSize: 16 }} />;
    case 'ended':
      return <CheckCircleRoundedIcon sx={{ fontSize: 16 }} />;
    case 'ended_abnormal':
      return <ReportProblemRoundedIcon sx={{ fontSize: 16 }} />;
    default:
      return <HourglassTopRoundedIcon sx={{ fontSize: 16 }} />;
  }
}

export function getDurationMetricIcon(): ReactNode {
  return <AccessTimeRoundedIcon sx={{ fontSize: 18, color: 'text.secondary' }} />;
}
