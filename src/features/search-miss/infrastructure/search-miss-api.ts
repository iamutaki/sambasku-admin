import { client } from '@/shared/api/client';
import type { ApiCursorPageEnvelope, CursorPage } from '@/shared/api/types';
import type { SearchMissDirection } from '../domain/search-miss';

export interface SearchMissWire {
  id: string;
  term: string;
  direction: string;
  hit_count: number;
  is_fulfilled: boolean;
  created_at: string;
}

export interface ListSearchMissesParams {
  q?: string;
  direction?: SearchMissDirection;
  fulfilled?: boolean;
  limit?: number;
  cursor?: string;
}

/**
 * GET /api/v1/admin/search-misses - daftar pencarian yang 0 hasil (search miss).
 * Filter AND opsional: q lemma partial, direction, fulfilled + cursor
 * pagination. Bentuk backend envelope → dinormalisasi ke CursorPage.
 */
export async function listSearchMissesRequest(
  params: ListSearchMissesParams,
  signal?: AbortSignal,
): Promise<CursorPage<SearchMissWire>> {
  const res = await client.get<ApiCursorPageEnvelope<SearchMissWire>>('/admin/search-misses', {
    params: {
      q: params.q || undefined,
      direction: params.direction,
      fulfilled: params.fulfilled,
      limit: params.limit ?? 20,
      cursor: params.cursor,
    },
    signal,
  });
  return { data: res.data.data, meta: res.data.meta };
}

/**
 * POST /api/v1/admin/search-misses/:id/dismiss - soft-delete 1 search miss
 * (spam / tidak relevan / tidak layak dijadikan kata).
 */
export async function dismissSearchMissRequest(id: string, signal?: AbortSignal): Promise<unknown> {
  const res = await client.post<ApiCursorPageEnvelope<unknown>>(`/admin/search-misses/${id}/dismiss`, undefined, {
    signal,
  });
  return res.data.data;
}
