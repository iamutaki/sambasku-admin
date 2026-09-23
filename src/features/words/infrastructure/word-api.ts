import { client } from '@/shared/api/client';
import type { ApiCursorPageEnvelope, ApiOkEnvelope, CursorPage } from '@/shared/api/types';
import type { ListWordsParams, TakedownReasonCode, WordListItem } from '../domain/word';
import type { CreateWordRequest, CreateWordResult } from '../domain/create-word';
import type { UpdateWordRequest, UpdateWordResult, WordDetail } from '../domain/word-detail';

/**
 * GET /api/v1/admin/words - list panel Kata (semua status + filter tayang).
 * Bukan /words/search publik (yang hanya published + bisa catat search miss).
 */
export async function listWordsRequest(
  params: ListWordsParams,
  signal?: AbortSignal,
): Promise<CursorPage<WordListItem>> {
  const res = await client.get<ApiCursorPageEnvelope<WordListItem>>('/admin/words', {
    params: {
      q: params.q || undefined,
      word_type: params.wordType,
      is_verified: params.isVerified,
      published: params.published,
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

/**
 * POST /api/v1/admin/words/:id/publish - tayangkan kata (status → published).
 * Role: admin / root / reviewer.
 */
export async function publishWordRequest(
  id: string,
  signal?: AbortSignal,
): Promise<{ word_id: string; merged_into_word_id: string | null }> {
  const res = await client.post<
    ApiOkEnvelope<{ word_id: string; merged_into_word_id: string | null }>
  >(`/admin/words/${id}/publish`, undefined, { signal });
  return res.data.data;
}

/**
 * POST /api/v1/admin/words/:id/unpublish - tarik dari tayang (status → draft).
 * Role: admin / root / reviewer.
 */
export async function unpublishWordRequest(id: string, signal?: AbortSignal): Promise<unknown> {
  const res = await client.post<ApiOkEnvelope<unknown>>(`/admin/words/${id}/unpublish`, undefined, { signal });
  return res.data.data;
}

export async function takedownWordRequest(
  id: string,
  body: { reason_code: TakedownReasonCode; note?: string },
): Promise<void> {
  await client.post(`/admin/words/${id}/takedown`, body);
}

export async function restoreWordRequest(id: string): Promise<void> {
  await client.post(`/admin/words/${id}/restore`);
}