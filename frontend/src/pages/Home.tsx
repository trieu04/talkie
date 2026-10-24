import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  Alert,
  Button,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
  type SelectChangeEvent,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { EmptyState, LoadingState } from '@/components/StatePanels';
import { PageHeader, PageShell } from '@/components/PageShell';
import { MetricChip, SectionCard, SectionStack, StatusBadge } from '@/components/SurfacePrimitives';
import {
  SUPPORTED_SOURCE_LANGUAGES,
  formatMeetingDate,
  getDurationMetricIcon,
  getMeetingStatusIcon,
  getMeetingStatusTone,
} from '@/components/meetingUi';
import { useMeetingStore } from '@/stores';
import type { Meeting } from '@/types';

interface CreateMeetingFormState {
  title: string;
  sourceLanguage: string;
}

function RecentMeetingCard({ meeting }: { meeting: Meeting }) {
  const { t } = useTranslation();
  const linkTo = meeting.status === 'ended' || meeting.status === 'ended_abnormal' ? `/meeting/${meeting.id}/replay` : `/meeting/${meeting.id}`;

  return (
    <SectionCard
      tone="muted"
      title={meeting.title || t('meeting.untitled')}
      description={formatMeetingDate(meeting.created_at)}
      actions={
        <StatusBadge
          label={t(`meeting.status.${meeting.status}`)}
          tone={getMeetingStatusTone(meeting.status)}
          icon={getMeetingStatusIcon(meeting.status)}
        />
      }
    >
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }}>
        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
          <MetricChip label={t('home.roomCode')} value={meeting.room_code} />
          <MetricChip label={t('home.sourceLanguage')} value={t(`translation.languages.${meeting.source_language}`)} />
          <MetricChip label={t('home.transcriptSegments')} value={meeting.transcript_segment_count ?? 0} icon={getDurationMetricIcon()} />
        </Stack>
        <Button component={RouterLink} to={linkTo} endIcon={<ArrowForwardRoundedIcon />}>
          {meeting.status === 'ended' || meeting.status === 'ended_abnormal' ? t('home.reviewMeeting') : t('home.openMeeting')}
        </Button>
      </Stack>
    </SectionCard>
  );
}

export default function Home() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { meetings, isLoading, error, createMeeting, fetchMeetings } = useMeetingStore();

  const [form, setForm] = useState<CreateMeetingFormState>({
    title: '',
    sourceLanguage: 'vi',
  });
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    void fetchMeetings({ limit: 5 });
  }, [fetchMeetings]);

  const recentMeetings = useMemo(() => meetings.slice(0, 5), [meetings]);

  const handleTitleChange = (event: ChangeEvent<HTMLInputElement>) => {
    setForm((previous) => ({ ...previous, title: event.target.value }));
    if (createError) {
      setCreateError(null);
    }
  };

  const handleLanguageChange = (event: SelectChangeEvent<string>) => {
    setForm((previous) => ({ ...previous, sourceLanguage: event.target.value }));
  };

  const handleCreateMeeting = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsCreating(true);
    setCreateError(null);

    try {
      const meeting = await createMeeting({
        title: form.title.trim() || t('meeting.untitled'),
        sourceLanguage: form.sourceLanguage,
      });
      navigate(`/meeting/${meeting.id}`);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : t('home.createMeetingError'));
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <PageShell
      header={
        <PageHeader
          eyebrow={t('home.eyebrow')}
          title={t('routes.homeTitle')}
          description={t('home.pageDescription')}
          actions={null}
        />
      }
    >
      <Grid container spacing={3}>
        <Grid item xs={12} lg={4}>
          <SectionCard title={t('home.createMeeting')} description={t('home.createMeetingDescription')}>
            <Stack id="create-meeting-form" component="form" spacing={2.5} onSubmit={handleCreateMeeting} noValidate>
              {createError ? <Alert severity="error">{createError}</Alert> : null}

              <TextField
                label={t('home.meetingTitle')}
                placeholder={t('home.meetingTitlePlaceholder')}
                value={form.title}
                onChange={handleTitleChange}
              />

              <FormControl>
                <InputLabel id="source-language-label">{t('home.sourceLanguage')}</InputLabel>
                <Select
                  labelId="source-language-label"
                  value={form.sourceLanguage}
                  label={t('home.sourceLanguage')}
                  onChange={handleLanguageChange}
                >
                  {SUPPORTED_SOURCE_LANGUAGES.map((language) => (
                    <MenuItem key={language.code} value={language.code}>
                      {t(language.translationKey)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Button type="submit" variant="contained" size="large" disabled={isCreating} startIcon={<AddRoundedIcon />}>
                {t('home.createMeeting')}
              </Button>
            </Stack>
          </SectionCard>
        </Grid>

        <Grid item xs={12} lg={8}>
          <SectionStack>
            <SectionCard
              title={t('home.recentMeetings')}
              description={t('home.recentMeetingsDescription')}
              actions={<Button component={RouterLink} to="/history">{t('common.viewAll')}</Button>}
            >
              {error ? <Alert severity="error">{error}</Alert> : null}

              {isLoading ? (
                <LoadingState title={t('common.loading')} description={t('home.loadingMeetings')} />
              ) : recentMeetings.length === 0 ? (
                <EmptyState title={t('home.emptyTitle')} description={t('home.noMeetings')} />
              ) : (
                <SectionStack>
                  {recentMeetings.map((meeting) => (
                    <RecentMeetingCard key={meeting.id} meeting={meeting} />
                  ))}
                </SectionStack>
              )}
            </SectionCard>

            <Grid container spacing={2}>
              <Grid item xs={12} sm={4}>
                <SectionCard tone="muted">
                  <Typography variant="metricValue">{meetings.length}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {t('home.metrics.totalMeetings')}
                  </Typography>
                </SectionCard>
              </Grid>
              <Grid item xs={12} sm={4}>
                <SectionCard tone="muted">
                  <Typography variant="metricValue">{meetings.filter((meeting) => meeting.status === 'recording').length}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {t('home.metrics.liveNow')}
                  </Typography>
                </SectionCard>
              </Grid>
              <Grid item xs={12} sm={4}>
                <SectionCard tone="muted">
                  <Typography variant="metricValue">{meetings.filter((meeting) => meeting.has_summary).length}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {t('home.metrics.withSummaries')}
                  </Typography>
                </SectionCard>
              </Grid>
            </Grid>
          </SectionStack>
        </Grid>
      </Grid>
    </PageShell>
  );
}
