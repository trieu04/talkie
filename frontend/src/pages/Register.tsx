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
import { Link as RouterLink, Navigate, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { useAuthStore } from '@/stores';

interface RegisterFormState {
  email: string;
  displayName: string;
  password: string;
  confirmPassword: string;
}

const initialFormState: RegisterFormState = {
  email: '',
  displayName: '',
  password: '',
  confirmPassword: '',
};

const isValidEmail = (value: string) => /\S+@\S+\.\S+/.test(value);

export default function Register() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { register, isLoading, isAuthenticated, error, setError } = useAuthStore();

  const [form, setForm] = useState<RegisterFormState>(initialFormState);
  const [touched, setTouched] = useState<Record<keyof RegisterFormState, boolean>>({
    email: false,
    displayName: false,
    password: false,
    confirmPassword: false,
  });

  const fieldErrors = useMemo(
    () => ({
      email:
        touched.email && !isValidEmail(form.email) ? t('auth.invalidEmail') : undefined,
      displayName:
        touched.displayName && form.displayName.trim().length === 0
          ? t('auth.displayNameRequired')
          : undefined,
      password:
        touched.password && form.password.length < 8 ? t('auth.passwordTooShort') : undefined,
      confirmPassword:
        touched.confirmPassword && form.confirmPassword !== form.password
          ? t('auth.passwordMismatch')
          : undefined,
    }),
    [
      form.confirmPassword,
      form.displayName,
      form.email,
      form.password,
      t,
      touched.confirmPassword,
      touched.displayName,
      touched.email,
      touched.password,
    ],
  );

  const isFormValid =
    isValidEmail(form.email) &&
    form.displayName.trim().length > 0 &&
    form.password.length >= 8 &&
    form.confirmPassword === form.password;

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const handleChange = (field: keyof RegisterFormState) => (event: ChangeEvent<HTMLInputElement>) => {
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
    setTouched({
      email: true,
      displayName: true,
      password: true,
      confirmPassword: true,
    });

    if (!isFormValid) {
      return;
    }

    try {
      await register({
        email: form.email,
        password: form.password,
        displayName: form.displayName.trim(),
      });
      navigate('/');
    } catch {
      return;
    }
  };

  return (
    <Box display="flex" justifyContent="center" alignItems="center" minHeight="100%">
      <Paper elevation={0} sx={{ width: '100%', maxWidth: 560, p: 4 }}>
        <Stack spacing={3} component="form" onSubmit={handleSubmit} noValidate>
          <Box>
            <Typography variant="h4" gutterBottom>
              {t('auth.registerTitle')}
            </Typography>
            <Typography color="text.secondary">{t('auth.registerSubtitle')}</Typography>
          </Box>

          {error ? <Alert severity="error">{error || t('auth.registerFailed')}</Alert> : null}

          <TextField
            label={t('common.displayName')}
            value={form.displayName}
            onChange={handleChange('displayName')}
            onBlur={() => setTouched((previous) => ({ ...previous, displayName: true }))}
            error={Boolean(fieldErrors.displayName)}
            helperText={fieldErrors.displayName}
            autoComplete="name"
            fullWidth
          />

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
            autoComplete="new-password"
            fullWidth
          />

          <TextField
            label={t('common.confirmPassword')}
            type="password"
            value={form.confirmPassword}
            onChange={handleChange('confirmPassword')}
            onBlur={() => setTouched((previous) => ({ ...previous, confirmPassword: true }))}
            error={Boolean(fieldErrors.confirmPassword)}
            helperText={fieldErrors.confirmPassword}
            autoComplete="new-password"
            fullWidth
          />

          <Button type="submit" variant="contained" size="large" disabled={isLoading || !isFormValid}>
            {t('common.register')}
          </Button>

          <Typography color="text.secondary" textAlign="center">
            {t('auth.hasAccount')}{' '}
            <MuiLink component={RouterLink} to="/login">
              {t('common.login')}
            </MuiLink>
          </Typography>
        </Stack>
      </Paper>
    </Box>
  );
}
