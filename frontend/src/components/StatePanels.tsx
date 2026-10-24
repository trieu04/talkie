import { Alert, Box, Button, CircularProgress, Stack, Typography } from '@mui/material';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import type { ReactNode } from 'react';

import { SectionCard } from './SurfacePrimitives';

interface StatePanelProps {
  ariaLabel?: string;
  title: string;
  description: string;
  action?: ReactNode;
}

export function LoadingState({ ariaLabel, title, description }: StatePanelProps) {
  return (
    <SectionCard ariaLabel={ariaLabel}>
      <Stack spacing={2} alignItems="flex-start" sx={{ py: 2 }}>
        <CircularProgress size={28} />
        <Box>
          <Typography variant="sectionTitle">{title}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
            {description}
          </Typography>
        </Box>
      </Stack>
    </SectionCard>
  );
}

export function EmptyState({ ariaLabel, title, description, action }: StatePanelProps) {
  return (
    <SectionCard ariaLabel={ariaLabel} tone="muted">
      <Stack spacing={2} alignItems="flex-start" sx={{ py: 1 }}>
        <Box>
          <Typography variant="sectionTitle">{title}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
            {description}
          </Typography>
        </Box>
        {action}
      </Stack>
    </SectionCard>
  );
}

interface ErrorStateProps extends StatePanelProps {
  onRetry?: () => void;
  retryLabel?: string;
}

export function ErrorState({ title, description, onRetry, retryLabel, action }: ErrorStateProps) {
  return (
    <SectionCard ariaLabel={title}>
      <Stack spacing={2}>
        <Alert severity="error">
          <Typography variant="sectionTitle" sx={{ mb: 0.5 }}>
            {title}
          </Typography>
          <Typography variant="body2">{description}</Typography>
        </Alert>
        {onRetry ? (
          <Button variant="outlined" onClick={onRetry} startIcon={<RefreshRoundedIcon />}>
            {retryLabel}
          </Button>
        ) : action}
      </Stack>
    </SectionCard>
  );
}

interface InfoStateProps {
  title: string;
  description: string;
  severity?: 'info' | 'success' | 'warning';
}

export function InfoState({ title, description, severity = 'info' }: InfoStateProps) {
  return (
    <Alert severity={severity}>
      <Typography variant="sectionTitle" sx={{ mb: 0.5 }}>
        {title}
      </Typography>
      <Typography variant="body2">{description}</Typography>
    </Alert>
  );
}
