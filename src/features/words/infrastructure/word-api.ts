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

export interface ImportWordPayload {
  lemma: string;
  verify: boolean;
  verified: boolean;
  notes?: string;
  meanings: { translation?: string; definition?: string; example?: string }[];
}

export interface ImportWordResultItem {
  lemma: string;
  outcome: 'created' | 'meanings_added' | 'skipped' | 'invalid';
  status?: 'draft' | 'published';
  is_verified?: boolean;
  meanings_added: number;
  meanings_skipped: number;
  message?: string;
}

export async function importWordsRequest(body: {
  mode: 'validate' | 'commit';
  items: ImportWordPayload[];
}): Promise<ImportWordResultItem[]> {
  const res = await client.post<ApiOkEnvelope<{ items: ImportWordResultItem[] }>>('/admin/words/import', body);
  return res.data.data.items;
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
export interface DuplicateWordItemDto {
  id: string;
  lemma: string;
  language_id: string;
  language_code: string;
  word_type: WordListItem['word_type'];
  status: WordListItem['status'];
  is_verified: boolean;
  meanings_count: number;
  created_at: string;
  suggested_keep: boolean;
}

export interface DuplicateWordGroupDto {
  lemma: string;
  language_id: string;
  language_code: string;
  default_keep_word_id: string;
  items: DuplicateWordItemDto[];
}

export async function listDuplicateWordsRequest(
  signal?: AbortSignal,
): Promise<{ total_groups: number; groups: DuplicateWordGroupDto[] }> {
  const res = await client.get<
    ApiOkEnvelope<{ total_groups: number; groups: DuplicateWordGroupDto[] }>
  >('/admin/words/duplicates', { signal });
  return res.data.data;
}

export async function mergeDuplicateWordsRequest(body: {
  keep_word_id: string;
  merge_word_ids: string[];
}): Promise<{ keep_word_id: string; merged_word_ids: string[] }> {
  const res = await client.post<
    ApiOkEnvelope<{ keep_word_id: string; merged_word_ids: string[] }>
  >('/admin/words/duplicates/merge', body);
  return res.data.data;
}

export interface CommaSplitLemmaDto {
  word_id: string;
  lemma: string;
  language_id: string;
  language_code: string;
  word_type: WordListItem['word_type'];
  status: WordListItem['status'];
  is_verified: boolean;
  meanings_count: number;
  suggested_parts: string[];
  meaning_preview: string[];
}

export interface CommaSplitTranslationDto {
  meaning_translation_id: string;
  meaning_id: string;
  word_id: string;
  lemma: string;
  translation_text: string;
  language_id: string;
  language_code: string;
  suggested_parts: string[];
  definition: string;
  word_class_id: string | null;
}

export async function listCommaSplitsRequest(
  signal?: AbortSignal,
): Promise<{
  total: number;
  lemmas: CommaSplitLemmaDto[];
  translations: CommaSplitTranslationDto[];
}> {
  const res = await client.get<
    ApiOkEnvelope<{
      total: number;
      lemmas: CommaSplitLemmaDto[];
      translations: CommaSplitTranslationDto[];
    }>
  >('/admin/words/comma-splits', { signal });
  return res.data.data;
}

export async function applyCommaSplitRequest(
  body:
    | { kind: 'lemma'; word_id: string; parts: string[] }
    | { kind: 'translation'; meaning_translation_id: string; parts: string[] },
): Promise<{
  kind: 'lemma' | 'translation';
  word_id: string;
  created_word_ids?: string[];
  meaning_ids?: string[];
}> {
  const res = await client.post<
    ApiOkEnvelope<{
      kind: 'lemma' | 'translation';
      word_id: string;
      created_word_ids?: string[];
      meaning_ids?: string[];
    }>
  >('/admin/words/comma-splits/apply', body);
  return res.data.data;
}

export async function markCommaLiteralRequest(
  body:
    | { kind: 'lemma'; word_id: string }
    | { kind: 'translation'; meaning_translation_id: string },
): Promise<{ kind: 'lemma' | 'translation'; id: string }> {
  const res = await client.post<
    ApiOkEnvelope<{ kind: 'lemma' | 'translation'; id: string }>
  >('/admin/words/comma-splits/mark-literal', body);
  return res.data.data;
}

