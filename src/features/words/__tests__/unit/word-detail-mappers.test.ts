import { describe, expect, it } from 'vitest';
import {
  buildUpdateWordBody,
  wordDetailToFormValues,
} from '@/features/words/application/word-detail-mappers';
import { buildCreateWordBody } from '@/features/words/application/create-word-utils';
import type { WordDetail } from '@/features/words/domain/word-detail';

const SBS_ID = '01HXZSBS000000000000000001';
const IDN_ID = '01HXZIDN000000000000000001';
const WC_ID = '01HXZWC00000000000000000001';

function wordDetail(overrides: Partial<WordDetail> = {}): WordDetail {
  return {
    id: 'w1',
    lemma: 'makatn',
    language_id: SBS_ID,
    notes: null,
    word_type: 'word',
    status: 'published',
    is_verified: false,
    is_corrected: false,
    created_at: '2026-09-18T10:00:00Z',
    updated_at: null,
    meanings: [
      {
        id: 'm1',
        word_class: { id: WC_ID, code: 'verb', name: 'Verba', alias: 'Kata Kerja', parent_id: null },
        inherited_from_meaning_id: null,
        definition: 'Aktivitas makan',
        order_index: 1,
        translations: [{ language_id: IDN_ID, translation_text: 'makan', translation_type: 'direct' }],
        examples: [
          {
            id: 'e1',
            source_language_id: SBS_ID,
            source_sentence: 'Kami udah makatn tadi.',
            target_language_id: IDN_ID,
            target_sentence: 'Kami sudah makan tadi.',
            source_type: 'native_speaker',
          },
        ],
      },
    ],
    categories: [{ id: 'cat1', name: 'Makanan' }],
    pronunciations: [{ id: 'p1', notation: 'ipa', value: '/makatn/', dialect_id: null }],
    images: [],
    related_words: [{ word_id: 'w2', lemma: 'ngamakn', relation_type: 'synonym' }],
    appears_in: [],
    variants: [
      { id: 'v1', form: 'memakan', variant_type: 'derivation', affix_type: 'prefix', affix_value: 'me-', dialect_id: null, notes: null },
    ],
    ...overrides,
  };
}

describe('wordDetailToFormValues', () => {
  it('mem-parse detail kata (GET admin) jadi nilai form edit', () => {
    const values = wordDetailToFormValues(wordDetail());
    expect(values).toEqual({
      language_id: SBS_ID,
      lemma: 'makatn',
      word_type: 'word',
      meanings: [
        {
          word_class_id: WC_ID,
          definition: 'Aktivitas makan',
          order_index: 1,
          translations: [{ language_id: IDN_ID, translation_text: 'makan', translation_type: 'direct' }],
          examples: [
            {
              source_language_id: SBS_ID,
              source_sentence: 'Kami udah makatn tadi.',
              target_language_id: IDN_ID,
              target_sentence: 'Kami sudah makan tadi.',
              source_type: 'native_speaker',
            },
          ],
        },
      ],
      category_ids: ['cat1'],
      related_words: [{ relation_type: 'synonym', mode: 'link', word_id: 'w2' }],
      variants: [
        { form: 'memakan', variant_type: 'derivation', affix_type: 'prefix', affix_value: 'me-' },
      ],
      pronunciation: { notation: 'ipa', value: '/makatn/' },
      images: [],
    });
  });

  it('menghilangkan field opsional kosong/null (notes, target, affiks)', () => {
    const values = wordDetailToFormValues(
      wordDetail({
        notes: '',
        meanings: [
          {
            id: 'm1',
            word_class: { id: WC_ID, code: 'verb', name: 'Verba', alias: 'Kata Kerja', parent_id: null },
            inherited_from_meaning_id: null,
            definition: 'Aktivitas makan',
            order_index: 1,
            translations: [{ language_id: IDN_ID, translation_text: 'makan', translation_type: 'direct' }],
            examples: [],
          },
        ],
        pronunciations: [],
        variants: [
          { id: 'v1', form: 'memakan', variant_type: 'derivation', affix_type: null, affix_value: null, dialect_id: null, notes: null },
        ],
      }),
    );
    expect(values.notes).toBeUndefined();
    expect(values.pronunciation).toBeUndefined();
    expect(values.meanings?.[0].examples).toBeUndefined();
    expect(values.variants?.[0]).toEqual({ form: 'memakan', variant_type: 'derivation' });
  });

  it('relasi selalu bentuk link (Form A) tanpa editor inline', () => {
    const values = wordDetailToFormValues(
      wordDetail({ related_words: [{ word_id: 'w2', lemma: 'ngamakn', relation_type: 'synonym' }] }),
    );
    expect(values.related_words).toEqual([{ relation_type: 'synonym', mode: 'link', word_id: 'w2' }]);
  });

  it('menerima word_class null dan word_type non-default', () => {
    const values = wordDetailToFormValues(
      wordDetail({
        word_type: 'idiom',
        meanings: [
          {
            id: 'm1',
            word_class: null,
            inherited_from_meaning_id: null,
            definition: 'Buah hati',
            order_index: 1,
            translations: [{ language_id: IDN_ID, translation_text: 'anak', translation_type: 'descriptive' }],
            examples: [],
          },
        ],
      }),
    );
    expect(values.word_type).toBe('idiom');
    expect(values.meanings?.[0].word_class_id).toBeUndefined();
    expect(values.meanings?.[0].translations?.[0].translation_type).toBe('descriptive');
  });
});

