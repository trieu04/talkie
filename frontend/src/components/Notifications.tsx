import { Alert, Snackbar } from '@mui/material';
import { useEffect, type ReactNode, type SyntheticEvent } from 'react';

import { useNotificationStore } from '@/stores/notificationStore';

const AUTO_DISMISS_MS = 5000;

export function NotificationProvider({ children }: { children: ReactNode }) {
  const notification = useNotificationStore((state) => state.notification);
  const hideNotification = useNotificationStore((state) => state.hideNotification);

  useEffect(() => {
    if (!notification) {
      return undefined;
    }

    const timeout = window.setTimeout(() => {
      hideNotification();
    }, AUTO_DISMISS_MS);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [hideNotification, notification]);

  const handleClose = (_event: SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') {
      return;
    }

    hideNotification();
  };

  return (
    <>
      {children}
      <Snackbar
        key={notification?.id ?? 'notification-empty'}
        open={Boolean(notification)}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        onClose={handleClose}
        sx={{ mt: 8 }}
      >
        <Alert onClose={handleClose} severity={notification?.severity ?? 'info'} variant="filled" sx={{ width: '100%', minWidth: 280 }}>
          {notification?.message}
        </Alert>
      </Snackbar>
    </>
  );
}
