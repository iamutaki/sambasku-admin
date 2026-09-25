/** Alfabet Crockford Base32 (ULID) — 26 karakter, cocok `opaqueId` API. */
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/**
 * ID opaque 26 karakter (time + random), mirip ULID.
 * Dipakai client untuk session id yang dikirim ke API.
 */
export function generateOpaqueId(): string {
  let time = Date.now();
  let out = '';
  for (let i = 0; i < 10; i += 1) {
    out = CROCKFORD[time % 32]! + out;
    time = Math.floor(time / 32);
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < 16; i += 1) {
    out += CROCKFORD[bytes[i]! % 32]!;
  }
  return out;
}
