import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import AssignmentRoundedIcon from '@mui/icons-material/AssignmentRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import EventRoundedIcon from '@mui/icons-material/EventRounded';
import GavelRoundedIcon from '@mui/icons-material/GavelRounded';
import LightbulbRoundedIcon from '@mui/icons-material/LightbulbRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import { useTranslation } from 'react-i18next';

import type { MeetingSummary } from '@/types';

interface SummaryViewProps {
  summary: MeetingSummary | null;
  isLoading?: boolean;
  error?: string | null;
}

function LoadingState() {
  const { t } = useTranslation();

  return (
    <Box component="section" aria-label="Summary loading state" sx={{ py: 6, px: 4 }}>
      <Stack spacing={3} alignItems="center">
        <CircularProgress size={48} />
        <Box sx={{ textAlign: 'center' }}>
          <Typography component="h2" variant="h6" gutterBottom>
            {t('summary.generating')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('summary.estimatedTime')}
          </Typography>
        </Box>
        <Box sx={{ width: '100%', maxWidth: 400 }}>
          <LinearProgress />
        </Box>
      </Stack>
    </Box>
  );
}

function EmptyState() {
  const { t } = useTranslation();

  return (
    <Box component="section" aria-label="Empty meeting summary" sx={{ py: 6, textAlign: 'center' }}>
      <Typography variant="body1" color="text.secondary">
        {t('summary.noSummary')}
      </Typography>
    </Box>
  );
}

function OverviewSection({ content }: { content: string }) {
  const { t } = useTranslation();

  if (!content) {
    return null;
  }

  return (
    <Box component="section">
      <Typography component="h3" variant="subtitle1" fontWeight={600} gutterBottom>
        {t('summary.overview')}
      </Typography>
      <Paper
        elevation={0}
        sx={{
          p: 2,
          bgcolor: 'action.hover',
          borderRadius: 2,
        }}
      >
        <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
          {content}
        </Typography>
      </Paper>
    </Box>
  );
}

function KeyPointsSection({ keyPoints }: { keyPoints: string[] }) {
  const { t } = useTranslation();

  return (
    <Box component="section">
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
        <LightbulbRoundedIcon color="warning" fontSize="small" />
        <Typography component="h3" variant="subtitle1" fontWeight={600}>
          {t('summary.keyPoints')}
        </Typography>
      </Stack>

      {keyPoints.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ pl: 4 }}>
          {t('summary.noKeyPoints')}
        </Typography>
      ) : (
        <List dense disablePadding>
          {keyPoints.map((point, index) => (
            <ListItem key={index} sx={{ py: 0.5, pl: 4 }}>
              <ListItemIcon sx={{ minWidth: 32 }}>
                <CheckCircleRoundedIcon
                  fontSize="small"
                  color="success"
                />
              </ListItemIcon>
              <ListItemText
                primary={point}
                primaryTypographyProps={{
                  variant: 'body2',
                }}
              />
            </ListItem>
          ))}
        </List>
      )}
    </Box>
  );
}

interface Decision {
  decision: string;
  context: string;
}

function DecisionsSection({ decisions }: { decisions: Decision[] }) {
  const { t } = useTranslation();

  return (
    <Box component="section">
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
        <GavelRoundedIcon color="primary" fontSize="small" />
        <Typography component="h3" variant="subtitle1" fontWeight={600}>
          {t('summary.decisions')}
        </Typography>
      </Stack>

      {decisions.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ pl: 4 }}>
          {t('summary.noDecisions')}
        </Typography>
      ) : (
        <Stack spacing={2}>
          {decisions.map((item, index) => (
            <Card key={index} variant="outlined" sx={{ borderRadius: 2 }}>
              <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Typography variant="body1" fontWeight={500} gutterBottom>
                  {item.decision}
                </Typography>
                {item.context && (
                  <Typography variant="body2" color="text.secondary">
                    {t('summary.context')}: {item.context}
                  </Typography>
                )}
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}
    </Box>
  );
}

interface ActionItem {
  task: string;
  assignee: string | null;
  deadline: string | null;
}

function ActionItemsSection({ actionItems }: { actionItems: ActionItem[] }) {
  const { t } = useTranslation();

  return (
    <Box component="section">
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
        <AssignmentRoundedIcon color="secondary" fontSize="small" />
        <Typography component="h3" variant="subtitle1" fontWeight={600}>
          {t('summary.actionItems')}
        </Typography>
      </Stack>

      {actionItems.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ pl: 4 }}>
          {t('summary.noActionItems')}
        </Typography>
      ) : (
        <List disablePadding>
          {actionItems.map((item, index) => (
            <ListItem
              key={index}
              sx={{
                py: 1.5,
                px: 2,
                bgcolor: 'background.paper',
                borderRadius: 2,
                border: 1,
                borderColor: 'divider',
                mb: 1,
                '&:last-child': { mb: 0 },
              }}
            >
              <ListItemText
                primary={
                  <Typography variant="body1" fontWeight={500}>
                    {item.task}
                  </Typography>
                }
                secondary={
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ mt: 1 }}
                    flexWrap="wrap"
                    useFlexGap
                  >
                    <Chip
                      icon={<PersonRoundedIcon />}
                      label={item.assignee ?? t('summary.unassigned')}
                      size="small"
                      variant={item.assignee ? 'filled' : 'outlined'}
                      color={item.assignee ? 'primary' : 'default'}
                    />
                    <Chip
                      icon={<EventRoundedIcon />}
                      label={item.deadline ?? t('summary.noDeadline')}
                      size="small"
                      variant={item.deadline ? 'filled' : 'outlined'}
                      color={item.deadline ? 'warning' : 'default'}
                    />
                  </Stack>
                }
              />
            </ListItem>
          ))}
        </List>
      )}
    </Box>
  );
}

export default function SummaryView({
  summary,
  isLoading = false,
  error = null,
}: SummaryViewProps) {
  const { t } = useTranslation();

  if (error) {
    return (
      <Alert severity="error" sx={{ borderRadius: 2 }}>
        {error}
      </Alert>
    );
  }

  if (isLoading) {
    return <LoadingState />;
  }

  if (!summary) {
    return <EmptyState />;
  }

  return (
    <Stack component="section" spacing={3} aria-label="Meeting summary">
      <Typography component="h2" variant="h6">
        {t('summary.title')}
      </Typography>

      <OverviewSection content={summary.content} />

      <Divider />

      <KeyPointsSection keyPoints={summary.key_points} />

      <Divider />

      <DecisionsSection decisions={summary.decisions} />

      <Divider />

      <ActionItemsSection actionItems={summary.action_items} />
    </Stack>
  );
}
