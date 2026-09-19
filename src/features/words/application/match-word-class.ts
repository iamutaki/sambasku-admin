import type { WordClassOption } from '../domain/create-word';

/**
 * Petakan hint kelas kata dari KBBI ke ULID word_classes kita.
 * Best-effort: code → name; KBBI sering pakai `a` untuk adjektiva (seed: `adj`).
 */
export function matchWordClassId(
  classes: WordClassOption[],
  code: string | null | undefined,
  label: string | null | undefined,
): string | undefined {
  const normalizedCode = code?.trim().toLowerCase();
  if (normalizedCode) {
    const byCode = classes.find((c) => c.code.toLowerCase() === normalizedCode);
    if (byCode) return byCode.id;
    if (normalizedCode === 'a') {
      const adj = classes.find((c) => c.code.toLowerCase() === 'adj');
      if (adj) return adj.id;
    }
  }

  const normalizedLabel = label?.trim().toLowerCase();
  if (normalizedLabel) {
    const byName = classes.find((c) => c.name.toLowerCase() === normalizedLabel);
    if (byName) return byName.id;
  }

  return undefined;
}
