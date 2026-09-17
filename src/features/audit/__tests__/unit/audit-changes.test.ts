import { describe, expect, it } from 'vitest';
import { diffChanges, formatValue, stableStringify } from '@/features/audit/domain/audit-changes';

describe('diffChanges', () => {
  it('create: old_data null → semua field new_data (hasBefore false)', () => {
    const changes = diffChanges(null, { lemma: 'makatn', status: 'published' });
    expect(changes.map((c) => c.key)).toEqual(['lemma', 'status']);
    expect(changes.every((c) => !c.hasBefore && c.hasAfter)).toBe(true);
  });

  it('delete: new_data null → semua field old_data (hasAfter false)', () => {
    const changes = diffChanges({ lemma: 'makatn' }, null);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ key: 'lemma', before: 'makatn', hasBefore: true, hasAfter: false });
  });

  it('update: hanya field yang nilainya berubah', () => {
    const changes = diffChanges({ lemma: 'makatn', status: 'draft' }, { lemma: 'makatn', status: 'published' });
    expect(changes.map((c) => c.key)).toEqual(['status']);
    expect(changes[0]).toMatchObject({ before: 'draft', after: 'published', hasBefore: true, hasAfter: true });
  });

  it('deteksi field yang ditambah/dihapus (key tidak ada di salah satu sisi)', () => {
    const changes = diffChanges({ a: 1 }, { a: 1, b: 2 });
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ key: 'b', hasBefore: false, hasAfter: true, after: 2 });
  });

  it('objek dengan isi sama tapi urutan key berbeda TIDAK dianggap berubah', () => {
    const changes = diffChanges({ meta: { a: 1, b: 2 } }, { meta: { b: 2, a: 1 } });
    expect(changes).toHaveLength(0);
  });

  it('kedua sisi kosong → tanpa perubahan', () => {
    expect(diffChanges({}, {})).toHaveLength(0);
    expect(diffChanges(null, null)).toHaveLength(0);
  });
});

describe('formatValue', () => {
  it('meringkas tipe primitif', () => {
    expect(formatValue(null)).toBe('null');
    expect(formatValue(undefined)).toBe('null');
    expect(formatValue('teks')).toBe('teks');
    expect(formatValue(42)).toBe('42');
    expect(formatValue(true)).toBe('true');
  });

  it('objek jadi JSON satu baris dengan key terurut', () => {
    expect(formatValue({ b: 2, a: 1 })).toBe('{"a":1,"b":2}');
  });
});

describe('stableStringify', () => {
  it('mengurutkan key bersarang secara rekursif', () => {
    expect(stableStringify({ b: { d: 4, c: 3 }, a: 1 })).toBe('{"a":1,"b":{"c":3,"d":4}}');
  });
});
