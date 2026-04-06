import axios from 'axios';
import { create } from 'zustand';
import { devtools, persist, createJSONStorage } from 'zustand/middleware';

import type {
  LoginRequest,
  LoginResponse,
  RefreshTokenResponse,
  RegisterRequest,
  User,
} from '@/types';

const AUTH_STORAGE_KEY = 'talkie-auth';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? import.meta.env.VITE_API_URL ?? '/api/v1';

const authApi = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

interface AuthStoreState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

interface AuthStoreActions {
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => void;
  register: (payload: RegisterRequest) => Promise<void>;
  refreshAccessToken: () => Promise<string | null>;
  setUser: (user: User | null) => void;
  setTokens: (tokens: { accessToken: string | null; refreshToken: string | null }) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
}

type AuthStore = AuthStoreState & AuthStoreActions;

const mapRegisterPayload = (payload: RegisterRequest) => ({
  email: payload.email,
  password: payload.password,
  display_name: payload.displayName,
});

const fetchCurrentUser = async (accessToken: string): Promise<User | null> => {
  try {
    const response = await authApi.get<User>('/hosts/me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    return response.data;
  } catch {
    return null;
  }
};

export const useAuthStore = create<AuthStore>()(
  devtools(
    persist(
      (set, get) => ({
        user: null,
        accessToken: null,
        refreshToken: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
        async login(credentials) {
          set({ isLoading: true, error: null });

          try {
            const response = await authApi.post<LoginResponse>('/auth/login', credentials);
            const accessToken = response.data.access_token;
            const refreshToken = response.data.refresh_token;
            const user = await fetchCurrentUser(accessToken);

            set({
              user,
              accessToken,
              refreshToken,
              isAuthenticated: true,
              isLoading: false,
              error: null,
            });
          } catch (error) {
            set({
              isLoading: false,
              error: axios.isAxiosError(error)
                ? (error.response?.data as { detail?: string } | undefined)?.detail ?? 'Login failed.'
                : 'Login failed.',
            });
            throw error;
          }
        },
        logout() {
          set({
            user: null,
            accessToken: null,
            refreshToken: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
          });
        },
        async register(payload) {
          set({ isLoading: true, error: null });

          try {
            const response = await authApi.post<User>('/auth/register', mapRegisterPayload(payload));

            set({ user: response.data, isLoading: false, error: null });
            await get().login({ email: payload.email, password: payload.password });
          } catch (error) {
            set({
              isLoading: false,
              error: axios.isAxiosError(error)
                ? (error.response?.data as { detail?: string } | undefined)?.detail ?? 'Registration failed.'
                : 'Registration failed.',
            });
            throw error;
          }
        },
        async refreshAccessToken() {
          const refreshToken = get().refreshToken;

          if (!refreshToken) {
            get().logout();
            return null;
          }

          set({ isLoading: true });

          try {
            const response = await authApi.post<RefreshTokenResponse>('/auth/refresh', {
              refresh_token: refreshToken,
            });

            const accessToken = response.data.access_token;
            const user = get().user ?? (await fetchCurrentUser(accessToken));

            set({
              accessToken,
              user,
              isAuthenticated: true,
              isLoading: false,
              error: null,
            });

            return accessToken;
          } catch (error) {
            get().logout();
            set({ isLoading: false, error: 'Session expired.' });
            throw error;
          }
        },
        setUser(user) {
          set({ user, isAuthenticated: Boolean(user ?? get().accessToken) });
        },
        setTokens(tokens) {
          set({
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            isAuthenticated: Boolean(tokens.accessToken),
          });
        },
        setLoading(isLoading) {
          set({ isLoading });
        },
        setError(error) {
          set({ error });
        },
      }),
      {
        name: AUTH_STORAGE_KEY,
        storage: createJSONStorage(() => localStorage),
        partialize: (state) => ({
          user: state.user,
          accessToken: state.accessToken,
          refreshToken: state.refreshToken,
          isAuthenticated: state.isAuthenticated,
        }),
      },
    ),
    { name: 'auth-store' },
  ),
);
