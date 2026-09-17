import { describe, it, expect, beforeEach } from 'vitest';
import { sessionStore, restoreSessionUser, userFromJwtClaims, EMPTY_SESSION, type SessionUser } from '@/shared/auth/session';

describe('sessionStore', () => {
  beforeEach(() => {
    sessionStore.clear();
  });

  it('dimulai dalam keadaan kosong', () => {
    expect(sessionStore.getSnapshot()).toEqual(EMPTY_SESSION);
    expect(sessionStore.isAuthenticated()).toBe(false);
  });

  it('signIn menyimpan token + user dan menandai autentikasi', () => {
    const user: SessionUser = { id: '01HXYZABC', username: 'admin', role: 'admin' };
    sessionStore.signIn('access-token', 900, user);

    const state = sessionStore.getSnapshot();
    expect(sessionStore.isAuthenticated()).toBe(true);
    expect(state.accessToken).toBe('access-token');
    expect(state.user).toEqual(user);
    expect(state.expiresAt).toBeGreaterThan(Date.now());
  });

  it('updateAccessToken mengganti token tanpa menyentuh user', () => {
    const user: SessionUser = { id: '01HXYZABC', username: 'admin', role: 'admin' };
    sessionStore.signIn('old-token', 900, user);
    sessionStore.updateAccessToken('new-token', 1800);

    const state = sessionStore.getSnapshot();
    expect(state.accessToken).toBe('new-token');
    expect(state.user).toEqual(user);
  });

  it('updateAccessToken tidak berlaku saat sesi masih kosong', () => {
    sessionStore.updateAccessToken('token', 900);
    expect(sessionStore.getSnapshot().accessToken).toBeNull();
  });

  it('clear mengosongkan sesi', () => {
    sessionStore.signIn('token', 900, { id: '01HXYZABC', username: 'admin', role: 'admin' });
    sessionStore.clear();
    expect(sessionStore.isAuthenticated()).toBe(false);
    expect(sessionStore.getSnapshot()).toEqual(EMPTY_SESSION);
  });

  it('signIn men-cache identitas user (non-token) ke sessionStorage', () => {
    const user: SessionUser = { id: '01HXYZABC', username: 'siti', role: 'reviewer' };
    sessionStore.signIn('token', 900, user);
    expect(restoreSessionUser()).toEqual(user);
  });

  it('clear menghapus cache identitas', () => {
    sessionStore.signIn('token', 900, { id: '01HXYZABC', username: 'siti', role: 'reviewer' });
    sessionStore.clear();
    expect(restoreSessionUser()).toBeNull();
  });

  it('subscribe memberi notifikasi saat state berubah, dan unsubscribe berhenti', () => {
    const seen: number[] = [];
    const unsubscribe = sessionStore.subscribe(() => seen.push(seen.length + 1));
    sessionStore.signIn('token', 900, { id: '01HXYZABC', username: 'admin', role: 'admin' });
    expect(seen.length).toBe(1);
    unsubscribe();
    sessionStore.clear();
    expect(seen.length).toBe(1);
  });
});

describe('userFromJwtClaims', () => {
  it('membangun user dari klaim sub + role', () => {
    const user = userFromJwtClaims({ sub: '01HXYZABC', role: 'editor' });
    expect(user).toEqual({ id: '01HXYZABC', username: '01HXYZABC', role: 'editor' });
  });

  it('menggunakan username dari cache identitas bila klaim tidak membawanya', () => {
    const user = userFromJwtClaims({ sub: '01HXYZABC', role: 'editor' }, { id: '01HXYZABC', username: 'budi', role: 'editor' });
    expect(user?.username).toBe('budi');
  });

  it('mengembalikan null tanpa sub (token bentuk tidak valid)', () => {
    expect(userFromJwtClaims({ role: 'admin' })).toBeNull();
  });
});