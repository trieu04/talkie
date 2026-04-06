import { create } from 'zustand';

export type NotificationSeverity = 'success' | 'error' | 'info' | 'warning';

interface NotificationMessage {
  id: number;
  message: string;
  severity: NotificationSeverity;
}

interface NotificationStoreState {
  notification: NotificationMessage | null;
}

interface NotificationStoreActions {
  hideNotification: () => void;
  showNotification: (notification: Omit<NotificationMessage, 'id'>) => void;
}

type NotificationStore = NotificationStoreState & NotificationStoreActions;

let nextNotificationId = 0;

export const useNotificationStore = create<NotificationStore>((set) => ({
  notification: null,
  hideNotification: () => set({ notification: null }),
  showNotification: (notification) =>
    set({
      notification: {
        ...notification,
        id: ++nextNotificationId,
      },
    }),
}));

export const showSuccess = (message: string) => {
  useNotificationStore.getState().showNotification({ message, severity: 'success' });
};

export const showError = (message: string) => {
  useNotificationStore.getState().showNotification({ message, severity: 'error' });
};

export const showInfo = (message: string) => {
  useNotificationStore.getState().showNotification({ message, severity: 'info' });
};

export const showWarning = (message: string) => {
  useNotificationStore.getState().showNotification({ message, severity: 'warning' });
};
