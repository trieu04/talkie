import { beforeEach, describe, expect, it } from 'vitest';

import { showError, showSuccess, useNotificationStore } from '@/stores/notificationStore';

describe('notificationStore', () => {
  beforeEach(() => {
    useNotificationStore.setState({ notification: null });
  });

  it('has initial state with null notification', () => {
    const state = useNotificationStore.getState();
    expect(state.notification).toBeNull();
  });

  it('showNotification sets notification with auto-incrementing id', () => {
    useNotificationStore.getState().showNotification({ message: 'First', severity: 'info' });
    const firstId = useNotificationStore.getState().notification?.id;

    useNotificationStore.getState().showNotification({ message: 'Second', severity: 'info' });
    const secondId = useNotificationStore.getState().notification?.id;

    expect(firstId).toBeDefined();
    expect(secondId).toBeDefined();
    expect(secondId).toBeGreaterThan(firstId!);
  });

  it('hideNotification clears notification', () => {
    useNotificationStore.getState().showNotification({ message: 'Test', severity: 'info' });
    expect(useNotificationStore.getState().notification).not.toBeNull();

    useNotificationStore.getState().hideNotification();
    expect(useNotificationStore.getState().notification).toBeNull();
  });

  it('showSuccess helper shows success notification', () => {
    showSuccess('Operation completed');

    const notification = useNotificationStore.getState().notification;
    expect(notification?.message).toBe('Operation completed');
    expect(notification?.severity).toBe('success');
  });

  it('showError helper shows error notification', () => {
    showError('Something went wrong');

    const notification = useNotificationStore.getState().notification;
    expect(notification?.message).toBe('Something went wrong');
    expect(notification?.severity).toBe('error');
  });

  it('notification contains correct message and severity', () => {
    useNotificationStore.getState().showNotification({
      message: 'Warning message',
      severity: 'warning',
    });

    const notification = useNotificationStore.getState().notification;
    expect(notification?.message).toBe('Warning message');
    expect(notification?.severity).toBe('warning');
    expect(notification?.id).toBeDefined();
  });
});
