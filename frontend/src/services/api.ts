import axios, {
  AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios';

import { useAuthStore } from '@/stores/authStore';
import type { ApiErrorResponse, RefreshTokenResponse } from '@/types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';

interface RetryableAxiosRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

const getErrorMessage = (error: AxiosError<ApiErrorResponse>): string => {
  const responseData = error.response?.data;

  if (typeof responseData?.detail === 'string') {
    return responseData.detail;
  }

  if (responseData?.detail && typeof responseData.detail === 'object' && responseData.detail.message) {
    return responseData.detail.message;
  }

  return responseData?.message ?? error.message ?? 'Unexpected API error.';
};

export const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

const refreshClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

let refreshPromise: Promise<string | null> | null = null;

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const accessToken = useAuthStore.getState().accessToken;

  if (accessToken) {
    config.headers.set('Authorization', `Bearer ${accessToken}`);
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiErrorResponse>) => {
    const originalRequest = error.config as RetryableAxiosRequestConfig | undefined;

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;

      const authStore = useAuthStore.getState();
      if (!authStore.refreshToken) {
        authStore.logout();
        return Promise.reject(error);
      }

      refreshPromise ??= refreshClient
        .post<RefreshTokenResponse>('/auth/refresh', {
          refresh_token: authStore.refreshToken,
        })
        .then((response) => {
          const nextAccessToken = response.data.access_token;
          useAuthStore.getState().setTokens({
            accessToken: nextAccessToken,
            refreshToken: authStore.refreshToken,
          });
          return nextAccessToken;
        })
        .catch((refreshError) => {
          useAuthStore.getState().logout();
          throw refreshError;
        })
        .finally(() => {
          refreshPromise = null;
        });

      const nextAccessToken = await refreshPromise;

      if (nextAccessToken) {
        originalRequest.headers.set('Authorization', `Bearer ${nextAccessToken}`);
        return api(originalRequest as AxiosRequestConfig);
      }
    }

    return Promise.reject(new Error(getErrorMessage(error)));
  },
);

export default api;
