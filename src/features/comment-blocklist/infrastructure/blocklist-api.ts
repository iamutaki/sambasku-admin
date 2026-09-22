import { client } from '@/shared/api/client';
import type { ApiCursorPageEnvelope, ApiOkEnvelope, CursorPage } from '@/shared/api/types';
import type { BlocklistWordItem } from '../domain/blocklist-word';

export async function listBlocklistRequest(
  params: { limit?: number; cursor?: string },
  signal?: AbortSignal,
): Promise<CursorPage<BlocklistWordItem>> {
  const res = await client.get<ApiCursorPageEnvelope<BlocklistWordItem>>('/admin/comment-blocklist', {
    params: { limit: params.limit ?? 50, cursor: params.cursor },
    signal,
  });
  return { data: res.data.data, meta: res.data.meta };
}

export async function createBlocklistRequest(word: string): Promise<BlocklistWordItem> {
  const res = await client.post<ApiOkEnvelope<BlocklistWordItem>>('/admin/comment-blocklist', { word });
  return res.data.data;
}

export async function deleteBlocklistRequest(id: string): Promise<void> {
  await client.delete(`/admin/comment-blocklist/${id}`);
}
