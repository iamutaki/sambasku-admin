import { useMemo, useSyncExternalStore } from 'react';
import { Segmented, Tooltip, Typography } from 'antd';
import {
  activeTierSnapshot,
  apiTiers,
  getForcedTierIndex,
  hasFallbacks,
  setForcedTier,
  subscribeTier,
} from '@/shared/api/failover';

function hostnameOf(baseUrl: string): string {
  try {
    const base = typeof window === 'undefined' ? 'https://placeholder.invalid' : window.location.origin;
    return new URL(baseUrl, base).host;
  } catch {
    return baseUrl;
  }
}

function forcedSnapshot(): number | null {
  return getForcedTierIndex();
}

/**
 * Switcher preset API host untuk root/admin.
 * Auto = circuit breaker; Tier N = paksa host dari env (tanpa cascade).
 */
export function ApiHostSwitcher() {
  const tier = useSyncExternalStore(subscribeTier, activeTierSnapshot, activeTierSnapshot);
  const forced = useSyncExternalStore(subscribeTier, forcedSnapshot, forcedSnapshot);

  const options = useMemo(
    () => [
      { label: 'Otomatis', value: 'auto' },
      ...apiTiers.map((t) => ({
        label: (
          <Tooltip title={hostnameOf(t.baseUrl)}>
            <span>Tier {t.index + 1}</span>
          </Tooltip>
        ),
        value: String(t.index),
      })),
    ],
    // apiTiers diganti hanya di tes via __configureFailoverForTests
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [apiTiers.length],
  );

  const value = forced === null ? 'auto' : String(forced);
  const singleHost = !hasFallbacks();
  const activeHost = hostnameOf(tier.baseUrl);

  return (
    <Tooltip title={singleHost ? `API: ${activeHost}` : undefined}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <Typography.Text type="secondary" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
          API
        </Typography.Text>
        <Segmented
          size="small"
          disabled={singleHost}
          value={value}
          options={options}
          onChange={(next) => {
            if (next === 'auto') setForcedTier(null);
            else setForcedTier(Number(next));
          }}
        />
      </span>
    </Tooltip>
  );
}
