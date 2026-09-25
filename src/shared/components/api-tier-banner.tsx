import { useSyncExternalStore } from 'react';
import { Alert } from 'antd';
import {
  activeTierSnapshot,
  apiTiers,
  getForcedTierIndex,
  hasFallbacks,
  subscribeTier,
} from '@/shared/api/failover';

function forcedSnapshot(): number | null {
  return getForcedTierIndex();
}

/**
 * Pemberitahuan saat console TIDAK sedang memakai tier 1.
 *
 * Tanpa ini failover benar-benar tak terlihat - bagus untuk pengguna biasa, buruk
 * untuk admin: request bisa terasa jauh lebih lambat (tier terakhir bisa perlu
 * ~60 detik untuk bangun) tanpa penjelasan apa pun.
 */
export function ApiTierBanner() {
  const tier = useSyncExternalStore(subscribeTier, activeTierSnapshot, activeTierSnapshot);
  const forced = useSyncExternalStore(subscribeTier, forcedSnapshot, forcedSnapshot);

  if (!hasFallbacks() || tier.index === 0) return null;

  const isLast = tier.index === apiTiers.length - 1;
  const isForced = forced !== null;

  if (isForced) {
    return (
      <div className="api-tier-banner">
        <Alert
          type={isLast ? 'warning' : 'info'}
          showIcon
          banner
          message={`Memakai Tier ${tier.index + 1} (paksa admin).`}
          description={
            isLast
              ? 'Host ini biasanya perlu dinyalakan dulu, jadi permintaan pertama bisa memakan waktu hingga satu menit. Failover otomatis dinonaktifkan selama paksa aktif.'
              : 'Failover otomatis dinonaktifkan selama paksa aktif. Pilih Otomatis di switcher API untuk mengembalikan circuit breaker.'
          }
        />
      </div>
    );
  }

  return (
    <div className="api-tier-banner">
      <Alert
        type={isLast ? 'warning' : 'info'}
        showIcon
        banner
        message={`API utama sedang bermasalah - memakai server cadangan (Tier ${tier.index + 1}).`}
        description={
          isLast
            ? 'Ini cadangan terakhir dan biasanya perlu dinyalakan dulu, jadi permintaan pertama bisa memakan waktu hingga satu menit. Tier utama dicoba lagi otomatis dalam 5 menit.'
            : 'Tier utama dicoba lagi otomatis dalam 5 menit. Tidak perlu masuk ulang.'
        }
      />
    </div>
  );
}
