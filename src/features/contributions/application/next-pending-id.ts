/**
 * Id yang harus dipilih setelah `decidedId` diputus.
 * `ids` = urutan antrean SEBELUM item dihapus dari cache.
 */
export function nextPendingId(ids: string[], decidedId: string): string | null {
  const index = ids.indexOf(decidedId);
  if (index < 0) return ids[0] ?? null;
  if (index + 1 < ids.length) return ids[index + 1]!;
  return null;
}

/**
 * Navigasi keyboard j/k di antrean. Tetap di ujung bila sudah di batas.
 */
export function adjacentPendingId(
  ids: string[],
  currentId: string | undefined,
  direction: 1 | -1,
): string | null {
  if (ids.length === 0) return null;
  if (!currentId) return direction === 1 ? ids[0]! : ids[ids.length - 1]!;
  const index = ids.indexOf(currentId);
  if (index < 0) return ids[0]!;
  const next = index + direction;
  if (next < 0 || next >= ids.length) return currentId;
  return ids[next]!;
}
