import {
  Alert,
  Box,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material';
import AssignmentRoundedIcon from '@mui/icons-material/AssignmentRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import EventRoundedIcon from '@mui/icons-material/EventRounded';
import GavelRoundedIcon from '@mui/icons-material/GavelRounded';
import LightbulbRoundedIcon from '@mui/icons-material/LightbulbRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import { useTranslation } from 'react-i18next';

import type { MeetingSummary } from '@/types';
import { EmptyState, LoadingState } from './StatePanels';
import { MetricChip, SectionCard, SectionStack } from './SurfacePrimitives';

interface SummaryViewProps {
  summary: MeetingSummary | null;
  isLoading?: boolean;
  error?: string | null;
}

function SummarySection({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Stack spacing={1.5}>
      <Stack direction="row" spacing={1} alignItems="center">
        {icon}
        <Typography variant="sectionTitle">{title}</Typography>
      </Stack>
      {children}
    </Stack>
  );
}

export default function SummaryView({ summary, isLoading = false, error = null }: SummaryViewProps) {
  const { t } = useTranslation();

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  if (isLoading) {
    return <LoadingState ariaLabel="Summary loading state" title={t('summary.generating')} description={t('summary.estimatedTime')} />;
  }

  if (!summary) {
    return <EmptyState ariaLabel="Empty meeting summary" title={t('summary.emptyTitle')} description={t('summary.noSummary')} />;
  }

  return (
    <SectionStack>
      <SectionCard
        ariaLabel="Meeting summary"
        title={t('summary.title')}
        description={t('summary.description')}
        tone="accent"
        actions={<MetricChip icon={<AutoAwesomeRoundedIcon sx={{ fontSize: 18, color: 'secondary.main' }} />} label={t('summary.statusLabel')} value={t('summary.ready')} />}
      >
        <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
          {summary.content}
        </Typography>
      </SectionCard>

      <SectionCard>
        <SectionStack>
          <SummarySection
            title={t('summary.keyPoints')}
            icon={<LightbulbRoundedIcon color="warning" fontSize="small" />}
          >
            {summary.key_points.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                {t('summary.noKeyPoints')}
              </Typography>
            ) : (
              <List dense disablePadding>
                {summary.key_points.map((point) => (
                  <ListItem key={point} disableGutters sx={{ alignItems: 'flex-start' }}>
                    <ListItemIcon sx={{ minWidth: 30, mt: 0.25 }}>
                      <CheckCircleRoundedIcon fontSize="small" color="success" />
                    </ListItemIcon>
                    <ListItemText primary={point} primaryTypographyProps={{ variant: 'body2' }} />
                  </ListItem>
                ))}
              </List>
            )}
          </SummarySection>

          <Divider />

          <SummarySection
            title={t('summary.decisions')}
            icon={<GavelRoundedIcon color="primary" fontSize="small" />}
          >
            {summary.decisions.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                {t('summary.noDecisions')}
              </Typography>
            ) : (
              <Stack spacing={1.5}>
                {summary.decisions.map((item) => (
                  <Box key={`${item.decision}-${item.context}`} sx={{ p: 2, borderRadius: 4, bgcolor: 'background.level1' }}>
                    <Typography variant="body1" fontWeight={700}>
                      {item.decision}
                    </Typography>
                    {item.context ? (
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                        {t('summary.context')}: {item.context}
                      </Typography>
                    ) : null}
                  </Box>
                ))}
              </Stack>
            )}
          </SummarySection>

          <Divider />

          <SummarySection
            title={t('summary.actionItems')}
            icon={<AssignmentRoundedIcon color="secondary" fontSize="small" />}
          >
            {summary.action_items.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                {t('summary.noActionItems')}
              </Typography>
            ) : (
              <Stack spacing={1.5}>
                {summary.action_items.map((item) => (
                  <Box key={`${item.task}-${item.assignee ?? 'unassigned'}-${item.deadline ?? 'none'}`} sx={{ p: 2, borderRadius: 4, bgcolor: 'background.level1' }}>
                    <Typography variant="body1" fontWeight={700}>
                      {item.task}
                    </Typography>
                    <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 1.25 }}>
                      <MetricChip
                        icon={<PersonRoundedIcon sx={{ fontSize: 18, color: 'primary.main' }} />}
                        label={t('summary.assignee')}
                        value={item.assignee ?? t('summary.unassigned')}
                      />
                      <MetricChip
                        icon={<EventRoundedIcon sx={{ fontSize: 18, color: 'warning.main' }} />}
                        label={t('summary.deadline')}
                        value={item.deadline ?? t('summary.noDeadline')}
                      />
                    </Stack>
                  </Box>
                ))}
              </Stack>
            )}
          </SummarySection>
        </SectionStack>
      </SectionCard>
    </SectionStack>
  );
}
