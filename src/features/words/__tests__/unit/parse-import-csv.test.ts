import { describe, expect, it } from 'vitest';
import { importTemplateCsv, parseImportCsv } from '@/features/words/application/parse-import-csv';

describe('parseImportCsv', () => {
  it('menggabungkan lemma yang sama menjadi beberapa makna', () => {
    const { words } = parseImportCsv('lemma,terjemahan,definisi,contoh\nmakatn,makan,,\nMakatn,,menghabiskan,\n');
    expect(words).toHaveLength(1);
    expect(words[0].meanings).toHaveLength(2);
    expect(words[0].lemma).toBe('makatn');
  });

  it('menerima header padanan dan arti serta koma di dalam kutip', () => {
    const { words } = parseImportCsv('kata;padanan;arti;contoh\nayek;air;"cairan, untuk minum";\n');
    expect(words[0].meanings[0]).toMatchObject({
      translation: 'air',
      definition: 'cairan, untuk minum',
    });
  });

  it('menerima header baru kata/penjelasan_arti', () => {
    const { words } = parseImportCsv(
      'kata,terjemahan,penjelasan_arti,contoh\npalak,kepala,bagian tubuh sebelah atas,\n',
    );
    expect(words[0]).toMatchObject({ lemma: 'palak' });
    expect(words[0].meanings[0]).toMatchObject({
      translation: 'kepala',
      definition: 'bagian tubuh sebelah atas',
    });
  });

  it('templat default memakai header ramah', () => {
    const header = importTemplateCsv().split('\n')[0];
    expect(header).toBe('kata,terjemahan,penjelasan_arti,contoh');
  });

  it('menggabungkan makna kembar di file', () => {
    const { words } = parseImportCsv('lemma,terjemahan,definisi,contoh\nmakatn,makan,,\nmakatn,makan,,\n');
    expect(words[0].meanings).toHaveLength(1);
  });
});
