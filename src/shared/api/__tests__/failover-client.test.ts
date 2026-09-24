import { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { client } from '../client';
import { ColdHostGate } from '../cold-host-gate';
import { __configureFailoverForTests, activeTier, advanceTier } from '../failover';
import { decideFailoverStep } from '../failover-step';

const TIERS = ['https://t1.test/api/v1', 'https://t2.test/api/v1', 'https://t3.test/api/v1'] as const;

function ok(config: InternalAxiosRequestConfig) {
  return {
    data: { success: true, data: { ok: true } },
    status: 200,
    statusText: 'OK',
    headers: {},
    config,
  };
}

function down(config: InternalAxiosRequestConfig, status?: number, data?: unknown): AxiosError {
  const response =
    status === undefined
      ? undefined
      : { status, data, statusText: 'err', headers: {}, config };
  return new AxiosError('down', status ? 'ERR_BAD_RESPONSE' : 'ERR_NETWORK', config, null, response);
}

describe('decideFailoverStep', () => {
  it('request di host lama tidak menggeser pin', () => {
    expect(
      decideFailoverStep({
        replayable: true,
        replayed: false,
        failedOnActiveHost: false,
        hasNextTier: true,
      }),
    ).toEqual({ advance: false, retry: true });
  });
});

describe('ColdHostGate', () => {
  it('tidak melebihi dua slot', async () => {
    const gate = new ColdHostGate(2);
    await gate.acquire();
    await gate.acquire();
    let entered = false;
    const third = gate.acquire().then(() => {
      entered = true;
    });
    await Promise.resolve();
    expect(entered).toBe(false);
    gate.release();
    await third;
    expect(gate.inFlight).toBe(2);
    gate.release();
    gate.release();
    expect(gate.inFlight).toBe(0);
  });
});

describe('failover client', () => {
  const hosts: string[] = [];

  beforeEach(() => {
    hosts.length = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response(null, { status: 200 }))),
    );
    __configureFailoverForTests(TIERS);
    client.defaults.adapter = (async (config) => {
      hosts.push(config.baseURL ?? '');
      if ((config.baseURL ?? '').includes('t1.test')) throw down(config);
      return ok(config);
    }) satisfies AxiosAdapter;
  });

  it('gelombang GET yang gagal di tier 1 tidak meloncat ke tier 3', async () => {
    let entered = 0;
    let release: () => void = () => {};
    const hold = new Promise<void>((resolve) => {
      release = resolve;
    });
    let markReady: () => void = () => {};
    const ready = new Promise<void>((resolve) => {
      markReady = resolve;
    });

    client.defaults.adapter = (async (config) => {
      const host = config.baseURL ?? '';
      hosts.push(host);
      if (host.includes('t1.test')) {
        entered += 1;
        if (entered === 5) markReady();
        await hold;
        throw down(config);
      }
      return ok(config);
    }) satisfies AxiosAdapter;

    const pending = Promise.all(Array.from({ length: 5 }, (_, i) => client.get(`/words/${i}`)));
    await ready;
    release();
    await pending;

    expect(hosts.filter((host) => host.includes('t1.test'))).toHaveLength(5);
    expect(hosts.filter((host) => host.includes('t2.test'))).toHaveLength(5);
    expect(hosts.filter((host) => host.includes('t3.test'))).toHaveLength(0);
    expect(activeTier().index).toBe(1);
  });

  it('satu GET yang gagal di dua tier menggeser pin ke tier 3 tanpa menembaknya', async () => {
    client.defaults.adapter = (async (config) => {
      hosts.push(config.baseURL ?? '');
      throw down(config);
    }) satisfies AxiosAdapter;

    await expect(client.get('/words/1')).rejects.toBeTruthy();

    expect(hosts.map((host) => new URL(host).host)).toEqual(['t1.test', 't2.test']);
    expect(activeTier().index).toBe(2);
  });

  it('mutasi gagal bersamaan hanya naik satu tier dan tidak diulang', async () => {
    let entered = 0;
    let release: () => void = () => {};
    const hold = new Promise<void>((resolve) => {
      release = resolve;
    });
    let markReady: () => void = () => {};
    const ready = new Promise<void>((resolve) => {
      markReady = resolve;
    });

    client.defaults.adapter = (async (config) => {
      hosts.push(config.baseURL ?? '');
      entered += 1;
      if (entered === 5) markReady();
      await hold;
      throw down(config);
    }) satisfies AxiosAdapter;

    const pending = Promise.all(Array.from({ length: 5 }, () => client.post('/contributions', {}).catch(() => null)));
    await ready;
    release();
    await pending;

    expect(hosts.every((host) => host.includes('t1.test'))).toBe(true);
    expect(activeTier().index).toBe(1);
  });

  it('JSON 500 aplikasi tidak memindahkan tier', async () => {
    client.defaults.adapter = (async (config) => {
      throw down(config, 500, {
        success: false,
        error_code: 'INTERNAL_ERROR',
        message: 'bug',
        details: null,
      });
    }) satisfies AxiosAdapter;

    await expect(client.get('/words/1')).rejects.toBeTruthy();
    expect(activeTier().index).toBe(0);
  });

  it('batal tidak memindahkan tier', async () => {
    let release: () => void = () => {};
    const hold = new Promise<void>((resolve) => {
      release = resolve;
    });
    client.defaults.adapter = (async (config) => {
      await hold;
      return ok(config);
    }) satisfies AxiosAdapter;

    const controller = new AbortController();
    const pending = client.get('/words/1', { signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toBeTruthy();
    release();
    expect(activeTier().index).toBe(0);
  });

  it('tier 3 membatasi dua request bersamaan', async () => {
    advanceTier();
    advanceTier();
    expect(activeTier().index).toBe(2);

    let current = 0;
    let max = 0;
    client.defaults.adapter = (async (config) => {
      current += 1;
      max = Math.max(max, current);
      await new Promise((resolve) => setTimeout(resolve, 30));
      current -= 1;
      return ok(config);
    }) satisfies AxiosAdapter;

    await Promise.all(Array.from({ length: 5 }, (_, i) => client.get(`/words/${i}`)));
    expect(max).toBe(2);
  });

  it('tier 1 tidak membatasi konkurensi', async () => {
    let current = 0;
    let max = 0;
    client.defaults.adapter = (async (config) => {
      current += 1;
      max = Math.max(max, current);
      await new Promise((resolve) => setTimeout(resolve, 20));
      current -= 1;
      return ok(config);
    }) satisfies AxiosAdapter;

    await Promise.all(Array.from({ length: 6 }, (_, i) => client.get(`/words/${i}`)));
    expect(max).toBe(6);
  });

  it('warm-up tier berikutnya dibatasi dan bisa dibatalkan', async () => {
    const signals: AbortSignal[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init?: RequestInit) => {
        if (init?.signal) signals.push(init.signal);
        return new Promise((_resolve, reject) => {
          const abort = () => reject(new DOMException('aborted', 'AbortError'));
          if (init?.signal?.aborted) abort();
          else init?.signal?.addEventListener('abort', abort, { once: true });
        });
      }),
    );

    advanceTier();
    expect(signals).toHaveLength(1);
    expect(String(vi.mocked(fetch).mock.calls[0]?.[0])).toBe('https://t3.test/health');
    expect(signals[0]?.aborted).toBe(false);

    __configureFailoverForTests(TIERS);
    expect(signals[0]?.aborted).toBe(true);
  });
});
