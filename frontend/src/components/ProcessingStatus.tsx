import { Box, Chip, Stack, Tooltip, Typography } from '@mui/material';
import CloudQueueRoundedIcon from '@mui/icons-material/CloudQueueRounded';
import HourglassEmptyRoundedIcon from '@mui/icons-material/HourglassEmptyRounded';
import PeopleOutlineRoundedIcon from '@mui/icons-material/PeopleOutlineRounded';
import { useTranslation } from 'react-i18next';

import type { ProcessingStatus as ProcessingStatusData } from '@/hooks/useMeetingWebSocket';

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

  const workersColor = workers_online > 0 ? 'success' : 'warning';
  const chunksColor = pending_chunks === 0 ? 'default' : pending_chunks < 5 ? 'primary' : 'warning';

  return (
    <Box
      sx={{
        p: 1.5,
        bgcolor: 'action.hover',
        borderRadius: 1,
      }}
    >
      <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
        <Tooltip title={t('meeting.pendingChunksTooltip')}>
          <Chip
            size="small"
            icon={<HourglassEmptyRoundedIcon />}
            color={chunksColor}
            label={`${pending_chunks} ${t('meeting.pendingChunks')}`}
          />
        </Tooltip>

        <Tooltip title={t('meeting.workersOnlineTooltip')}>
          <Chip
            size="small"
            icon={<PeopleOutlineRoundedIcon />}
            color={workersColor}
            label={`${workers_online} ${t('meeting.workersOnline')}`}
          />
        </Tooltip>

        <Stack direction="row" spacing={0.5} alignItems="center">
          <CloudQueueRoundedIcon fontSize="small" color="action" />
          <Typography variant="caption" color="text.secondary">
            {delayText}
          </Typography>
        </Stack>
      </Stack>
    </Box>
  );
}
