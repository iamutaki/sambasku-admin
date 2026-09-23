import axios, {
  type AxiosError,
  type AxiosRequestConfig,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';
import { env } from '@/shared/config/env';
import { restoreSessionUser, sessionStore, userFromJwtClaims } from '@/shared/auth/session';
import { refreshAccessTokenSingleFlight } from './refresh';
import { activeTier, advanceTier, hasFallbacks, isInfraFailure, isReplayableMethod } from './failover';
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

// ---- Circuit breaker tiga tier (shared/api/failover.ts) ----
// Dipasang di KEDUA instance: refresh harus mengikuti tier yang sama dengan
// request yang memicunya, kalau tidak refresh menembak tier 1 yang sedang mati
// sementara request datanya sudah pindah.
function applyActiveTier(config: InternalAxiosRequestConfig): InternalAxiosRequestConfig {
  if (!hasFallbacks) return config;
  const tier = activeTier();
  config.baseURL = tier.baseUrl;
  config.timeout = tier.timeoutMs;
  return config;
}

authClient.interceptors.request.use(applyActiveTier);
client.interceptors.request.use(applyActiveTier);

// authClient tidak membawa interceptor token (supaya login/refresh tidak
// memicu loop 401 → refresh). Error-nya tetap dinormalisasi ke ApiError
// agar halaman auth bisa membaca status, error_code, dan message.
authClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiErrorEnvelope>) => {
    const retried = await retryOnNextTier(authClient, error);
    if (retried) return retried;
    return Promise.reject(normalizeError(error));
  },
);

// ---- Interceptor: sisipkan Authorization: Bearer <access_token> ----
client.interceptors.request.use((config) => {
  const token = sessionStore.getSnapshot().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

interface RetryableRequestConfig extends AxiosRequestConfig {
  _retried?: boolean;
  _failoverRetried?: boolean;
}

/**
 * Naikkan tier saat kegagalan infrastruktur, lalu ulangi SEKALI - hanya untuk
 * metode idempoten.
 *
 * Mutasi tidak diulang otomatis walau tier sudah pindah: timeout terima respons
 * bisa berarti server SUDAH menyimpan, jadi mengulang berisiko data ganda. Pin
 * tetap berubah, sehingga percobaan ulang dari admin sendiri langsung mendarat
 * di tier baru.
 *
 * Mengembalikan respons kalau berhasil diulang, atau null kalau tidak.
 */
async function retryOnNextTier(
  instance: typeof client,
  error: AxiosError<ApiErrorEnvelope>,
): Promise<AxiosResponse | null> {
  if (!hasFallbacks || !isInfraFailure(error)) return null;

  const config = error.config as (RetryableRequestConfig & InternalAxiosRequestConfig) | undefined;
  const next = advanceTier();
  if (!next || !config) return null;
  if (config._failoverRetried || !isReplayableMethod(config.method)) return null;

  config._failoverRetried = true;
  config.baseURL = next.baseUrl;
  config.timeout = next.timeoutMs;
  try {
    return await instance(config);
  } catch {
    // Tier berikutnya juga gagal: biarkan error asli yang dilaporkan.
    return null;
  }
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
      // Kegagalan infrastruktur didahulukan: 401 bukan kasusnya, dan mencoba
      // refresh saat host-nya sendiri mati hanya menambah satu request gagal.
      const retried = await retryOnNextTier(client, error);
      if (retried) return retried;
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