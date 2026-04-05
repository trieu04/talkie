import { useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  Alert,
  Box,
  Button,
  Link as MuiLink,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { Link as RouterLink, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

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
      email:
        touched.email && !isValidEmail(form.email) ? t('auth.invalidEmail') : undefined,
      password:
        touched.password && form.password.length < 8 ? t('auth.passwordTooShort') : undefined,
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
    <Box display="flex" justifyContent="center" alignItems="center" minHeight="100%">
      <Paper elevation={0} sx={{ width: '100%', maxWidth: 480, p: 4 }}>
        <Stack spacing={3} component="form" onSubmit={handleSubmit} noValidate>
          <Box>
            <Typography variant="h4" gutterBottom>
              {t('auth.loginTitle')}
            </Typography>
            <Typography color="text.secondary">{t('auth.loginSubtitle')}</Typography>
          </Box>

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
            fullWidth
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
            fullWidth
          />

          <Button type="submit" variant="contained" size="large" disabled={isLoading || !isFormValid}>
            {t('common.login')}
          </Button>

          <Typography color="text.secondary" textAlign="center">
            {t('auth.noAccount')}{' '}
            <MuiLink component={RouterLink} to="/register">
              {t('common.register')}
            </MuiLink>
          </Typography>
        </Stack>
      </Paper>
    </Box>
  );
}
