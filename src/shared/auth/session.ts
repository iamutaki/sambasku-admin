/**
 * Session store (in-memory) - access token + user sesi login.
 *
 * Prinsip (docs/api/00-api-auth.md): access_token HANYA disimpan di memory,
 * TIDAK di localStorage/sessionStorage (XSS = kehilangan token). refresh_token
 * hidup di httpOnly cookie yang dikelola browser - otomatis dikirim ke
 * POST /api/v1/auth/refresh saat access token kadaluarsa.
 *
 * Konsekuensi: hard reload = access token hilang. User di-restore via
 * `POST /auth/refresh` (cookie) → decode klaim JWT (sub + role) → signIn ulang
 * (lihat `features/auth/application/try-restore-session.ts`). Session ini
 * observable: komponen subscribe via `useAuth()` (useSyncExternalStore).
 */

export interface SessionUser {
  id: string;
  username: string;
  role: string;
}

export interface SessionState {
  accessToken: string | null;
  expiresAt: number | null; // epoch ms; token dianggap kadaluarsa setelah ini
  user: SessionUser | null;
}

export const EMPTY_SESSION: SessionState = { accessToken: null, expiresAt: null, user: null };

const listeners = new Set<() => void>();
let state: SessionState = EMPTY_SESSION;

function emit(): void {
  for (const listener of Array.from(listeners)) listener();
}

// Cache identitas non-sensitif (id/username/role) di sessionStorage -
// dibutuhkan untuk menampilkan nama user dengan benar saat hard reload
// sambil menunggu refresh token. Access token TIDAK PERNAH disentuh.
const USER_CACHE_KEY = 'sambasku_admin_user_v1';

export function restoreSessionUser(): SessionUser | null {
  try {
    const raw = sessionStorage.getItem(USER_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SessionUser;
    if (typeof parsed?.id !== 'string' || typeof parsed?.username !== 'string' || typeof parsed?.role !== 'string') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function cacheUser(user: SessionUser): void {
  try {
    sessionStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
  } catch {
    // storage penuh/private mode - abaikan, sesi tetap jalan in-memory
  }
}

/**
 * Bangun SessionUser dari klaim JWT (sub = user_id, role) dengan fallback ke
 * user yang di-cache di sessionStorage (username). Null kalau `sub` tidak ada
 * (token invalid bentuk).
 */
export function userFromJwtClaims(
  claims: { sub?: string; role?: string; username?: string },
  cached?: SessionUser | null,
): SessionUser | null {
  if (!claims.sub) return null;
  return {
    id: claims.sub,
    username: cached?.username ?? claims.username ?? claims.sub,
    role: claims.role ?? cached?.role ?? 'contributor',
  };
}

export const sessionStore = {
  getSnapshot(): SessionState {
    return state;
  },

  isAuthenticated(): boolean {
    return state.accessToken !== null;
  },

  /** Login/refresh sukses: simpan token + user baru. */
  signIn(accessToken: string, expiresIn: number, user: SessionUser): void {
    cacheUser(user);
    state = { accessToken, expiresAt: Date.now() + expiresIn * 1000, user };
    emit();
  },

  /** Refresh sukses di tengah sesi: ganti token + TTL, user dipertahankan. */
  updateAccessToken(accessToken: string, expiresIn: number): void {
    if (state.accessToken === null) return;
    state = { ...state, accessToken, expiresAt: Date.now() + expiresIn * 1000 };
    emit();
  },

  /** Logout / refresh gagal → kembali ke sesi kosong. */
  clear(): void {
    try {
      sessionStorage.removeItem(USER_CACHE_KEY);
    } catch {
      // abaikan
    }
    state = EMPTY_SESSION;
    emit();
  },

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};