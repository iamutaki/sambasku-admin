import { client } from '@/shared/api/client';
import type { ApiCursorPageEnvelope, ApiOkEnvelope, CursorPage } from '@/shared/api/types';
import type { BlocklistWordItem, BulkBlocklistResult } from '../domain/blocklist-word';

const BULK_CHUNK = 2000;

export async function listBlocklistRequest(
  params: { limit?: number; cursor?: string; q?: string },
  signal?: AbortSignal,
): Promise<CursorPage<BlocklistWordItem>> {
  const res = await client.get<ApiCursorPageEnvelope<BlocklistWordItem>>('/admin/comment-blocklist', {
    params: { limit: params.limit ?? 50, cursor: params.cursor, q: params.q || undefined },
    signal,
  });
  return { data: res.data.data, meta: res.data.meta };
}

/** Satu permintaan maksimal 2000 kata. File besar dipecah berurutan. */
export async function bulkCreateBlocklistRequest(words: string[]): Promise<BulkBlocklistResult> {
  const total: BulkBlocklistResult = { created_count: 0, skipped_count: 0, invalid_count: 0 };
  for (let i = 0; i < words.length; i += BULK_CHUNK) {
    const res = await client.post<ApiOkEnvelope<BulkBlocklistResult>>('/admin/comment-blocklist/bulk', {
      words: words.slice(i, i + BULK_CHUNK),
    });
    total.created_count += res.data.data.created_count;
    total.skipped_count += res.data.data.skipped_count;
    total.invalid_count += res.data.data.invalid_count;
  }
  return total;
}

export async function deleteBlocklistRequest(id: string): Promise<void> {
  await client.delete(`/admin/comment-blocklist/${id}`);
}
