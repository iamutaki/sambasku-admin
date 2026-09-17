/**
 * Bentuk response standar API (docs/api/api-base-stack.md Section 13).
 * Semua endpoint wajib membungkus response dalam envelope berikut.
 */

export interface ApiOkEnvelope<T> {
  success: true;
  data: T;
}

export interface ApiFieldError {
  field: string;
  message: string;
}

export interface ApiErrorEnvelope {
  success: false;
  error_code: string;
  message: string;
  details: ApiFieldError[] | null;
}

/**
 * Pagination cursor (Section 13 pagination) - dipakai semua endpoint list.
 * `cursor` = ULID `id` item terakhir halaman sebelumnya; `has_more: false`
 * berarti halaman terakhir.
 */
export interface CursorMeta {
  limit: number;
  next_cursor: string | null;
  has_more: boolean;
}

/**
 * Envelope list ber-pagination (docs/api/api-base-stack.md Section 13):
 * `meta` SEBLAHAN `data` di level envelope, bukan bersarang di dalamnya -
 * i.e. `{ success, data: [...], meta: {...} }`.
 */
export interface ApiCursorPageEnvelope<T> extends ApiOkEnvelope<T[]> {
  meta: CursorMeta;
}

/** Bentuk internal halaman list setelah di-normalisasi (lihat tiap `*-api.ts`). */
export interface CursorPage<T> {
  data: T[];
  meta: CursorMeta;
}