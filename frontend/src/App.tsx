import { Box, CircularProgress } from '@mui/material';
import { Suspense, lazy } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';

import AppFrame from '@/components/AppFrame';
import ErrorBoundary from '@/components/ErrorBoundary';
import { NotificationProvider } from '@/components/Notifications';
import Home from '@/pages/Home';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import { useAuthStore } from '@/stores';

const History = lazy(() => import('@/pages/History'));
const JoinMeeting = lazy(() => import('@/pages/JoinMeeting'));
const MeetingReplay = lazy(() => import('@/pages/MeetingReplay'));
const MeetingRoom = lazy(() => import('@/pages/MeetingRoom'));

function ProtectedRoute() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}

function AppLoadingFallback() {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <CircularProgress />
    </Box>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <NotificationProvider>
        <BrowserRouter>
          <Suspense fallback={<AppLoadingFallback />}>
            <Routes>
              <Route element={<AppFrame />}>
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/join/:roomCode" element={<JoinMeeting />} />

                <Route element={<ProtectedRoute />}>
                  <Route path="/" element={<Home />} />
                  <Route path="/meeting/:id" element={<MeetingRoom />} />
                  <Route path="/meeting/:id/replay" element={<MeetingReplay />} />
                  <Route path="/history" element={<History />} />
                </Route>
              </Route>
            </Routes>
          </Suspense>
        </BrowserRouter>
      </NotificationProvider>
    </ErrorBoundary>
  );
}
