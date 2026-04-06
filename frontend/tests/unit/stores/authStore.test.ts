import { beforeEach, describe, expect, it, vi } from 'vitest';
import axios from 'axios';

vi.mock('axios', () => {
  const mockAxios = {
    create: vi.fn(() => mockAxios),
    post: vi.fn(),
    get: vi.fn(),
    isAxiosError: vi.fn(),
  };
  return { default: mockAxios };
});

import { useAuthStore } from '@/stores/authStore';

describe('authStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
  });

  it('has initial state with null user and tokens', () => {
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.accessToken).toBeNull();
    expect(state.refreshToken).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });

  it('login success updates state correctly', async () => {
    const mockUser = { id: '1', email: 'test@test.com', display_name: 'Test', created_at: '2024-01-01' };
    const mockAxiosInstance = axios.create();
    vi.mocked(mockAxiosInstance.post).mockResolvedValueOnce({
      data: { access_token: 'access123', refresh_token: 'refresh123' },
    });
    vi.mocked(mockAxiosInstance.get).mockResolvedValueOnce({ data: mockUser });

    await useAuthStore.getState().login({ email: 'test@test.com', password: 'password' });

    const state = useAuthStore.getState();
    expect(state.accessToken).toBe('access123');
    expect(state.refreshToken).toBe('refresh123');
    expect(state.user).toEqual(mockUser);
    expect(state.isAuthenticated).toBe(true);
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
  });

  it('login failure sets error', async () => {
    const mockAxiosInstance = axios.create();
    const mockError = { response: { data: { detail: 'Invalid credentials' } } };
    vi.mocked(mockAxiosInstance.post).mockRejectedValueOnce(mockError);
    vi.mocked(axios.isAxiosError).mockReturnValue(true);

    await expect(useAuthStore.getState().login({ email: 'test@test.com', password: 'wrong' })).rejects.toThrow();

    const state = useAuthStore.getState();
    expect(state.error).toBe('Invalid credentials');
    expect(state.isLoading).toBe(false);
    expect(state.isAuthenticated).toBe(false);
  });

  it('logout clears all auth state', () => {
    useAuthStore.setState({
      user: { id: '1', email: 'test@test.com', display_name: 'Test', created_at: '2024-01-01' },
      accessToken: 'access123',
      refreshToken: 'refresh123',
      isAuthenticated: true,
    });

    useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.accessToken).toBeNull();
    expect(state.refreshToken).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(state.error).toBeNull();
  });

  it('register success followed by auto-login', async () => {
    const mockUser = { id: '1', email: 'new@test.com', display_name: 'New User', created_at: '2024-01-01' };
    const mockAxiosInstance = axios.create();
    vi.mocked(mockAxiosInstance.post)
      .mockResolvedValueOnce({ data: mockUser })
      .mockResolvedValueOnce({
        data: { access_token: 'access123', refresh_token: 'refresh123' },
      });
    vi.mocked(mockAxiosInstance.get).mockResolvedValueOnce({ data: mockUser });

    await useAuthStore.getState().register({
      email: 'new@test.com',
      password: 'password',
      displayName: 'New User',
    });

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.accessToken).toBe('access123');
  });

  it('refreshAccessToken updates accessToken', async () => {
    useAuthStore.setState({
      refreshToken: 'refresh123',
      accessToken: 'oldAccess',
      isAuthenticated: true,
    });

    const mockAxiosInstance = axios.create();
    vi.mocked(mockAxiosInstance.post).mockResolvedValueOnce({
      data: { access_token: 'newAccess123' },
    });

    const newToken = await useAuthStore.getState().refreshAccessToken();

    expect(newToken).toBe('newAccess123');
    expect(useAuthStore.getState().accessToken).toBe('newAccess123');
  });

  it('setTokens updates tokens and isAuthenticated', () => {
    useAuthStore.getState().setTokens({
      accessToken: 'newAccess',
      refreshToken: 'newRefresh',
    });

    const state = useAuthStore.getState();
    expect(state.accessToken).toBe('newAccess');
    expect(state.refreshToken).toBe('newRefresh');
    expect(state.isAuthenticated).toBe(true);
  });

  it('setTokens with null accessToken sets isAuthenticated to false', () => {
    useAuthStore.setState({ isAuthenticated: true, accessToken: 'token' });

    useAuthStore.getState().setTokens({
      accessToken: null,
      refreshToken: null,
    });

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });
});
