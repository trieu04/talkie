import { AppBar, Box, Button, Container, IconButton, Stack, Toolbar, Typography } from '@mui/material';
import Brightness4RoundedIcon from '@mui/icons-material/Brightness4Rounded';
import LoginRoundedIcon from '@mui/icons-material/LoginRounded';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import TranslateRoundedIcon from '@mui/icons-material/TranslateRounded';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import HomeRoundedIcon from '@mui/icons-material/HomeRounded';
import { Link as RouterLink, Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { useAuthStore } from '@/stores';
import { useThemeMode } from '@/theme/ThemeProvider';

const publicPaths = ['/login', '/register'];

export default function AppFrame() {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const { mode, toggleColorMode } = useThemeMode();
  const { isAuthenticated, logout } = useAuthStore((state) => ({
    isAuthenticated: state.isAuthenticated,
    logout: state.logout,
  }));

  const isAuthSurface = publicPaths.includes(location.pathname);
  const isMeetingSurface = location.pathname.includes('/meeting/') || location.pathname.includes('/join/');

  const handleLanguageToggle = () => {
    void i18n.changeLanguage(i18n.language === 'vi' ? 'en' : 'vi');
  };

  return (
    <Box
      sx={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.default',
      }}
    >
      <AppBar
        position="sticky"
        color="transparent"
        elevation={0}
        sx={{
          backdropFilter: 'blur(18px)',
          bgcolor: 'talkie.navBg',
          borderBottom: 1,
          borderColor: 'talkie.borderSubtle',
        }}
      >
        <Container maxWidth="xl">
          <Toolbar disableGutters sx={{ minHeight: 72, gap: 2, justifyContent: 'space-between' }}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: 3,
                  bgcolor: 'primary.main',
                  color: 'primary.contrastText',
                  display: 'grid',
                  placeItems: 'center',
                  fontWeight: 800,
                  letterSpacing: '-0.04em',
                }}
              >
                T
              </Box>
              <Box>
                <Typography
                  component={RouterLink}
                  to={isAuthenticated ? '/' : '/login'}
                  sx={{ color: 'text.primary', textDecoration: 'none', fontWeight: 800, fontSize: '1.05rem' }}
                >
                  {t('common.appName')}
                </Typography>
                <Typography variant="caption" color="text.tertiary">
                  {isMeetingSurface ? t('common.workspaceLabel') : t('common.productTagline')}
                </Typography>
              </Box>
            </Stack>

            <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap" justifyContent="flex-end">
              {isAuthenticated && !isAuthSurface ? (
                <>
                  <Button component={RouterLink} to="/" color="inherit" startIcon={<HomeRoundedIcon />}>
                    {t('common.home')}
                  </Button>
                  <Button component={RouterLink} to="/history" color="inherit" startIcon={<HistoryRoundedIcon />}>
                    {t('common.history')}
                  </Button>
                </>
              ) : null}
              <IconButton color="inherit" onClick={handleLanguageToggle} aria-label={t('common.switchLanguage')}>
                <TranslateRoundedIcon />
              </IconButton>
              <IconButton color="inherit" onClick={toggleColorMode} aria-label={t('common.toggleTheme')}>
                <Brightness4RoundedIcon color={mode === 'dark' ? 'primary' : 'inherit'} />
              </IconButton>
              {isAuthenticated ? (
                <Button onClick={logout} color="inherit" startIcon={<LogoutRoundedIcon />}>
                  {t('common.logout')}
                </Button>
              ) : (
                <Button component={RouterLink} to="/login" color="inherit" startIcon={<LoginRoundedIcon />}>
                  {t('common.login')}
                </Button>
              )}
            </Stack>
          </Toolbar>
        </Container>
      </AppBar>

      <Box component="main" sx={{ flex: 1 }}>
        <Outlet />
      </Box>
    </Box>
  );
}
