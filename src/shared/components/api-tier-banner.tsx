import { useSyncExternalStore } from 'react';
import { Alert } from 'antd';
import { activeTierSnapshot, apiTiers, hasFallbacks, subscribeTier } from '@/shared/api/failover';

/**
 * Pemberitahuan saat console TIDAK sedang memakai tier 1.
 *
 * Tanpa ini failover benar-benar tak terlihat - bagus untuk pengguna biasa, buruk
 * untuk admin: request bisa terasa jauh lebih lambat (tier terakhir bisa perlu
 * ~60 detik untuk bangun) tanpa penjelasan apa pun.
 */
export function ApiTierBanner() {
  const tier = useSyncExternalStore(subscribeTier, activeTierSnapshot, activeTierSnapshot);

  if (!hasFallbacks() || tier.index === 0) return null;

  const isLast = tier.index === apiTiers.length - 1;

  return (
    <Alert
      type={isLast ? 'warning' : 'info'}
      showIcon
      banner
      message={`API utama sedang bermasalah - memakai server cadangan (tier ${tier.index + 1}).`}
      description={
        isLast
          ? 'Ini cadangan terakhir dan biasanya perlu dinyalakan dulu, jadi permintaan pertama bisa memakan waktu hingga satu menit. Tier utama dicoba lagi otomatis dalam 5 menit.'
          : 'Tier utama dicoba lagi otomatis dalam 5 menit. Tidak perlu masuk ulang.'
      }
    />
  );
}
