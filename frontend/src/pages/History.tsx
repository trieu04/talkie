import { useCallback, useEffect, useState } from 'react';
import { Alert, Box, Card, CardActionArea, CardContent, Chip, Pagination, Paper, Stack, Typography } from '@mui/material';
import AccessTimeRoundedIcon from '@mui/icons-material/AccessTimeRounded';
import ArticleRoundedIcon from '@mui/icons-material/ArticleRounded';
import SummarizeRoundedIcon from '@mui/icons-material/SummarizeRounded';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';

import { MeetingCardSkeleton } from '@/components/Skeleton';
import { meetingApi, type MeetingResponse } from '@/services/meetingApi';
import type { MeetingStatus } from '@/types';

const PAGE_SIZE = 10;

const STATUS_COLORS: Record<MeetingStatus, 'default' | 'success' | 'warning' | 'error' | 'info'> = {
  created: 'default',
  recording: 'success',
  paused: 'warning',
  ended: 'info',
  ended_abnormal: 'error',
};

function formatDuration(seconds: number | undefined): string {
  if (seconds === undefined || seconds === 0) {
    return '-';
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

interface MeetingCardProps {
  meeting: MeetingResponse;
}

function MeetingCard({ meeting }: MeetingCardProps) {
  const { t } = useTranslation();

  const isEnded = meeting.status === 'ended' || meeting.status === 'ended_abnormal';
  const linkTo = isEnded ? `/meeting/${meeting.id}/replay` : `/meeting/${meeting.id}`;

  return (
    <Card variant="outlined">
      <CardActionArea component={RouterLink} to={linkTo}>
        <CardContent>
          <Stack spacing={1.5}>
            <Box display="flex" justifyContent="space-between" alignItems="flex-start" gap={2}>
              <Box flex={1} minWidth={0}>
                <Typography variant="subtitle1" fontWeight={500} noWrap>
                  {meeting.title ?? t('meeting.untitled')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {meeting.created_at
                    ? new Date(meeting.created_at).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : t('history.unknownDate')}
                </Typography>
              </Box>
              <Chip
                label={t(`meeting.status.${meeting.status}`)}
                color={STATUS_COLORS[meeting.status]}
                size="small"
              />
            </Box>

            <Stack direction="row" spacing={2} flexWrap="wrap" alignItems="center">
              {meeting.duration_seconds !== undefined && meeting.duration_seconds > 0 && (
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <AccessTimeRoundedIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                  <Typography variant="body2" color="text.secondary">
                    {formatDuration(meeting.duration_seconds)}
                  </Typography>
                </Stack>
              )}

              {meeting.has_transcript && (
                <Chip
                  icon={<ArticleRoundedIcon sx={{ fontSize: 16 }} />}
                  label={t('history.hasTranscript')}
                  size="small"
                  variant="outlined"
                  color="primary"
                />
              )}

              {meeting.has_summary && (
                <Chip
                  icon={<SummarizeRoundedIcon sx={{ fontSize: 16 }} />}
                  label={t('history.hasSummary')}
                  size="small"
                  variant="outlined"
                  color="secondary"
                />
              )}

              <Chip
                label={meeting.source_language.toUpperCase()}
                size="small"
                variant="outlined"
              />
            </Stack>
          </Stack>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

function LoadingSkeleton() {
  return (
    <Stack spacing={2}>
      {Array.from({ length: 3 }).map((_, index) => (
        <MeetingCardSkeleton key={index} />
      ))}
    </Stack>
  );
}

export default function History() {
  const { t } = useTranslation();

  const [meetings, setMeetings] = useState<MeetingResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const fetchMeetings = useCallback(async (pageNumber: number) => {
    setIsLoading(true);
    setError(null);

    try {
      const offset = (pageNumber - 1) * PAGE_SIZE;
      const response = await meetingApi.list({ limit: PAGE_SIZE, offset });
      setMeetings(response.meetings);
      setTotal(response.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('history.fetchError'));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void fetchMeetings(page);
  }, [page, fetchMeetings]);

  const handlePageChange = (_event: React.ChangeEvent<unknown>, value: number) => {
    setPage(value);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <Stack spacing={4}>
      <Box>
        <Typography variant="h4" gutterBottom>
          {t('routes.historyTitle')}
        </Typography>
        <Typography color="text.secondary">
          {t('history.description')}
        </Typography>
      </Box>

      <Paper elevation={0} sx={{ p: 3 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {isLoading ? (
          <LoadingSkeleton />
        ) : meetings.length === 0 ? (
          <Stack alignItems="center" spacing={2} py={6}>
            <Typography color="text.secondary">
              {t('history.noMeetings')}
            </Typography>
          </Stack>
        ) : (
          <Stack spacing={2}>
            {meetings.map((meeting) => (
              <MeetingCard key={meeting.id} meeting={meeting} />
            ))}
          </Stack>
        )}

        {totalPages > 1 && (
          <Box display="flex" justifyContent="center" mt={4}>
            <Pagination
              count={totalPages}
              page={page}
              onChange={handlePageChange}
              color="primary"
              showFirstButton
              showLastButton
              disabled={isLoading}
            />
          </Box>
        )}

        {!isLoading && total > 0 && (
          <Typography variant="body2" color="text.secondary" textAlign="center" mt={2}>
            {t('history.showingResults', {
              start: (page - 1) * PAGE_SIZE + 1,
              end: Math.min(page * PAGE_SIZE, total),
              total,
            })}
          </Typography>
        )}
      </Paper>
    </Stack>
  );
}
