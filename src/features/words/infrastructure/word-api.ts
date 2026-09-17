import { client } from '@/shared/api/client';
import type { ApiCursorPageEnvelope, ApiOkEnvelope, CursorPage } from '@/shared/api/types';
import type { ListWordsParams, WordListItem } from '../domain/word';
import type { CreateWordRequest, CreateWordResult } from '../domain/create-word';

/**
 * GET /api/v1/words/search — list/penelusuran kata (cursor pagination,
 * docs/api Section 13). Backend membungkus `meta` SEBLAHAN `data` di level
 * envelope (`{ success, data: [...], meta }`) — di-normalisasi jadi
 * `CursorPage` agar `useCursorList` membaca `page.data` / `page.meta`.
 * Query param yang tidak diisi otomatis dihilangkan (undefined tidak
 * diserialisasi axios).
 */
export async function listWordsRequest(
  params: ListWordsParams,
  signal?: AbortSignal,
): Promise<CursorPage<WordListItem>> {
  const res = await client.get<ApiCursorPageEnvelope<WordListItem>>('/words/search', {
    params: {
      q: params.q || undefined,
      word_type: params.wordType,
      is_verified: params.isVerified,
      limit: params.limit ?? 20,
      cursor: params.cursor,
    },
    signal,
  });
  return { data: res.data.data, meta: res.data.meta };
}

/**
 * POST /api/v1/admin/words — tambah kata baru lengkap (transaksional).
 * Auth+role (admin/editor/contributor/root/reviewer) + rate limit 30/menit
 * ditangani backend; status akhir per-role ditentukan server (approval gate).
 */
export async function createWordRequest(body: CreateWordRequest): Promise<CreateWordResult> {
  const res = await client.post<ApiOkEnvelope<CreateWordResult>>('/admin/words', body);
  return res.data.data;
}