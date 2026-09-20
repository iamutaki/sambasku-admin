import { describe, expect, it } from 'vitest';
import {
  buildCreateWordBody,
  fieldToNamePath,
  pickDefaultDialectId,
  pickDefaultLanguageIds,
  hasUploadingImages,
} from '@/features/words/application/create-word-utils';
import type {
  CreateWordFormValues,
  DialectOption,
  InlineWordRequest,
  LanguageOption,
} from '@/features/words/domain/create-word';

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

const UMUM_ID = '01HXYDIALECTUMUM00000000000';
const KOTA_ID = '01HXYDIALECTKOTA00000000000';

function dialect(
  id: string,
  code: string,
  name: string,
  opts: { is_default?: boolean; is_active?: boolean } = {},
): DialectOption {
  return {
    id,
    language_id: SAMBAS_ID,
    code,
    name,
    is_active: opts.is_active ?? true,
    is_default: opts.is_default ?? false,
  };
}

describe('pickDefaultDialectId', () => {
  it('memilih dialek dengan is_default=true', () => {
    expect(
      pickDefaultDialectId([
        dialect(KOTA_ID, 'kota', 'Sambas Kota'),
        dialect(UMUM_ID, 'umum', 'Umum', { is_default: true }),
      ]),
    ).toBe(UMUM_ID);
  });

  it('fallback ke code umum bila belum ada is_default', () => {
    expect(
      pickDefaultDialectId([
        dialect(KOTA_ID, 'kota', 'Sambas Kota'),
        dialect(UMUM_ID, 'umum', 'Umum'),
      ]),
    ).toBe(UMUM_ID);
  });

  it('mengembalikan undefined bila daftar kosong', () => {
    expect(pickDefaultDialectId([])).toBeUndefined();
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
          is_have_definition: true,
          is_have_translation: true,
          translations: [{ language_id: INDONESIA_ID, translation_text: 'makan', translation_type: 'direct' }],
        },
      ],
      category_ids: [],
      related_words: [],
      status: 'draft',
    });
  });

  it('mengizinkan makna dengan definisi nyata tanpa padanan', () => {
    const body = buildCreateWordBody(
      formValues({
        meanings: [
          {
            word_class_id: WORD_CLASS_ID,
            definition: 'Uraian tanpa padanan tunggal',
            is_have_translation: false,
            translations: [],
          },
        ],
      }),
      'draft',
    );
    expect(body.meanings).toEqual([
      {
        word_class_id: WORD_CLASS_ID,
        definition: 'Uraian tanpa padanan tunggal',
        order_index: 1,
        is_have_definition: true,
        is_have_translation: false,
        translations: [],
      },
    ]);
  });

  it('mengizinkan makna padanan saja (tanpa definisi)', () => {
    const body = buildCreateWordBody(
      formValues({
        meanings: [
          {
            word_class_id: WORD_CLASS_ID,
            definition: '-',
            is_have_definition: false,
            is_have_translation: true,
            translations: [
              { language_id: INDONESIA_ID, translation_text: 'makan', translation_type: 'direct' },
            ],
          },
        ],
      }),
      'draft',
    );
    expect(body.meanings).toEqual([
      {
        word_class_id: WORD_CLASS_ID,
        definition: '-',
        order_index: 1,
        is_have_definition: false,
        is_have_translation: true,
        translations: [{ language_id: INDONESIA_ID, translation_text: 'makan', translation_type: 'direct' }],
      },
    ]);
  });

  it('membuang makna definisi placeholder tanpa padanan', () => {
    const body = buildCreateWordBody(
      formValues({
        meanings: [
          {
            word_class_id: WORD_CLASS_ID,
            definition: '-',
            is_have_translation: false,
            translations: [],
          },
        ],
      }),
      'draft',
    );
    expect(body.meanings).toEqual([]);
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

// ---- 04-api-sinonim-inline.md - Form B (kata baru inline) ----

describe('buildCreateWordBody - Form B (sinonim inline)', () => {
  const formB = (body: CreateWordFormValues, status: 'draft' | 'published' = 'draft') =>
    buildCreateWordBody(body, status).related_words[0] as {
      relation_type: string;
      word: InlineWordRequest;
    };

  it('membangun kata inline inherit=true dengan override satu-per-satu', () => {
    const body = buildCreateWordBody(
      formValues({
        related_words: [
          {
            relation_type: 'synonym',
            mode: 'inline',
            word: {
              lemma: '  ngamakn  ',
              inherit_meanings: true,
              meaning_overrides: [
                {
                  meaning_index: 0,
                  definition: '  Mengunyah makanan  ',
                  word_class_id: WORD_CLASS_ID,
                  translations: [{ language_id: INDONESIA_ID, translation_text: ' kunyah ', translation_type: 'direct' }],
                },
              ],
            },
          },
        ],
      }),
      'draft',
    );
    expect(body.related_words).toEqual([
      {
        relation_type: 'synonym',
        word: {
          lemma: 'ngamakn',
          inherit_meanings: true,
          meaning_overrides: [
            {
              meaning_index: 0,
              definition: 'Mengunyah makanan',
              word_class_id: WORD_CLASS_ID,
              translations: [{ language_id: INDONESIA_ID, translation_text: 'kunyah', translation_type: 'direct' }],
            },
          ],
        },
      },
    ]);
  });

  it('inherit_meanings default true saat tidak diisi; notes & word_type hanya saat terisi', () => {
    const rel = formB(
      formValues({
        related_words: [
          {
            relation_type: 'derived_from',
            mode: 'inline',
            word: { lemma: '  ngamakn  ', notes: '  varian lisan  ', word_type: 'word' },
          },
        ],
      }),
    );
    expect(rel.word).toEqual({
      lemma: 'ngamakn',
      notes: 'varian lisan',
      word_type: 'word',
      inherit_meanings: true,
    });
  });

  it('memetakan meaning_index override lewat posisi makna yang DIKIRIM (induk kosong dilewati)', () => {
    const rel = formB(
      formValues({
        meanings: [
          formValues({}).meanings![0],
          { word_class_id: undefined, definition: undefined, translations: [] },
          {
            word_class_id: WORD_CLASS_ID,
            definition: 'Kedua',
            translations: [{ language_id: INDONESIA_ID, translation_text: 'kedua', translation_type: 'direct' }],
          },
        ],
        related_words: [
          {
            relation_type: 'synonym',
            mode: 'inline',
            word: { lemma: 'ngamakn', meaning_overrides: [{ meaning_index: 2, definition: 'Ubah makna kedua' }] },
          },
        ],
      }),
    );
    // makna form index 2 = makna body index 1 (yang pertama kosong dibuang)
    expect(rel.word.meaning_overrides).toEqual([{ meaning_index: 1, definition: 'Ubah makna kedua' }]);
  });

  it('membuang override yang menunjuk makna induk kosong', () => {
    const rel = formB(
      formValues({
        meanings: [{ word_class_id: undefined, definition: undefined, translations: [] }],
        related_words: [
          {
            relation_type: 'synonym',
            mode: 'inline',
            word: { lemma: 'ngamakn', meaning_overrides: [{ meaning_index: 0, definition: 'x' }] },
          },
        ],
      }),
    );
    expect(rel.word.meaning_overrides).toBeUndefined();
    expect(rel.word).toEqual({ lemma: 'ngamakn', inherit_meanings: true });
  });

  it('inherit=false → meanings diisi penuh dan meaning_overrides diabaikan', () => {
    const rel = formB(
      formValues({
        related_words: [
          {
            relation_type: 'antonym',
            mode: 'inline',
            word: {
              lemma: 'belummakn',
              inherit_meanings: false,
              meaning_overrides: [{ meaning_index: 0, definition: 'harus diabaikan' }],
              meanings: [
                {
                  word_class_id: WORD_CLASS_ID,
                  definition: '  Belum makan  ',
                  translations: [{ language_id: INDONESIA_ID, translation_text: '  belum makan  ', translation_type: 'direct' }],
                },
              ],
            },
          },
        ],
      }),
      'published',
    );
    expect(rel).toEqual({
      relation_type: 'antonym',
      word: {
        lemma: 'belummakn',
        inherit_meanings: false,
        meanings: [
          {
            word_class_id: WORD_CLASS_ID,
            definition: 'Belum makan',
            order_index: 1,
            is_have_definition: true,
            is_have_translation: true,
            translations: [{ language_id: INDONESIA_ID, translation_text: 'belum makan', translation_type: 'direct' }],
          },
        ],
      },
    });
  });

  it('membuang item inline yang lemma-nya kosong', () => {
    const body = buildCreateWordBody(
      formValues({
        related_words: [{ relation_type: 'synonym', mode: 'inline', word: { lemma: '   ' } }],
      }),
      'draft',
    );
    expect(body.related_words).toEqual([]);
  });

  it('override tanpa field yang diisi hanya membawa meaning_index (sisanya ikut induk)', () => {
    const rel = formB(
      formValues({
        related_words: [
          {
            relation_type: 'synonym',
            mode: 'inline',
            word: { lemma: 'ngamakn', meaning_overrides: [{ meaning_index: 0 }] },
          },
        ],
      }),
    );
    expect(rel.word.meaning_overrides).toEqual([{ meaning_index: 0 }]);
  });

  it('mode link (Form A) tetap berjalan seperti sebelumnya', () => {
    const rel = formB(
      formValues({
        related_words: [
          { relation_type: 'synonym', mode: 'link', word_id: '01HXYZFFFFFFFFFFFFFFFFFFFF' },
          { relation_type: 'antonym', word_id: '01HXYZEEEEEEEEEEEEEEEEEEEE' },
        ],
      }),
    );
    const all = buildCreateWordBody(
      formValues({
        related_words: [
          { relation_type: 'synonym', mode: 'link', word_id: '01HXYZFFFFFFFFFFFFFFFFFFFF' },
          { relation_type: 'antonym', word_id: '01HXYZEEEEEEEEEEEEEEEEEEEE' },
        ],
      }),
      'draft',
    ).related_words;
    expect(all).toHaveLength(2);
    // mode tidak ikut terkirim (hanya word_id + relation_type)
    for (const item of all) {
      expect(item).not.toHaveProperty('mode');
      expect(item).not.toHaveProperty('word');
    }
    expect(rel).toMatchObject({ relation_type: 'synonym', word_id: '01HXYZFFFFFFFFFFFFFFFFFFFF' });
  });
});
describe('buildCreateWordBody - images (05-support-image)', () => {
  it('hanya gambar selesai upload yang masuk body; field UI di-strip', () => {
    const body = buildCreateWordBody(
      formValues({
        images: [
          { uid: 'u1', status: 'done', url: 'https://cdn/1.jpg', provider_file_id: 'f1', alt_text: '  ilustrasi  ', is_primary: true },
          { uid: 'u2', status: 'uploading', fileName: 'masih.jpg' },
          { uid: 'u3', status: 'error', fileName: 'gagal.jpg' },
          { uid: 'u4', status: 'done', url: '', provider_file_id: '' }, // done tapi tak lengkap
        ],
      }),
      'published',
    );
    expect(body.images).toEqual([
      { url: 'https://cdn/1.jpg', provider_file_id: 'f1', alt_text: 'ilustrasi', is_primary: true },
    ]);
  });

  it('tanpa gambar → field images tidak dikirim; hasUploadingImages mendeteksi ongoing', () => {
    const body = buildCreateWordBody(formValues({}), 'draft');
    expect(body.images).toBeUndefined();
    expect(hasUploadingImages(undefined)).toBe(false);
    expect(hasUploadingImages([{ uid: 'u', status: 'uploading' }])).toBe(true);
  });
});
