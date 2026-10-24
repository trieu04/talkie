import { useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { Alert, Button, Link as MuiLink, Stack, TextField, Typography } from '@mui/material';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import { Link as RouterLink, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { PageHeader, PageShell } from '@/components/PageShell';
import { SectionCard, SectionStack } from '@/components/SurfacePrimitives';
import { useAuthStore } from '@/stores';

interface LoginFormState {
  email: string;
  password: string;
}

const initialFormState: LoginFormState = {
  email: '',
  password: '',
};

const isValidEmail = (value: string) => /\S+@\S+\.\S+/.test(value);

export default function Login() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isLoading, isAuthenticated, error, setError } = useAuthStore();

  const [form, setForm] = useState<LoginFormState>(initialFormState);
  const [touched, setTouched] = useState<Record<keyof LoginFormState, boolean>>({
    email: false,
    password: false,
  });

  const fieldErrors = useMemo(
    () => ({
      email: touched.email && !isValidEmail(form.email) ? t('auth.invalidEmail') : undefined,
      password: touched.password && form.password.length < 8 ? t('auth.passwordTooShort') : undefined,
    }),
    [form.email, form.password.length, t, touched.email, touched.password],
  );

  const isFormValid = isValidEmail(form.email) && form.password.length >= 8;

  if (isAuthenticated) {
    const nextPath = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? '/';
    return <Navigate to={nextPath} replace />;
  }

  const handleChange = (field: keyof LoginFormState) => (event: ChangeEvent<HTMLInputElement>) => {
    if (error) {
      setError(null);
    }

    setForm((previousState) => ({
      ...previousState,
      [field]: event.target.value,
    }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTouched({ email: true, password: true });

    if (!isFormValid) {
      return;
    }

    try {
      await login(form);
      navigate('/');
    } catch {
      return;
    }
  };

  return (
    <PageShell
      maxWidth="lg"
      header={
        <PageHeader
          eyebrow={t('auth.eyebrow')}
          title={t('auth.loginTitle')}
          description={t('auth.loginSubtitle')}
        />
      }
    >
      <Stack direction={{ xs: 'column', lg: 'row' }} spacing={3} alignItems="stretch">
        <SectionCard tone="accent">
          <SectionStack>
            <Typography variant="sectionTitle">{t('auth.valueTitle')}</Typography>
            <Typography variant="body1" color="text.secondary">
              {t('auth.valueDescription')}
            </Typography>
            <Stack spacing={1.25}>
              <Typography variant="body2">{t('auth.valuePointOne')}</Typography>
              <Typography variant="body2">{t('auth.valuePointTwo')}</Typography>
              <Typography variant="body2">{t('auth.valuePointThree')}</Typography>
            </Stack>
          </SectionStack>
        </SectionCard>

        <SectionCard title={t('common.login')} description={t('auth.formDescription')}>
          <Stack spacing={3} component="form" onSubmit={handleSubmit} noValidate>
            {error ? <Alert severity="error">{error || t('auth.loginFailed')}</Alert> : null}

            <TextField
              label={t('common.email')}
              type="email"
              value={form.email}
              onChange={handleChange('email')}
              onBlur={() => setTouched((previous) => ({ ...previous, email: true }))}
              error={Boolean(fieldErrors.email)}
              helperText={fieldErrors.email}
              autoComplete="email"
            />

            <TextField
              label={t('common.password')}
              type="password"
              value={form.password}
              onChange={handleChange('password')}
              onBlur={() => setTouched((previous) => ({ ...previous, password: true }))}
              error={Boolean(fieldErrors.password)}
              helperText={fieldErrors.password}
              autoComplete="current-password"
            />

            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={isLoading || !isFormValid}
              endIcon={<ArrowForwardRoundedIcon />}
            >
              {t('common.login')}
            </Button>

            <Typography color="text.secondary">
              {t('auth.noAccount')}{' '}
              <MuiLink component={RouterLink} to="/register">
                {t('common.register')}
              </MuiLink>
            </Typography>
          </Stack>
        </SectionCard>
      </Stack>
    </PageShell>
  );
}
