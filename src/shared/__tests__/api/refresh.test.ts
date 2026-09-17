import { describe, it, expect } from 'vitest';
import { refreshAccessTokenSingleFlight } from '@/shared/api/refresh';

describe('refreshAccessTokenSingleFlight', () => {
  it('hanya mengeksekusi SATU refresh untuk banyak pemanggil konkuren', async () => {
    let calls = 0;
    let resolve!: (token: string) => void;

    const refresh = () => {
      calls += 1;
      return new Promise<string>((res) => {
        resolve = res;
      });
    };

    const p1 = refreshAccessTokenSingleFlight(refresh);
    const p2 = refreshAccessTokenSingleFlight(refresh);
    const p3 = refreshAccessTokenSingleFlight(refresh);

    // Semua panggilan berbagi promise yang sama — refresh baru dieksekusi sekali.
    expect(calls).toBe(1);

    resolve('new-access-token');
    await expect(p1).resolves.toBe('new-access-token');
    await expect(p2).resolves.toBe('new-access-token');
    await expect(p3).resolves.toBe('new-access-token');
  });

  it('refresh berikutnya bisa dijalankan lagi setelah yang pertama selesai (gagal)', async () => {
    let calls = 0;
    const refresh = () => {
      calls += 1;
      return Promise.reject(new Error('refresh gagal'));
    };

    await expect(refreshAccessTokenSingleFlight(refresh)).rejects.toThrow('refresh gagal');
    await expect(refreshAccessTokenSingleFlight(refresh)).rejects.toThrow('refresh gagal');
    expect(calls).toBe(2);
  });
});