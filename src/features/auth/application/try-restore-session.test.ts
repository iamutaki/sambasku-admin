import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/shared/api/error';
import { restoreSessionUser, sessionStore } from '@/shared/auth/session';

vi.mock('@/shared/api/client', () => ({
  performRefresh: vi.fn(),
}));

import { performRefresh } from '@/shared/api/client';
import { tryRestoreSession } from './try-restore-session';

const USER_CACHE_KEY = 'sambasku_admin_user_v1';
const cachedUser = { id: '01HXYZABC', username: 'siti', role: 'admin' };

describe('tryRestoreSession', () => {
  beforeEach(() => {
    sessionStore.clear();
    sessionStorage.clear();
    vi.mocked(performRefresh).mockReset();
  });

  it('sukses → true tanpa mengubah cache yang sudah ada', async () => {
    sessionStorage.setItem(USER_CACHE_KEY, JSON.stringify(cachedUser));
    vi.mocked(performRefresh).mockResolvedValue('new-access');

    await expect(tryRestoreSession()).resolves.toBe(true);
    expect(restoreSessionUser()).toEqual(cachedUser);
  });

  it('401 → clear sesi (termasuk cache identitas) dan false', async () => {
    sessionStorage.setItem(USER_CACHE_KEY, JSON.stringify(cachedUser));
    vi.mocked(performRefresh).mockRejectedValue(
      new ApiError(401, 'UNAUTHORIZED', 'Refresh token tidak valid'),
    );

    await expect(tryRestoreSession()).resolves.toBe(false);
    expect(restoreSessionUser()).toBeNull();
    expect(sessionStore.isAuthenticated()).toBe(false);
  });

  it('network error → false tanpa menghapus cache identitas', async () => {
    sessionStorage.setItem(USER_CACHE_KEY, JSON.stringify(cachedUser));
    vi.mocked(performRefresh).mockRejectedValue(
      new ApiError(0, 'NETWORK_ERROR', 'Sesi tidak dapat diperbarui, coba lagi'),
    );

    await expect(tryRestoreSession()).resolves.toBe(false);
    expect(restoreSessionUser()).toEqual(cachedUser);
  });

  it('sudah autentikasi → true tanpa memanggil refresh', async () => {
    sessionStore.signIn('access', 900, cachedUser);
    await expect(tryRestoreSession()).resolves.toBe(true);
    expect(performRefresh).not.toHaveBeenCalled();
  });
});
