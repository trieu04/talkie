import { useCallback, useEffect, useState } from 'react';
import { Button, Grid, Pagination, Stack, Typography } from '@mui/material';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import { Link as RouterLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { EmptyState, LoadingState } from '@/components/StatePanels';
import { PageHeader, PageShell } from '@/components/PageShell';
import { MetricChip, SectionCard, SectionStack, StatusBadge } from '@/components/SurfacePrimitives';
import {
  formatDuration,
  formatMeetingDate,
  getDurationMetricIcon,
  getMeetingStatusIcon,
  getMeetingStatusTone,
} from '@/components/meetingUi';
import { meetingApi, type MeetingResponse } from '@/services/meetingApi';

const PAGE_SIZE = 10;

function MeetingHistoryCard({ meeting }: { meeting: MeetingResponse }) {
  const { t } = useTranslation();
  const isEnded = meeting.status === 'ended' || meeting.status === 'ended_abnormal';
  const linkTo = isEnded ? `/meeting/${meeting.id}/replay` : `/meeting/${meeting.id}`;

  return (
    <SectionCard
      tone="muted"
      title={meeting.title ?? t('meeting.untitled')}
      description={formatMeetingDate(meeting.created_at)}
      actions={
        <StatusBadge
          label={t(`meeting.status.${meeting.status}`)}
          tone={getMeetingStatusTone(meeting.status)}
          icon={getMeetingStatusIcon(meeting.status)}
        />
      }
    >
      <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.5} justifyContent="space-between" alignItems={{ xs: 'flex-start', lg: 'center' }}>
        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
          <MetricChip icon={getDurationMetricIcon()} label={t('history.duration')} value={formatDuration(meeting.duration_seconds)} />
          <MetricChip label={t('home.sourceLanguage')} value={meeting.source_language.toUpperCase()} />
          <MetricChip label={t('history.transcriptAvailability')} value={meeting.has_transcript ? t('history.hasTranscript') : t('history.noTranscript')} />
          <MetricChip label={t('history.summaryAvailability')} value={meeting.has_summary ? t('history.hasSummary') : t('history.noSummary')} />
        </Stack>
        <Button component={RouterLink} to={linkTo} endIcon={<ArrowForwardRoundedIcon />}>
          {isEnded ? t('home.reviewMeeting') : t('home.openMeeting')}
        </Button>
      </Stack>
    </SectionCard>
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

  const fetchMeetings = useCallback(
    async (pageNumber: number) => {
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
    },
    [t],
  );

  useEffect(() => {
    void fetchMeetings(page);
  }, [fetchMeetings, page]);

  const handlePageChange = (_event: React.ChangeEvent<unknown>, value: number) => {
    setPage(value);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <PageShell
      header={
        <PageHeader
          eyebrow={t('history.eyebrow')}
          title={t('routes.historyTitle')}
          description={t('history.description')}
          aside={
            <Grid container spacing={2} sx={{ width: { xs: '100%', md: 'auto' }, minWidth: { md: 360 } }}>
              <Grid item xs={6}>
                <SectionCard tone="muted">
                  <Typography variant="metricValue">{total}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {t('history.metrics.total')}
                  </Typography>
                </SectionCard>
              </Grid>
              <Grid item xs={6}>
                <SectionCard tone="muted">
                  <Typography variant="metricValue">{meetings.filter((meeting) => meeting.has_summary).length}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {t('history.metrics.withSummary')}
                  </Typography>
                </SectionCard>
              </Grid>
            </Grid>
          }
        />
      }
    >
      <SectionCard>
        {error ? <Typography color="error">{error}</Typography> : null}

        {isLoading ? (
          <LoadingState title={t('common.loading')} description={t('history.loadingDescription')} />
        ) : meetings.length === 0 ? (
          <EmptyState title={t('history.emptyTitle')} description={t('history.noMeetings')} action={<Button component={RouterLink} to="/">{t('home.createMeeting')}</Button>} />
        ) : (
          <SectionStack>
            {meetings.map((meeting) => (
              <MeetingHistoryCard key={meeting.id} meeting={meeting} />
            ))}
          </SectionStack>
        )}

        {totalPages > 1 ? (
          <Stack spacing={2} alignItems="center" sx={{ mt: 3 }}>
            <Pagination
              count={totalPages}
              page={page}
              onChange={handlePageChange}
              color="primary"
              showFirstButton
              showLastButton
              disabled={isLoading}
            />
            {!isLoading && total > 0 ? (
              <Typography variant="body2" color="text.secondary">
                {t('history.showingResults', {
                  start: (page - 1) * PAGE_SIZE + 1,
                  end: Math.min(page * PAGE_SIZE, total),
                  total,
                })}
              </Typography>
            ) : null}
          </Stack>
        ) : null}
      </SectionCard>
    </PageShell>
  );
}
