/** Decode klaim JWT (tanpa verifikasi signature — token dianggap valid karena
 * baru diterima dari API kita sendiri). Hanya dipakai untuk restore session
 * (sub/role) setelah hard reload. */

export interface JwtClaims {
  sub?: string;
  role?: string;
  username?: string;
  [claim: string]: unknown;
}

export function decodeJwtClaims(token: string): JwtClaims {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('INVALID_TOKEN_FORMAT');
  const payloadJson = base64UrlDecode(parts[1]);
  return JSON.parse(payloadJson) as JwtClaims;
}

function base64UrlDecode(encoded: string): string {
  const b64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64.padEnd(Math.ceil(b64.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}