import { Box, Container, Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';

interface PageHeaderProps {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  aside?: ReactNode;
}

export function PageHeader({ eyebrow, title, description, actions, aside }: PageHeaderProps) {
  return (
    <Stack spacing={3}>
      {eyebrow ? (
        <Typography variant="sectionEyebrow" color="text.tertiary">
          {eyebrow}
        </Typography>
      ) : null}
      <Stack
        direction={{ xs: 'column', lg: 'row' }}
        spacing={3}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', lg: 'flex-end' }}
      >
        <Box maxWidth={760}>
          <Typography variant="pageTitle">{title}</Typography>
          {description ? (
            <Typography variant="body1" color="text.secondary" sx={{ mt: 1.5, maxWidth: 640 }}>
              {description}
            </Typography>
          ) : null}
        </Box>
        {(actions || aside) ? (
          <Stack spacing={1.5} alignItems={{ xs: 'stretch', lg: 'flex-end' }}>
            {aside}
            {actions}
          </Stack>
        ) : null}
      </Stack>
    </Stack>
  );
}

interface PageShellProps {
  header?: ReactNode;
  children: ReactNode;
  maxWidth?: 'lg' | 'xl';
}

export function PageShell({ header, children, maxWidth = 'xl' }: PageShellProps) {
  return (
    <Container maxWidth={maxWidth} sx={{ py: { xs: 3, md: 4 }, position: 'relative' }}>
      <Stack spacing={3.5}>
        {header}
        {children}
      </Stack>
    </Container>
  );
}
