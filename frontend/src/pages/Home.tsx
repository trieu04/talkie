import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  CircularProgress,
  FormControl,
  Grid,
  InputLabel,
  Link as MuiLink,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
  type SelectChangeEvent,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { useMeetingStore } from '@/stores';
import type { MeetingStatus } from '@/types';

const SUPPORTED_LANGUAGES = [
  { code: 'vi', label: 'Vietnamese' },
  { code: 'en', label: 'English' },
  { code: 'ja', label: 'Japanese' },
  { code: 'ko', label: 'Korean' },
  { code: 'zh', label: 'Chinese' },
];

const STATUS_COLORS: Record<MeetingStatus, 'default' | 'success' | 'warning' | 'error' | 'info'> = {
  created: 'default',
  recording: 'success',
  paused: 'warning',
  ended: 'info',
  ended_abnormal: 'error',
};

interface CreateMeetingFormState {
  title: string;
  sourceLanguage: string;
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

  const recentMeetings = meetings.slice(0, 5);

  const handleTitleChange = (event: ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, title: event.target.value }));
    if (createError) {
      setCreateError(null);
    }
  };

  const handleLanguageChange = (event: SelectChangeEvent<string>) => {
    setForm((prev) => ({ ...prev, sourceLanguage: event.target.value }));
  };

  const handleCreateMeeting = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsCreating(true);
    setCreateError(null);

    try {
      const meeting = await createMeeting({
        title: form.title.trim() || 'Untitled Meeting',
        sourceLanguage: form.sourceLanguage,
      });
      navigate(`/meeting/${meeting.id}`);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create meeting');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Stack spacing={4}>
      <Box>
        <Typography variant="h4" gutterBottom>
          {t('routes.homeTitle')}
        </Typography>
        <Typography color="text.secondary">{t('common.welcome')}</Typography>
      </Box>

      <Grid container spacing={4}>
        <Grid item xs={12} md={5}>
          <Paper elevation={0} sx={{ p: 3 }}>
            <Stack spacing={3} component="form" onSubmit={handleCreateMeeting} noValidate>
              <Box>
                <Typography variant="h6" gutterBottom>
                  {t('home.createMeeting')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t('home.createMeetingDescription')}
                </Typography>
              </Box>

              {createError ? <Alert severity="error">{createError}</Alert> : null}

              <TextField
                label={t('home.meetingTitle')}
                placeholder={t('home.meetingTitlePlaceholder')}
                value={form.title}
                onChange={handleTitleChange}
                fullWidth
              />

              <FormControl fullWidth>
                <InputLabel id="source-language-label">{t('home.sourceLanguage')}</InputLabel>
                <Select
                  labelId="source-language-label"
                  id="source-language"
                  value={form.sourceLanguage}
                  label={t('home.sourceLanguage')}
                  onChange={handleLanguageChange}
                >
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <MenuItem key={lang.code} value={lang.code}>
                      {lang.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Button
                type="submit"
                variant="contained"
                size="large"
                disabled={isCreating}
                startIcon={isCreating ? <CircularProgress size={20} color="inherit" /> : <AddRoundedIcon />}
              >
                {t('home.createMeeting')}
              </Button>
            </Stack>
          </Paper>
        </Grid>

        <Grid item xs={12} md={7}>
          <Paper elevation={0} sx={{ p: 3 }}>
            <Stack spacing={3}>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Typography variant="h6">{t('home.recentMeetings')}</Typography>
                <MuiLink component={RouterLink} to="/history" underline="hover">
                  {t('common.viewAll')}
                </MuiLink>
              </Box>

              {error ? <Alert severity="error">{error}</Alert> : null}

              {isLoading ? (
                <Box display="flex" justifyContent="center" py={4}>
                  <CircularProgress />
                </Box>
              ) : recentMeetings.length === 0 ? (
                <Typography color="text.secondary" textAlign="center" py={4}>
                  {t('home.noMeetings')}
                </Typography>
              ) : (
                <Stack spacing={2}>
                  {recentMeetings.map((meeting) => (
                    <Card key={meeting.id} variant="outlined">
                      <CardActionArea
                        component={RouterLink}
                        to={`/meeting/${meeting.id}`}
                        sx={{ p: 0 }}
                      >
                        <CardContent sx={{ py: 2 }}>
                          <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                            <Box flex={1} minWidth={0}>
                              <Typography variant="subtitle1" noWrap>
                                {meeting.title || `Meeting ${meeting.room_code}`}
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
                                  : 'Unknown date'}
                              </Typography>
                            </Box>
                            <Chip
                              label={t(`home.status.${meeting.status}`)}
                              color={STATUS_COLORS[meeting.status]}
                              size="small"
                            />
                          </Box>
                        </CardContent>
                      </CardActionArea>
                    </Card>
                  ))}
                </Stack>
              )}
            </Stack>
          </Paper>
        </Grid>
      </Grid>
    </Stack>
  );
}
