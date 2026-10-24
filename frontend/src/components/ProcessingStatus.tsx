import { Box, Stack, Tooltip, Typography } from '@mui/material';
import CloudQueueRoundedIcon from '@mui/icons-material/CloudQueueRounded';
import HourglassEmptyRoundedIcon from '@mui/icons-material/HourglassEmptyRounded';
import PeopleOutlineRoundedIcon from '@mui/icons-material/PeopleOutlineRounded';
import { useTranslation } from 'react-i18next';

import type { ProcessingStatus as ProcessingStatusData } from '@/hooks/useMeetingWebSocket';
import { MetricChip, SectionCard, StatusBadge } from './SurfacePrimitives';

export interface ProcessingStatusProps {
  status: ProcessingStatusData | null;
}

export default function ProcessingStatus({ status }: ProcessingStatusProps) {
  const { t } = useTranslation();

  if (!status) {
    return null;
  }

  const { pending_chunks, workers_online, estimated_delay_seconds } = status;

  const delayText =
    estimated_delay_seconds < 1
      ? t('meeting.processingDelayNone')
      : estimated_delay_seconds < 5
        ? t('meeting.processingDelayLow')
        : t('meeting.processingDelayHigh', { seconds: estimated_delay_seconds });

  return (
    <SectionCard
      title={t('meeting.processingTitle')}
      description={t('meeting.processingDescription')}
      tone="muted"
    >
      <Stack spacing={2}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} useFlexGap flexWrap="wrap">
          <Tooltip title={t('meeting.pendingChunksTooltip')}>
            <Box>
              <MetricChip
                icon={<HourglassEmptyRoundedIcon sx={{ fontSize: 18, color: 'warning.main' }} />}
                label={t('meeting.pendingChunks')}
                value={pending_chunks}
              />
            </Box>
          </Tooltip>

          <Tooltip title={t('meeting.workersOnlineTooltip')}>
            <Box>
              <MetricChip
                icon={<PeopleOutlineRoundedIcon sx={{ fontSize: 18, color: workers_online > 0 ? 'success.main' : 'warning.main' }} />}
                label={t('meeting.workersOnline')}
                value={workers_online}
              />
            </Box>
          </Tooltip>

          <StatusBadge
            icon={<CloudQueueRoundedIcon sx={{ fontSize: 16 }} />}
            label={delayText}
            tone={estimated_delay_seconds < 5 ? 'processing' : 'paused'}
          />
        </Stack>
        <Typography variant="body2" color="text.secondary">
          {t('meeting.processingHint')}
        </Typography>
      </Stack>
    </SectionCard>
  );
}
