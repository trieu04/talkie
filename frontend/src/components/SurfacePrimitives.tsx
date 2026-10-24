import { Box, Paper, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import type { ReactNode } from 'react';

import type { Theme } from '@mui/material/styles';

const getTalkiePalette = (theme: Theme) => ({
  panelAccent: theme.palette.talkie?.panelAccent ?? alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.16 : 0.08),
  live: theme.palette.talkie?.live ?? theme.palette.error.main,
  paused: theme.palette.talkie?.paused ?? theme.palette.warning.main,
  processing: theme.palette.talkie?.processing ?? theme.palette.info.main,
  reconnecting: theme.palette.talkie?.reconnecting ?? theme.palette.warning.main,
  completed: theme.palette.talkie?.completed ?? theme.palette.success.main,
  danger: theme.palette.talkie?.danger ?? theme.palette.error.main,
});

const getBackgroundLevel = (theme: Theme, level: 'level1' | 'level2') =>
  theme.palette.background[level] ?? theme.palette.action.hover;

export interface StatusBadgeProps {
  label: string;
  tone?: 'default' | 'live' | 'paused' | 'processing' | 'reconnecting' | 'completed' | 'danger';
  icon?: ReactNode;
}

export function StatusBadge({ label, tone = 'default', icon }: StatusBadgeProps) {
  return (
    <Box
      role="status"
      sx={(theme) => {
        const talkie = getTalkiePalette(theme);
        const toneStyles = {
          default: {
            backgroundColor: theme.palette.action.hover,
            color: theme.palette.text.secondary,
            borderColor: theme.palette.divider,
          },
          live: {
            backgroundColor: alpha(talkie.live, theme.palette.mode === 'dark' ? 0.14 : 0.08),
            color: talkie.live,
            borderColor: alpha(talkie.live, theme.palette.mode === 'dark' ? 0.28 : 0.18),
          },
          paused: {
            backgroundColor: alpha(talkie.paused, theme.palette.mode === 'dark' ? 0.14 : 0.08),
            color: talkie.paused,
            borderColor: alpha(talkie.paused, theme.palette.mode === 'dark' ? 0.28 : 0.18),
          },
          processing: {
            backgroundColor: alpha(talkie.processing, theme.palette.mode === 'dark' ? 0.14 : 0.08),
            color: talkie.processing,
            borderColor: alpha(talkie.processing, theme.palette.mode === 'dark' ? 0.28 : 0.18),
          },
          reconnecting: {
            backgroundColor: alpha(talkie.reconnecting, theme.palette.mode === 'dark' ? 0.16 : 0.1),
            color: talkie.reconnecting,
            borderColor: alpha(talkie.reconnecting, theme.palette.mode === 'dark' ? 0.3 : 0.22),
          },
          completed: {
            backgroundColor: alpha(talkie.completed, theme.palette.mode === 'dark' ? 0.14 : 0.08),
            color: talkie.completed,
            borderColor: alpha(talkie.completed, theme.palette.mode === 'dark' ? 0.28 : 0.18),
          },
          danger: {
            backgroundColor: alpha(talkie.danger, theme.palette.mode === 'dark' ? 0.14 : 0.08),
            color: talkie.danger,
            borderColor: alpha(talkie.danger, theme.palette.mode === 'dark' ? 0.28 : 0.18),
          },
        } as const;

        return {
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.75,
          px: 1.25,
          py: 0.75,
          borderRadius: 999,
          border: 1,
          ...toneStyles[tone],
        };
      }}
    >
      {icon}
      <Typography variant="caption" sx={{ color: 'inherit', fontWeight: 700 }}>
        {label}
      </Typography>
    </Box>
  );
}

export interface MetricChipProps {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
}

export function MetricChip({ label, value, icon }: MetricChipProps) {
  return (
    <Paper
      elevation={0}
      sx={{
        px: 1.5,
        py: 1.25,
        bgcolor: 'background.level1',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 1,
        minWidth: 0,
      }}
    >
      {icon}
      <Box minWidth={0}>
        <Typography variant="caption" color="text.tertiary" sx={{ display: 'block' }}>
          {label}
        </Typography>
        <Typography variant="body2" fontWeight={700} noWrap>
          {value}
        </Typography>
      </Box>
    </Paper>
  );
}

export interface SectionCardProps {
  ariaLabel?: string | undefined;
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  tone?: 'default' | 'muted' | 'raised' | 'accent';
}

export function SectionCard({ ariaLabel, title, description, actions, children, tone = 'default' }: SectionCardProps) {
  return (
    <Paper
      component="section"
      aria-label={ariaLabel}
      elevation={0}
      sx={(theme) => {
        const talkie = getTalkiePalette(theme);
        const backgrounds = {
          default: theme.palette.background.paper,
          muted: getBackgroundLevel(theme, 'level1'),
          raised: getBackgroundLevel(theme, 'level2'),
          accent: talkie.panelAccent,
        } as const;

        return {
          p: { xs: 2.5, md: 3 },
          bgcolor: backgrounds[tone],
        };
      }}
    >
      {(title || description || actions) && (
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={2}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', md: 'center' }}
          sx={{ mb: 2.5 }}
        >
          <Box>
            {title ? <Typography variant="sectionTitle">{title}</Typography> : null}
            {description ? (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                {description}
              </Typography>
            ) : null}
          </Box>
          {actions ? <Box>{actions}</Box> : null}
        </Stack>
      )}
      {children}
    </Paper>
  );
}

export function SectionStack({ children }: { children: ReactNode }) {
  return <Stack spacing={2.5}>{children}</Stack>;
}
