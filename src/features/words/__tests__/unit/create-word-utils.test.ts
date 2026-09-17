import { describe, expect, it } from 'vitest';
import {
  buildCreateWordBody,
  fieldToNamePath,
  pickDefaultLanguageIds,
} from '@/features/words/application/create-word-utils';
import type { CreateWordFormValues, LanguageOption } from '@/features/words/domain/create-word';

const SAMBAS_ID = '01HXYZAAAAAAAAAAAAAAAAAAAA';
const INDONESIA_ID = '01HXYBBBBBBBBBBBBBBBBBBBB';
const WORD_CLASS_ID = '01HXYZCCCCCCCCCCCCCCCCCCCC';

describe('fieldToNamePath', () => {
  it('mengubah path bertitik backend menjadi namePath antd', () => {
    expect(fieldToNamePath('meanings.0.definition')).toEqual(['meanings', 0, 'definition']);
    expect(fieldToNamePath('meanings.1.translations.0.translation_text')).toEqual([
      'meanings',
      1,
      'translations',
      0,
      'translation_text',
    ]);
  });

  it('mengembalikan field tunggal apa adanya', () => {
    expect(fieldToNamePath('lemma')).toEqual(['lemma']);
  });
});

function lang(id: string, code: string, name: string, isActive = true): LanguageOption {
  return { id, code, name, native_name: null, is_active: isActive };
}

const OTHER_ID = '01HXYZCCCCCCCCCCCCCCCCCCCC';

describe('pickDefaultLanguageIds', () => {
  it('memilih Sambas sebagai lemma dan Indonesia sebagai terjemahan (kode SBS/IDN)', () => {
    const { sourceId, targetId } = pickDefaultLanguageIds([
      lang(SAMBAS_ID, 'SBS', 'Sambas'),
      lang(INDONESIA_ID, 'IDN', 'Indonesia'),
    ]);
    expect(sourceId).toBe(SAMBAS_ID);
    expect(targetId).toBe(INDONESIA_ID);
  });

  it('stabil walau urutan list berubah (Indonesia muncul duluan)', () => {
    const { sourceId, targetId } = pickDefaultLanguageIds([
      lang(INDONESIA_ID, 'IDN', 'Indonesia'),
      lang(SAMBAS_ID, 'SBS', 'Sambas'),
    ]);
    expect(sourceId).toBe(SAMBAS_ID);
    expect(targetId).toBe(INDONESIA_ID);
  });

  it('mengenali kode/nama varian (id, indonesia, bahsa indonesia)', () => {
    const { sourceId, targetId } = pickDefaultLanguageIds([
      lang(INDONESIA_ID, 'id', 'Bahasa Indonesia'),
      lang(SAMBAS_ID, 'sambas', 'Sambas'),
    ]);
    expect(sourceId).toBe(SAMBAS_ID);
    expect(targetId).toBe(INDONESIA_ID);
  });

  it('tidak menjadikan bahasa terjemahan sebagai lemma saat Sambas tidak ada', () => {
    const { sourceId, targetId } = pickDefaultLanguageIds([
      lang(INDONESIA_ID, 'IDN', 'Indonesia'),
      lang(OTHER_ID, 'JAV', 'Jawa'),
    ]);
    expect(sourceId).toBe(OTHER_ID);
    expect(targetId).toBe(INDONESIA_ID);
  });

  it('tidak pernah memilih sumber === target (satu bahasa)', () => {
    const only = lang(SAMBAS_ID, 'SBS', 'Sambas');
    const { sourceId, targetId } = pickDefaultLanguageIds([only]);
    expect(sourceId).toBe(only.id);
    expect(targetId).toBeUndefined();
  });

  it('mengabaikan bahasa non-aktif saat menentukan default', () => {
    const { sourceId, targetId } = pickDefaultLanguageIds([
      lang(INDONESIA_ID, 'IDN', 'Indonesia', false),
      lang(SAMBAS_ID, 'SBS', 'Sambas'),
    ]);
    expect(sourceId).toBe(SAMBAS_ID);
    expect(targetId).toBeUndefined();
  });

  it('mengembalikan kosong saat tidak ada bahasa sama sekali', () => {
    const { sourceId, targetId } = pickDefaultLanguageIds([]);
    expect(sourceId).toBeUndefined();
    expect(targetId).toBeUndefined();
  });
});

