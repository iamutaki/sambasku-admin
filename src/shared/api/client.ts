import axios, {
  type AxiosError,
  type AxiosRequestConfig,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';
import { env } from '@/shared/config/env';
import { restoreSessionUser, sessionStore, userFromJwtClaims } from '@/shared/auth/session';
import { refreshAccessTokenSingleFlight } from './refresh';
import { decideFailoverStep, sameHost } from './failover-step';
import type { AbortLike } from './cold-host-gate';
import {
  acquireColdSlot,
  activeTier,
  advanceTier,
  apiTiers,
  getForcedTierIndex,
  hasFallbacks,
  isColdTier,
  isFailoverReplayable,
  isInfraFailure,
  releaseColdSlot,
} from './failover';
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
function releaseCold(config: InternalAxiosRequestConfig | undefined): void {
  const gated = config as (InternalAxiosRequestConfig & { _coldGated?: boolean }) | undefined;
  if (!gated?._coldGated) return;
  gated._coldGated = false;
  releaseColdSlot();
}

async function applyActiveTier(config: InternalAxiosRequestConfig): Promise<InternalAxiosRequestConfig> {
  // Tanpa fallback dan tanpa paksa admin: biarkan baseURL default env.
  if (!hasFallbacks() && getForcedTierIndex() === null) return config;
  // Axios di browser hanya punya satu timeout untuk seluruh request, tidak bisa
  // memisahkan connect dan receive seperti Dio. Yang membatasi ledakan koneksi
  // 75 detik adalah antrean host dingin, bukan angka timeout-nya.
  let tier = activeTier();
  let gated = false;
  if (isColdTier(tier)) {
    await acquireColdSlot(config.signal as AbortLike | undefined);
    gated = true;
    tier = activeTier();
    if (!isColdTier(tier)) {
      releaseColdSlot();
      gated = false;
    }
  }
  config.baseURL = tier.baseUrl;
  config.timeout = tier.timeoutMs;
  if (gated) (config as InternalAxiosRequestConfig & { _coldGated?: boolean })._coldGated = true;
  return config;
}

authClient.interceptors.request.use(applyActiveTier);
client.interceptors.request.use(applyActiveTier);

// authClient tidak membawa interceptor token (supaya login/refresh tidak
// memicu loop 401 → refresh). Error-nya tetap dinormalisasi ke ApiError
// agar halaman auth bisa membaca status, error_code, dan message.
authClient.interceptors.response.use(
  (response) => {
    releaseCold(response.config);
    return response;
  },
  async (error: AxiosError<ApiErrorEnvelope>) => {
    releaseCold(error.config);
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
 * Naikkan tier saat kegagalan infrastruktur, lalu ulangi SEKALI untuk
 * GET/HEAD dan POST sesi auth (`/auth/refresh`, `/auth/login`).
 *
 * Mutasi data lain tidak diulang otomatis walau tier sudah pindah: timeout
 * terima respons bisa berarti server SUDAH menyimpan, jadi mengulang berisiko
 * data ganda. Pin tetap berubah, sehingga percobaan ulang dari admin sendiri
 * langsung mendarat di tier baru.
 *
 * Mengembalikan respons kalau berhasil diulang, atau null kalau tidak.
 */
async function retryOnNextTier(
  instance: typeof client,
  error: AxiosError<ApiErrorEnvelope>,
): Promise<AxiosResponse | null> {
  if (!hasFallbacks() || !isInfraFailure(error)) return null;

  const config = error.config as (RetryableRequestConfig & InternalAxiosRequestConfig) | undefined;
  if (!config) return null;

  const active = activeTier();
  const step = decideFailoverStep({
    replayable: isFailoverReplayable(config.method, config.url),
    replayed: config._failoverRetried === true,
    failedOnActiveHost: sameHost(config.baseURL, active.baseUrl),
    hasNextTier: active.index + 1 < apiTiers.length,
  });
  if (step.advance) advanceTier();
  if (!step.retry) return null;

  const target = activeTier();
  if (sameHost(config.baseURL, target.baseUrl)) return null;

  config._failoverRetried = true;
  config.baseURL = target.baseUrl;
  config.timeout = target.timeoutMs;
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
  (response) => {
    releaseCold(response.config);
    return response;
  },
  async (error: AxiosError<ApiErrorEnvelope>) => {
    releaseCold(error.config);
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