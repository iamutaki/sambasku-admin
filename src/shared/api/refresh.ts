/**
 * Single-flight helper untuk refresh token.
 *
 * Ketika banyak request 401 secara bersamaan (mis. parall page load),
 * hanya SATU refresh yang dikirim ke backend - sisanya menunggu hasil yang
 * sama lalu retry dengan token baru. Mencegah rotasi refresh token
 * dieksekusi dua kali (rotasi kedua dengan cookie yang sudah terpakai = 401).
 */
export function refreshAccessTokenSingleFlight(refresh: () => Promise<string>): Promise<string> {
  if (!inFlight) {
    inFlight = refresh().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

let inFlight: Promise<string> | null = null;