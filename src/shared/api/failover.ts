import type { AxiosError } from 'axios';
import { env } from '@/shared/config/env';
import { ColdHostGate, type AbortLike } from './cold-host-gate';
import { isAbortError } from './failover-step';
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
 * Probe `/health` hanya untuk memulai boot. Tidak perlu menunggu instance siap,
 * dan koneksi yang menggantung harus bisa dibatalkan.
 */
const HEALTH_PROBE_MS = 8_000;

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

function buildTiers(baseUrls: readonly string[]): ApiTier[] {
  return baseUrls.map((baseUrl, index) => ({
    index,
    baseUrl,
    timeoutMs:
      index === baseUrls.length - 1 && baseUrls.length > 1 ? COLD_START_TIMEOUT_MS : DEFAULT_TIMEOUT_MS,
  }));
}

let tiers = buildTiers(urls);
const coldGate = new ColdHostGate();

/** false = tidak ada tujuan pindah; klien jalan seperti sebelumnya. */
export function hasFallbacks(): boolean {
  return tiers.length > 1;
}

/** Live binding: banner membaca panjang daftar tier yang sedang dipakai. */
export { tiers as apiTiers };

/** Tier terakhir menanggung cold start (timeout lebih panjang dari tier biasa). */
export function isColdTier(tier: ApiTier): boolean {
  return tier.timeoutMs > DEFAULT_TIMEOUT_MS;
}

export function acquireColdSlot(signal?: AbortLike): Promise<void> {
  return coldGate.acquire(signal);
}

export function releaseColdSlot(): void {
  coldGate.release();
}

let pinnedIndex = 0;
let pinnedUntil = 0;
let warmedUpForPin = 0;
let probeAbort: AbortController | null = null;
let probeTimer: ReturnType<typeof setTimeout> | null = null;

/** Murni - pin kedaluwarsa cukup berhenti dihitung, tanpa timer. */
function effectiveIndex(): number {
  if (pinnedUntil === 0 || Date.now() >= pinnedUntil) return 0;
  return pinnedIndex;
}

export function activeTier(): ApiTier {
  return tiers[effectiveIndex()]!;
}

/** Naik satu tier dan pin. null = sudah di tier terakhir. */
export function advanceTier(): ApiTier | null {
  const next = effectiveIndex() + 1;
  if (next >= tiers.length) return null;
  pinnedIndex = next;
  pinnedUntil = Date.now() + PIN_MS;
  warmUpTierAfter(next);
  notify();
  return tiers[next] ?? null;
}

/**
 * Bangunkan tier SETELAH yang baru di-pin, sekali per jendela pin.
 *
 * Kenapa bukan cron 24/7: menjaga Render melek terus memakan ~730 dari 750 jam
 * gratis per bulan, jadi kuota bisa habis tepat saat cadangan diperlukan.
 */
function cancelProbe(): void {
  if (probeTimer !== null) clearTimeout(probeTimer);
  probeTimer = null;
  probeAbort?.abort();
  probeAbort = null;
}

function warmUpTierAfter(pinnedAt: number): void {
  const warm = tiers[pinnedAt + 1];
  if (!warm) return;
  if (warmedUpForPin === pinnedUntil) return;

  let origin: string;
  try {
    const base = typeof window === 'undefined' ? 'https://placeholder.invalid' : window.location.origin;
    origin = new URL(warm.baseUrl, base).origin;
  } catch {
    return;
  }
  warmedUpForPin = pinnedUntil;

  cancelProbe();
  const controller = new AbortController();
  probeAbort = controller;
  probeTimer = setTimeout(() => controller.abort(), HEALTH_PROBE_MS);
  // `/health` tidak ikut CORS `/api/*`. `no-cors` tetap mengirim GET supaya
  // Render bangun; body-nya tidak perlu dibaca. Di Node (tes) mode ini tidak ada.
  const init: RequestInit = { method: 'GET', signal: controller.signal };
  if (typeof window !== 'undefined') init.mode = 'no-cors';
  void fetch(`${origin}/health`, init)
    .catch(() => {})
    .finally(() => {
      if (probeAbort !== controller) return;
      if (probeTimer !== null) clearTimeout(probeTimer);
      probeTimer = null;
      probeAbort = null;
    });
}

/** Hanya untuk tes. Mengganti daftar tier dan melepas pin beserta antrian host dingin. */
export function __configureFailoverForTests(baseUrls: readonly string[]): void {
  tiers = buildTiers(baseUrls);
  pinnedIndex = 0;
  pinnedUntil = 0;
  warmedUpForPin = 0;
  cancelProbe();
  coldGate.reset();
  notify();
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
  // Batal pengguna bukan kegagalan infrastruktur.
  if (!error.response) return !isAbortError(error);

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
