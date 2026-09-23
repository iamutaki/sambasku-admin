import axios, { type AxiosError, type AxiosRequestConfig } from 'axios';
import { env } from '@/shared/config/env';
import { restoreSessionUser, sessionStore, userFromJwtClaims } from '@/shared/auth/session';
import { refreshAccessTokenSingleFlight } from './refresh';
import { AuthExpiredError, isAuthExpiredError, normalizeError } from './error';
import type { ApiErrorEnvelope, ApiOkEnvelope } from './types';
import { decodeJwtClaims } from '@/shared/utils/jwt';

const AUTH_ENDPOINT_PREFIX = '/auth/';

/**
 * Instances HTTP.
 *
 * - `authClient` - TANPA interceptor auth/token. Hanya dipakai alur auth
 *   (login/refresh/logout) supaya request refresh TIDAK memicu interceptor
 *   401 → refresh → ... tak terbatas.
 * - `client` - interceptor Authorization + auto-refresh (dipakai SEMUA
 *   request data aplikasi).
 *
 * `withCredentials: true` agar cookie httpOnly refresh_token ikut terkirim
 * (khususnya saat baseURL berbentuk absolute URL lintas origin).
 */
const BASE_CONFIG: AxiosRequestConfig = {
  baseURL: env.apiBaseUrl,
  timeout: 15_000,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
};

export const authClient = axios.create(BASE_CONFIG);
export const client = axios.create(BASE_CONFIG);

// authClient tidak membawa interceptor token (supaya login/refresh tidak
// memicu loop 401 → refresh). Error-nya tetap dinormalisasi ke ApiError
// agar halaman auth bisa membaca status, error_code, dan message.
authClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiErrorEnvelope>) => Promise.reject(normalizeError(error)),
);

// ---- Interceptor: sisipkan Authorization: Bearer <access_token> ----
client.interceptors.request.use((config) => {
  const token = sessionStore.getSnapshot().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

interface RetryableRequestConfig extends AxiosRequestConfig {
  _retried?: boolean;
}

type OnAuthExpiredHandler = () => void;
let onAuthExpired: OnAuthExpiredHandler | null = null;

/** Daftarkan handler navigasi → /login saat sesi kadaluarsa (dipanggil dari app boot). */
export function setOnAuthExpired(handler: OnAuthExpiredHandler | null): void {
  onAuthExpired = handler;
}

export interface RefreshTokenResult {
  accessToken: string;
  expiresIn: number;
}

/** POST /auth/refresh - klien web: refresh_token diambil browser dari httpOnly cookie. */
async function refreshTokenRequest(): Promise<RefreshTokenResult> {
  const res = await authClient.post<ApiOkEnvelope<{ access_token: string; expires_in: number }>>('/auth/refresh', {});
  return { accessToken: res.data.data.access_token, expiresIn: res.data.data.expires_in };
}

/**
 * Dapatkan access token baru (single-flight, Section auth docs). Dipakai
 * interceptor (retry otomatis) DAN boot-time session restore. Update sesi:
 * - sudah login      → `updateAccessToken` (user dipertahankan)
 * - belum login      → restore user dari klaim JWT + cache sessionStorage
 */
export async function performRefresh(): Promise<string> {
  return refreshAccessTokenSingleFlight(async () => {
    const { accessToken, expiresIn } = await refreshTokenRequest();
    if (sessionStore.isAuthenticated()) {
      sessionStore.updateAccessToken(accessToken, expiresIn);
    } else {
      const user = userFromJwtClaims(decodeJwtClaims(accessToken), restoreSessionUser());
      if (user) {
        sessionStore.signIn(accessToken, expiresIn, user);
      } else {
        sessionStore.clear();
      }
    }
    return accessToken;
  });
}

function isRetryableUnauthorized(error: AxiosError<ApiErrorEnvelope>): boolean {
  const config = error.config as RetryableRequestConfig | undefined;
  if (error.response?.status !== 401) return false;
  if (!config || config._retried) return false;
  // Request auth (login/refresh) jangan di-retry - refresh yang gagal tidak
  // boleh memicu refresh lagi.
  if (config.url?.startsWith(AUTH_ENDPOINT_PREFIX)) return false;
  // Tidak ada token = jelas belum login; biarkan halaman login menangani.
  if (!sessionStore.isAuthenticated()) return false;
  return true;
}

client.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiErrorEnvelope>) => {
    if (!isRetryableUnauthorized(error)) {
      return Promise.reject(normalizeError(error));
    }

    const config = error.config as RetryableRequestConfig;

    try {
      const accessToken = await performRefresh();
      config._retried = true;
      config.headers = { ...(config.headers ?? {}), Authorization: `Bearer ${accessToken}` };
      return client(config);
    } catch (refreshError) {
      if (isAuthExpiredError(refreshError)) {
        sessionStore.clear();
        onAuthExpired?.();
        return Promise.reject(new AuthExpiredError());
      }
      // Gagal bukan karena token (mis. jaringan): sesi dipertahankan, request
      // asli gagal normal - halaman menampilkan error.
      return normalizeError(refreshError, 'Sesi tidak dapat diperbarui, coba lagi');
    }
  },
);