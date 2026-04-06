import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button, Paper, Stack, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

interface ErrorBoundaryViewProps {
  children: ReactNode;
  title: string;
  description: string;
  retryLabel: string;
}

class ErrorBoundaryView extends Component<ErrorBoundaryViewProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryViewProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Talkie app error boundary caught an error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
    });
  };

  render() {
    const { children, title, description, retryLabel } = this.props;
    const { hasError } = this.state;

    if (hasError) {
      return (
        <Paper
          elevation={0}
          sx={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            px: 3,
          }}
          role="alert"
        >
          <Stack spacing={2} sx={{ maxWidth: 560, textAlign: 'center' }}>
            <Typography variant="h4">{title}</Typography>
            <Typography color="text.secondary">{description}</Typography>
            <Button variant="contained" onClick={this.handleRetry} sx={{ alignSelf: 'center' }}>
              {retryLabel}
            </Button>
          </Stack>
        </Paper>
      );
    }

    return children;
  }
}

export default function ErrorBoundary({ children }: ErrorBoundaryProps) {
  const { t } = useTranslation();

  return (
    <ErrorBoundaryView
      title={t('errorBoundary.title')}
      description={t('errorBoundary.description')}
      retryLabel={t('errorBoundary.retry')}
    >
      {children}
    </ErrorBoundaryView>
  );
}
