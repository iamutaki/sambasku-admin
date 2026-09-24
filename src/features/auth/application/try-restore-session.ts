import { performRefresh } from '@/shared/api/client';
import { isAuthExpiredError } from '@/shared/api/error';
import { sessionStore } from '@/shared/auth/session';

let restorePromise: Promise<boolean> | null = null;

/**
 * Session restore saat boot / hard reload.
 *
 * Access token di memory hilang ketika halaman di-refresh (docs/auth: token
 * TIDAK di-persist). Proses: panggil POST /auth/refresh (httpOnly cookie
 * otomatis terkirim) → token baru → build user dari klaim JWT + cache
 * sessionStorage → signIn ulang. Kalau cookie tidak ada/invalid (401) → sesi
 * dianggap logout (diam, tanpa error banner).
 *
 * Kegagalan jaringan / timeout / 5xx TIDAK memanggil `sessionStore.clear()`:
 * cache username di sessionStorage masih diperlukan setelah circuit breaker
 * pindah tier dan refresh dicoba lagi.
 *
 * Idempotent + single-flight: dipanggil dari `beforeLoad` root route pada
 * setiap navigasi, biayanya nol kalau sesi sudah aktif.
 */
export function tryRestoreSession(): Promise<boolean> {
  if (sessionStore.isAuthenticated()) return Promise.resolve(true);

  if (!restorePromise) {
    restorePromise = performRefresh()
      .then(() => true)
      .catch((err: unknown) => {
        if (isAuthExpiredError(err)) {
          sessionStore.clear();
        }
        return false;
      })
      .finally(() => {
        restorePromise = null;
      });
  }
  return restorePromise;
}