function formValues(overrides: Partial<CreateWordFormValues>): CreateWordFormValues {
  return {
    language_id: SAMBAS_ID,
    lemma: '  makatn  ',
    word_type: 'word',
    meanings: [
      {
        word_class_id: WORD_CLASS_ID,
        definition: '  Aktivitas makan  ',
        translations: [{ language_id: INDONESIA_ID, translation_text: '  makan  ', translation_type: 'direct' }],
      },
    ],
    ...overrides,
  };
}

describe('buildCreateWordBody', () => {
  it('menyusun body minimal dengan default yang benar', () => {
    const body = buildCreateWordBody(formValues({}), 'draft');
    expect(body).toEqual({
      language_id: SAMBAS_ID,
      lemma: 'makatn',
      word_type: 'word',
      meanings: [
        {
          word_class_id: WORD_CLASS_ID,
          definition: 'Aktivitas makan',
          order_index: 1,
          translations: [{ language_id: INDONESIA_ID, translation_text: 'makan', translation_type: 'direct' }],
        },
      ],
      category_ids: [],
      related_words: [],
      status: 'draft',
    });
  });

  it('membersihkan terjemahan/baris yang kosong dan membuang makna tanpa isi', () => {
    const values = formValues({
      meanings: [
        formValues({}).meanings![0],
        { word_class_id: undefined, definition: undefined, translations: [] },
        {
          word_class_id: WORD_CLASS_ID,
          definition: 'Kedua',
          translations: [{ language_id: INDONESIA_ID, translation_text: '  kedua  ', translation_type: 'direct' }],
          examples: [
            { source_language_id: SAMBAS_ID, source_sentence: '' },
            { target_language_id: INDONESIA_ID, target_sentence: 'dibuang tanpa kalimat' },
          ],
        },
      ],
    });
    const body = buildCreateWordBody(values, 'published');
    expect(body.meanings).toHaveLength(2);
    expect(body.meanings[1].definition).toBe('Kedua');
    expect(body.meanings[1].order_index).toBe(2);
    // contoh tanpa source_sentence dibuang, contoh tanpa source dibuang
    expect(body.meanings[1].examples).toBeUndefined();
  });

  it('menyertakan relasi, varian, pengucapan hanya saat terisi', () => {
    const body = buildCreateWordBody(
      formValues({
        dialect_id: '01HXYDDDDDDDDDDDDDDDDDDDD',
        notes: '  catatan  ',
        category_ids: ['01HXYZEEEEEEEEEEEEEEEEEEEE'],
        related_words: [
          { word_id: '01HXYZFFFFFFFFFFFFFFFFFFFF', relation_type: 'synonym' },
          { word_id: undefined, relation_type: undefined },
        ],
        variants: [
          { form: '  memakan  ', variant_type: 'derivation', affix_type: 'prefix', affix_value: ' me- ' },
          { form: '  ' },
        ],
        pronunciation: { notation: 'ipa', value: '/makatn/' },
      }),
      'published',
    );
    expect(body).toMatchObject({
      dialect_id: '01HXYDDDDDDDDDDDDDDDDDDDD',
      notes: 'catatan',
      category_ids: ['01HXYZEEEEEEEEEEEEEEEEEEEE'],
      related_words: [{ word_id: '01HXYZFFFFFFFFFFFFFFFFFFFF', relation_type: 'synonym' }],
      variants: [{ form: 'memakan', variant_type: 'derivation', affix_type: 'prefix', affix_value: 'me-' }],
      pronunciation: { notation: 'ipa', value: '/makatn/' },
      status: 'published',
    });
  });

  it('menjatuhkan pengucapan kosong dan notasi default ipa', () => {
    const body = buildCreateWordBody(formValues({ pronunciation: { notation: 'ipa', value: '' } }), 'draft');
    expect(body.pronunciation).toBeUndefined();

    const withValue = buildCreateWordBody(formValues({ pronunciation: { value: ' /x/ ' } }), 'draft');
    expect(withValue.pronunciation).toEqual({ notation: 'ipa', value: '/x/' });
  });
});