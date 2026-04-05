import { AppBar, Box, Button, Container, IconButton, Stack, Toolbar, Typography } from '@mui/material';
import Brightness4RoundedIcon from '@mui/icons-material/Brightness4Rounded';
import TranslateRoundedIcon from '@mui/icons-material/TranslateRounded';
import { useTranslation } from 'react-i18next';
import {
  BrowserRouter,
  Link as RouterLink,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useParams,
} from 'react-router-dom';

import Home from '@/pages/Home';
import Login from '@/pages/Login';
import MeetingRoom from '@/pages/MeetingRoom';
import Register from '@/pages/Register';
import { useAuthStore } from '@/stores';
import { useThemeMode } from '@/theme/ThemeProvider';

function ProtectedRoute() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}

function AppLayout() {
  const { t, i18n } = useTranslation();
  const { mode, toggleColorMode } = useThemeMode();
  const { isAuthenticated, logout } = useAuthStore((state) => ({
    isAuthenticated: state.isAuthenticated,
    logout: state.logout,
  }));

  const toggleLanguage = () => {
    void i18n.changeLanguage(i18n.language === 'vi' ? 'en' : 'vi');
  };

  return (
    <Box minHeight="100vh" display="flex" flexDirection="column">
      <AppBar position="sticky" color="transparent" elevation={0}>
        <Toolbar sx={{ gap: 2, justifyContent: 'space-between' }}>
          <Typography component={RouterLink} to="/" variant="h6" sx={{ color: 'inherit', textDecoration: 'none' }}>
            {t('common.appName')}
          </Typography>

          <Stack direction="row" spacing={1} alignItems="center">
            <Button component={RouterLink} to="/history" color="inherit">
              {t('common.history')}
            </Button>
            <IconButton color="inherit" onClick={toggleLanguage} aria-label={t('common.switchLanguage')}>
              <TranslateRoundedIcon />
            </IconButton>
            <IconButton color="inherit" onClick={toggleColorMode} aria-label={t('common.toggleTheme')}>
              <Brightness4RoundedIcon color={mode === 'dark' ? 'primary' : 'inherit'} />
            </IconButton>
            {isAuthenticated ? (
              <Button onClick={logout} color="inherit">
                {t('common.logout')}
              </Button>
            ) : (
              <Button component={RouterLink} to="/login" color="inherit">
                {t('common.login')}
              </Button>
            )}
          </Stack>
        </Toolbar>
      </AppBar>

      <Container component="main" sx={{ py: 6, flex: 1 }}>
        <Outlet />
      </Container>
    </Box>
  );
}

function PlaceholderPage({ title, description }: { title: string; description: string }) {
  return (
    <Stack spacing={1.5}>
      <Typography variant="h4">{title}</Typography>
      <Typography color="text.secondary">{description}</Typography>
    </Stack>
  );
}

function JoinMeetingPage() {
  const { roomCode } = useParams();
  const { t } = useTranslation();

  return (
    <PlaceholderPage
      title={t('routes.joinTitle')}
      description={`${t('common.joinMeeting')}: ${roomCode}`}
    />
  );
}

function HistoryPage() {
  const { t } = useTranslation();
  return <PlaceholderPage title={t('routes.historyTitle')} description={t('common.history')} />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/join/:roomCode" element={<JoinMeetingPage />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<Home />} />
            <Route path="/meeting/:id" element={<MeetingRoom />} />
            <Route path="/history" element={<HistoryPage />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
