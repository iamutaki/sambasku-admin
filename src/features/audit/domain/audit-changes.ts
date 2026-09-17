/**
 * Helper murni untuk menampilkan `old_data`/`new_data` audit secara manusiawi
 * (dipakai `AuditChangesCell`). Dipisah dari komponen supaya bisa diuji di
 * environment node (lihat __tests__/unit/audit-changes.test.ts).
 */

/** Satu field yang berubah antara old_data dan new_data. */
export interface AuditChange {
  key: string;
  before: unknown;
  after: unknown;
  /** Field ada di sisi before/after - membedakan create / delete / update. */
  hasBefore: boolean;
  hasAfter: boolean;
}

/**
 * Serialisasi stabil: key objek diurutkan, sehingga dua objek dengan isi sama
 * tapi urutan key berbeda tidak dianggap "berubah".
 */
export function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, val: unknown) => {
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      const obj = val as Record<string, unknown>;
      return Object.keys(obj)
        .sort()
        .reduce<Record<string, unknown>>((acc, k) => {
          acc[k] = obj[k];
          return acc;
        }, {});
    }
    return val;
  });
}

/**
 * Daftar field yang berbeda antara `old_data` & `new_data`, urut nama field:
 * - create → old_data null  → semua field new_data (hasBefore: false)
 * - delete → new_data null  → semua field old_data (hasAfter: false)
 * - update → hanya field yang nilainya benar-benar berubah
 */
export function diffChanges(
  oldData: Record<string, unknown> | null,
  newData: Record<string, unknown> | null,
): AuditChange[] {
  const before = oldData ?? {};
  const after = newData ?? {};
  const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)])).sort();

  const changes: AuditChange[] = [];
  for (const key of keys) {
    const hasBefore = Object.prototype.hasOwnProperty.call(before, key);
    const hasAfter = Object.prototype.hasOwnProperty.call(after, key);
    if (hasBefore && hasAfter && stableStringify(before[key]) === stableStringify(after[key])) continue;
    changes.push({ key, before: before[key], after: after[key], hasBefore, hasAfter });
  }
  return changes;
}

/** Nilai → teks ringkas (objek/array jadi JSON satu baris, stabil). */
export function formatValue(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return stableStringify(value);
}
