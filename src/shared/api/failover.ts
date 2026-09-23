import type { AxiosError } from 'axios';
import { env } from '@/shared/config/env';
import type { ApiErrorEnvelope } from './types';

/**
 * Circuit breaker tiga tier untuk admin console.
 *
 * Reaktif: tetap di tier 1 sampai ada kegagalan infrastruktur nyata, lalu naik
 * SATU tier dan pin 5 menit sebelum tier 1 dicoba lagi. Tier terakhir terminal.
 *
 * Sesi tetap hidup lintas tier karena cookie `refresh_token` di-set dengan
 * `Domain=.sambasku.com` (env `REFRESH_COOKIE_DOMAIN` di API), jadi browser
 * mengirimkannya ke semua host tier. Tanpa itu, refresh di tier cadangan gagal
 * dan admin terlempar ke login.
 */

const PIN_MS = 5 * 60 * 1000;

/** Timeout normal - sama dengan nilai BASE_CONFIG sebelum failover ada. */
const DEFAULT_TIMEOUT_MS = 15_000;

/**
 * Timeout tier terakhir: Render paket gratis tidur setelah ~15 menit dan bangun
 * sampai ~60 detik. Console adalah SPA browser, jadi menunggu penuh boleh -
 * asalkan UI memberi tahu (lihat banner tier di shell admin).
 */
const COLD_START_TIMEOUT_MS = 75_000;

export interface ApiTier {
  readonly index: number;
  readonly baseUrl: string;
  readonly timeoutMs: number;
}

const urls = [env.apiBaseUrl, ...env.apiBaseUrlFallbacks];

export const apiTiers: readonly ApiTier[] = urls.map((baseUrl, index) => ({
  index,
  baseUrl,
  timeoutMs:
    index === urls.length - 1 && urls.length > 1 ? COLD_START_TIMEOUT_MS : DEFAULT_TIMEOUT_MS,
}));

/** false = tidak ada tujuan pindah; klien jalan seperti sebelumnya. */
export const hasFallbacks = apiTiers.length > 1;

let pinnedIndex = 0;
let pinnedUntil = 0;
let warmedUpForPin = 0;

/** Murni - pin kedaluwarsa cukup berhenti dihitung, tanpa timer. */
function effectiveIndex(): number {
  if (pinnedUntil === 0 || Date.now() >= pinnedUntil) return 0;
  return pinnedIndex;
}

export function activeTier(): ApiTier {
  return apiTiers[effectiveIndex()];
}

/** Naik satu tier dan pin. null = sudah di tier terakhir. */
export function advanceTier(): ApiTier | null {
  const next = effectiveIndex() + 1;
  if (next >= apiTiers.length) return null;
  pinnedIndex = next;
  pinnedUntil = Date.now() + PIN_MS;
  warmUpTierAfter(next);
  notify();
  return apiTiers[next];
}

/**
 * Bangunkan tier SETELAH yang baru di-pin, sekali per jendela pin.
 *
 * Kenapa bukan cron 24/7: menjaga Render melek terus memakan ~730 dari 750 jam
 * gratis per bulan, jadi kuota bisa habis tepat saat cadangan diperlukan.
 */
function warmUpTierAfter(pinnedAt: number): void {
  const warm = apiTiers[pinnedAt + 1];
  if (!warm) return;
  if (warmedUpForPin === pinnedUntil) return;
  warmedUpForPin = pinnedUntil;
  try {
    const origin = new URL(warm.baseUrl, window.location.origin).origin;
    // Sengaja fire-and-forget: hanya usaha memulai boot lebih awal.
    void fetch(`${origin}/health`, { method: 'GET', mode: 'cors' }).catch(() => {});
  } catch {
    // baseUrl relatif / tidak bisa diparse: lewati saja.
  }
}

/** Hanya metode idempoten boleh diulang otomatis. */
export function isReplayableMethod(method: string | undefined): boolean {
  const m = (method ?? 'GET').toUpperCase();
  return m === 'GET' || m === 'HEAD';
}

/**
 * Apakah error axios ini kegagalan INFRASTRUKTUR, bukan error aplikasi?
 *
 * Tidak memindahkan tier: 401 (urusan interceptor refresh), 429 RATE_LIMITED
 * (pindah host justru menembus limit), dan JSON 500 INTERNAL_ERROR (bug
 * aplikasi, sama saja di tier lain).
 */
export function isInfraFailure(error: AxiosError<ApiErrorEnvelope>): boolean {
  // Tidak ada respons sama sekali: timeout, DNS, koneksi putus.
  if (!error.response) return error.code !== 'ERR_CANCELED';

  const status = error.response.status;
  const data = error.response.data as ApiErrorEnvelope | string | undefined;
  const isEnvelope = typeof data === 'object' && data !== null && 'success' in data;

  if (status === 502 || status === 504) return true;
  if (status === 503) {
    // 503 aplikasi (provider mati) akan sama di tier lain.
    return !isEnvelope || (data as ApiErrorEnvelope).error_code === 'UPSTREAM_CAPACITY';
  }
  // Body non-JSON pada 5xx = halaman error HTML Cloudflare (1015/1027/1101/1102).
  if (status >= 500 && !isEnvelope) return true;
  return false;
}

// ---- Langganan untuk banner tier di UI ----

type Listener = () => void;
const listeners = new Set<Listener>();

function notify(): void {
  for (const l of listeners) l();
}

export function subscribeTier(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Snapshot untuk `useSyncExternalStore` - stabil selama tier tidak berubah. */
export function activeTierSnapshot(): ApiTier {
  return activeTier();
}
