import { client } from '@/shared/api/client';
import type { ApiCursorPageEnvelope, ApiOkEnvelope, CursorPage } from '@/shared/api/types';
import type { ListWordsParams, WordListItem } from '../domain/word';
import type { CreateWordRequest, CreateWordResult } from '../domain/create-word';
import type { UpdateWordRequest, UpdateWordResult, WordDetail } from '../domain/word-detail';

/**
 * GET /api/v1/words/search - list/penelusuran kata (cursor pagination,
 * docs/api Section 13). Backend membungkus `meta` SEBLAHAN `data` di level
 * envelope (`{ success, data: [...], meta }`) - di-normalisasi jadi
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
 * POST /api/v1/admin/words - tambah kata baru lengkap (transaksional).
 * Auth+role (admin/editor/contributor/root/reviewer) + rate limit 30/menit
 * ditangani backend; status akhir per-role ditentukan server (approval gate).
 */
export async function createWordRequest(body: CreateWordRequest): Promise<CreateWordResult> {
  const res = await client.post<ApiOkEnvelope<CreateWordResult>>('/admin/words', body);
  return res.data.data;
}

/**
 * GET /api/v1/admin/words/:id - detail pribadi admin untuk prefill form edit.
 * Bedanya dari GET publik: status SEMUA boleh tampil (draft/pending_review/
 * rejected/published) dan anak ikut semua status (prefill jujur).
 * Auth+role (admin/editor/root/reviewer) ditangani backend.
 */
export async function getAdminWordDetailRequest(id: string, signal?: AbortSignal): Promise<WordDetail> {
  const res = await client.get<ApiOkEnvelope<WordDetail>>(`/admin/words/${id}`, { signal });
  return res.data.data;
}

/**
 * PUT /api/v1/admin/words/:id - edit kata FULL REPLACE (bukan PATCH): seluruh
 * children di-replace dalam satu transaksi; field yang tidak dikirim dihapus.
 * Body = bentuk create dengan related_words Form A saja (Form B ditolak backend).
 */
export async function updateWordRequest(
  id: string,
  body: UpdateWordRequest,
): Promise<UpdateWordResult> {
  const res = await client.put<ApiOkEnvelope<UpdateWordResult>>(`/admin/words/${id}`, body);
  return res.data.data;
}

/**
 * DELETE /api/v1/admin/words/:id - soft-delete kata (07-api-delete-kata.md).
 * Set deleted_at+deleted_by di backend: baris dipertahankan untuk audit/
 * recovery, tapi hilang dari semua query publik & admin. Idempotent di sisi
 * user: delete kata yang sudah dihapus → backend 404 WORD_NOT_FOUND.
 * Auth+role (admin/editor/root/reviewer) ditangani backend.
 */
export async function deleteWordRequest(id: string): Promise<void> {
  await client.delete<ApiOkEnvelope<null>>(`/admin/words/${id}`);
}

/**
 * POST /api/v1/admin/words/:id/verify - tandai kata sebagai verified
 * (status berubah jadi published; audit log otomatis di backend).
 * Role: admin / root / reviewer.
 */
export async function verifyWordRequest(id: string, signal?: AbortSignal): Promise<unknown> {
  const res = await client.post<ApiOkEnvelope<unknown>>(`/admin/words/${id}/verify`, undefined, { signal });
  return res.data.data;
}

/**
 * POST /api/v1/admin/words/:id/unverify - batalkan verified (kembali ke
 * pending_review / status sebelumnya non-published). Audit log otomatis.
 * Role: admin / root / reviewer.
 */
export async function unverifyWordRequest(id: string, signal?: AbortSignal): Promise<unknown> {
  const res = await client.post<ApiOkEnvelope<unknown>>(`/admin/words/${id}/unverify`, undefined, { signal });
  return res.data.data;
}