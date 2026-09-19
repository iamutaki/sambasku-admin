import { describe, it, expect } from 'vitest';
import { decodeJwtClaims } from '@/shared/utils/jwt';

// base64url (RFC 4648) tanpa Buffer - TextEncoder + btoa (tersedia di Node 20+).
function b64url(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

describe('decodeJwtClaims', () => {
  it('mendecode payload JWT (bagian tengah) tanpa verifikasi signature', () => {
    const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const payload = b64url(JSON.stringify({ sub: '01HXYZABC', role: 'admin', username: 'siti' }));
    const signature = b64url('sig');

    const claims = decodeJwtClaims(`${header}.${payload}.${signature}`);
    expect(claims.sub).toBe('01HXYZABC');
    expect(claims.role).toBe('admin');
    expect(claims.username).toBe('siti');
  });

  it('mendecode payload berisi karakter utf8 (mis. nama user)', () => {
    const payload = b64url(JSON.stringify({ sub: '01HXYZABC', username: 'joko' }));
    const claims = decodeJwtClaims(`${b64url('{}')}.${payload}.${b64url('sig')}`);
    expect(claims.username).toBe('joko');
  });

  it('melempar pada token yang bukan 3 bagian', () => {
    expect(() => decodeJwtClaims('hanya.satu.titik.di.sini')).toThrow('INVALID_TOKEN_FORMAT');
    expect(() => decodeJwtClaims('tanpa-titik')).toThrow('INVALID_TOKEN_FORMAT');
  });
});