import { client } from '@/shared/api/client';
import type { ApiCursorPageEnvelope, ApiOkEnvelope, CursorPage } from '@/shared/api/types';
import type { SearchMissDirection } from '../domain/search-miss';

export interface SearchMissWire {
  id: string;
  term: string;
  direction: string;
  hit_count: number;
  is_fulfilled: boolean;
  is_visible: boolean;
  created_at: string;
}

export interface ListSearchMissesParams {
  q?: string;
  direction?: SearchMissDirection;
  fulfilled?: boolean;
  visible?: boolean;
  limit?: number;
  cursor?: string;
}

export interface UpdateSearchMissBody {
  term?: string;
  isVisible?: boolean;
}

/**
 * GET /api/v1/admin/search-misses - daftar pencarian yang 0 hasil (search miss).
 * Filter AND opsional: q lemma partial, direction, fulfilled, visible + cursor
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
      visible: params.visible,
      limit: params.limit ?? 20,
      cursor: params.cursor,
    },
    signal,
  });
  return { data: res.data.data, meta: res.data.meta };
}

/**
 * PATCH /api/v1/admin/search-misses/:id - koreksi term dan/atau toggle tayang
 * (14-api-search-miss-moderation.md).
 */
export async function updateSearchMissRequest(
  id: string,
  body: UpdateSearchMissBody,
  signal?: AbortSignal,
): Promise<SearchMissWire> {
  const payload: { term?: string; is_visible?: boolean } = {};
  if (body.term !== undefined) payload.term = body.term;
  if (body.isVisible !== undefined) payload.is_visible = body.isVisible;

  const res = await client.patch<{ success: true; data: SearchMissWire }>(
    `/admin/search-misses/${id}`,
    payload,
    { signal },
  );
  return res.data.data;
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

export type BulkDismissSearchMissItemSuccess = {
  id: string;
  ok: true;
};

export type BulkDismissSearchMissItemFailure = {
  id: string;
  ok: false;
  error_code: string;
  message: string;
};

export type BulkDismissSearchMissItemResult =
  | BulkDismissSearchMissItemSuccess
  | BulkDismissSearchMissItemFailure;

export type BulkDismissSearchMissResult = {
  succeeded: number;
  failed: number;
  results: BulkDismissSearchMissItemResult[];
};

/**
 * POST /api/v1/admin/search-misses/bulk-dismiss - soft-delete massal dari
 * checkbox panel Pencarian. Partial success per-id.
 */
export async function bulkDismissSearchMissesRequest(
  ids: string[],
  signal?: AbortSignal,
): Promise<BulkDismissSearchMissResult> {
  const res = await client.post<ApiOkEnvelope<BulkDismissSearchMissResult>>(
    '/admin/search-misses/bulk-dismiss',
    { ids },
    { signal },
  );
  return res.data.data;
}

export type ResolveSearchMissAction = 'variant' | 'synonym' | 'translation';

export interface ResolveSearchMissBody {
  action: ResolveSearchMissAction;
  wordId: string;
  meaningId?: string;
}

export interface ResolveSearchMissWire extends SearchMissWire {
  resolved_as: ResolveSearchMissAction;
  target_word_id: string;
  created_word_id: string | null;
  variant_id: string | null;
}

/**
 * POST /api/v1/admin/search-misses/:id/resolve - tempel miss ke kata existing
 * sebagai varian / sinonim / terjemahan.
 */
export async function resolveSearchMissRequest(
  id: string,
  body: ResolveSearchMissBody,
  signal?: AbortSignal,
): Promise<ResolveSearchMissWire> {
  const res = await client.post<{ success: true; data: ResolveSearchMissWire }>(
    `/admin/search-misses/${id}/resolve`,
    {
      action: body.action,
      word_id: body.wordId,
      meaning_id: body.meaningId,
    },
    { signal },
  );
  return res.data.data;
}