describe('buildUpdateWordBody', () => {
  it('bentuk body full-replace PUT dengan relasi hanya Form A', () => {
    const values = wordDetailToFormValues(wordDetail());
    values.lemma = 'makatn betul';
    // nilai form yg belum terisi dibersihkan identik dengan buildCreateWordBody
    const body = buildUpdateWordBody(values, 'published');
    expect(body).toEqual({
      language_id: SBS_ID,
      lemma: 'makatn betul',
      word_type: 'word',
      meanings: [
        {
          word_class_id: WC_ID,
          definition: 'Aktivitas makan',
          order_index: 1,
          translations: [{ language_id: IDN_ID, translation_text: 'makan', translation_type: 'direct' }],
          examples: [
            {
              source_language_id: SBS_ID,
              source_sentence: 'Kami udah makatn tadi.',
              target_language_id: IDN_ID,
              target_sentence: 'Kami sudah makan tadi.',
              source_type: 'native_speaker',
            },
          ],
        },
      ],
      category_ids: ['cat1'],
      related_words: [{ relation_type: 'synonym', word_id: 'w2' }],
      variants: [
        { form: 'memakan', variant_type: 'derivation', affix_type: 'prefix', affix_value: 'me-' },
      ],
      pronunciation: { notation: 'ipa', value: '/makatn/' },
      status: 'published',
    });
    expect(body.related_words.every((rel) => 'word_id' in rel)).toBe(true);
  });

  it('selaras dengan buildCreateWordBody untuk nilai form yang sama (minus Form B)', () => {
    const values = wordDetailToFormValues(wordDetail());
    const update = buildUpdateWordBody(values, 'draft');
    const create = buildCreateWordBody(values, 'draft');
    expect(update).toEqual({ ...create, related_words: update.related_words });
  });
});
describe('wordDetailToFormValues - images (05-support-image)', () => {
  it('prefill gambar existing termasuk provider_file_id (round-trip PUT)', () => {
    const values = wordDetailToFormValues({
      ...wordDetail(),
      images: [
        { id: '01IMG1', url: 'https://cdn/1.jpg', provider_file_id: 'f1', alt_text: 'ilustrasi', is_primary: true },
        { id: '01IMG2', url: 'https://cdn/2.jpg', provider_file_id: 'f2', alt_text: null, is_primary: false },
      ],
    });
    expect(values.images).toEqual([
      { uid: '01IMG1', url: 'https://cdn/1.jpg', provider_file_id: 'f1', alt_text: 'ilustrasi', is_primary: true, status: 'done' },
      { uid: '01IMG2', url: 'https://cdn/2.jpg', provider_file_id: 'f2', alt_text: undefined, is_primary: false, status: 'done' },
    ]);

    // round-trip: body PUT membawa ulang images → tidak ada penghapusan senyap
    const body = buildUpdateWordBody(values, 'published');
    expect(body.images).toEqual([
      { url: 'https://cdn/1.jpg', provider_file_id: 'f1', alt_text: 'ilustrasi', is_primary: true },
      { url: 'https://cdn/2.jpg', provider_file_id: 'f2', is_primary: false },
    ]);
  });
});
