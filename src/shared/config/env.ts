// Default relatif - dev server memakai proxy same-origin (vite.config.ts).
// Build staging/production menimpa via .env.staging / .env.production
// (absolute URL lintas situs) dengan CORS + cookie sameSite=None hanya kalau
// frontend & API memang beda situs.
const DEFAULT_API_BASE_URL = '/api/v1';
const DEFAULT_APP_NAME = 'Kamus Sambas - Admin Console';

/**
 * Tier cadangan API, urut, dari `VITE_API_BASE_URL_FALLBACKS` (dipisah koma).
 * Kosong = circuit breaker tidak punya tujuan pindah dan diam.
 * Lihat `shared/api/failover.ts` dan docs/backlogs/FAILOVER.md.
 */
const apiBaseUrlFallbacks: readonly string[] = (import.meta.env.VITE_API_BASE_URL_FALLBACKS ?? '')
  .split(',')
  .map((u: string) => u.trim())
  .filter((u: string) => u !== '');

export const env = {
  appName: import.meta.env.VITE_APP_NAME ?? DEFAULT_APP_NAME,
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? DEFAULT_API_BASE_URL,
  apiBaseUrlFallbacks,
} as const;