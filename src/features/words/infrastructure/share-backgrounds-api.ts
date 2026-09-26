import { client } from '@/shared/api/client';
import type { ApiOkEnvelope } from '@/shared/api/types';

export const STOCK_PHOTO_PROVIDERS = [
  'pixabay',
  'openverse',
  'unsplash',
] as const;

export type StockPhotoProvider = (typeof STOCK_PHOTO_PROVIDERS)[number];

export const STOCK_PROVIDER_LABELS: Record<StockPhotoProvider, string> = {
  pixabay: 'Pixabay',
  openverse: 'Openverse',
  unsplash: 'Unsplash',
};

export interface ShareBackgroundItem {
  id: string;
  url: string;
  preview_url: string;
  photographer: string;
  username: string;
  attribution_url: string;
  provider: StockPhotoProvider;
  kind: 'photo' | 'video';
  width: number;
  height: number;
}

export interface ListShareBackgroundsResult {
  provider: string;
  page: number;
  degraded: boolean;
  items: ShareBackgroundItem[];
}

export async function listShareBackgrounds(params: {
  q?: string;
  page?: number;
  sort?: 'relevant' | 'popular';
  provider?: StockPhotoProvider;
  limit?: number;
  signal?: AbortSignal;
}): Promise<ListShareBackgroundsResult> {
  const sort = params.sort ?? (params.q?.trim() ? 'relevant' : 'popular');
  const res = await client.get<
    ApiOkEnvelope<{
      provider: string;
      page: number;
      degraded: boolean;
      media: string;
      items: ShareBackgroundItem[];
    }>
  >('/share/backgrounds', {
    params: {
      ...(params.q?.trim() ? { q: params.q.trim() } : {}),
      page: params.page ?? 1,
      sort,
      provider: params.provider ?? 'pixabay',
      limit: params.limit ?? 12,
      media: 'photo',
    },
    signal: params.signal,
  });
  const data = res.data.data;
  return {
    provider: data.provider,
    page: data.page,
    degraded: data.degraded,
    items: (data.items ?? []).filter((i) => i.kind !== 'video'),
  };
}
