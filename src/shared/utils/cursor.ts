import type { CursorMeta } from '@/shared/api/types';

/**
 * Helper cursor-based pagination (docs/api Section 13).
 *
 * `meta` dari response list:
 * - `has_more: true`  → masih ada halaman berikutnya; page param = `next_cursor`
 * - `has_more: false` → halaman terakhir; berhenti (tidak perlu cursor)
 *
 * Dipakai `useCursorList` (getNextPageParam) - sebagai fungsi murni agar
 * mudah di-unit-test tanpa React.
 */
export function getNextCursor(meta: CursorMeta): string | undefined {
  return meta.has_more ? (meta.next_cursor ?? undefined) : undefined;
}