import { describe, expect, it } from 'vitest';
import { splitBlocklistText, wordsFromWordlist } from '@/features/comment-blocklist/application/parse-blocklist-input';
import { bulkResultTone, formatBulkResultMessage } from '@/features/comment-blocklist/application/format-bulk-result';

describe('splitBlocklistText', () => {
  it('memecah koma dan merapikan spasi', () => {
    expect(splitBlocklistText('lorem,ipsum, dolo')).toEqual(['lorem', 'ipsum', 'dolo']);
  });

  it('menerima baris baru dan titik koma', () => {
    expect(splitBlocklistText('lorem\nipsum;dolo')).toEqual(['lorem', 'ipsum', 'dolo']);
  });
});

describe('wordsFromWordlist', () => {
  it('satu kata per baris', () => {
    expect(wordsFromWordlist('lorem\nipsum\ndolo\n')).toEqual(['lorem', 'ipsum', 'dolo']);
  });

  it('melewati header word dan hanya memakai kolom pertama', () => {
    expect(wordsFromWordlist('word,note\nlorem,abaikan\nipsum,juga')).toEqual(['lorem', 'ipsum']);
  });

  it('CSV titik koma (Excel Indonesia) tanpa header memakai semua sel', () => {
    expect(wordsFromWordlist('lorem;ipsum;dolo')).toEqual(['lorem', 'ipsum', 'dolo']);
  });

  it('melewati header satu kolom dan BOM', () => {
    expect(wordsFromWordlist('\uFEFFword\nlorem\nipsum')).toEqual(['lorem', 'ipsum']);
  });

  it('menghormati sel berkutip yang berisi koma', () => {
    expect(wordsFromWordlist('word,note\n"foo, bar",x\nbaz,y')).toEqual(['foo, bar', 'baz']);
  });
});

describe('formatBulkResultMessage', () => {
  it('menyusun ringkasan dan nada toast', () => {
    const created = { created_count: 2, skipped_count: 1, invalid_count: 0 };
    expect(formatBulkResultMessage(created)).toBe('2 kata ditambahkan, 1 duplikat diabaikan');
    expect(bulkResultTone(created)).toBe('success');
    expect(bulkResultTone({ created_count: 0, skipped_count: 3, invalid_count: 0 })).toBe('info');
  });
});
