import { describe, expect, it } from 'vitest';
import {
  buildCorrectContribution,
  buildCorrectExampleBody,
  buildCorrectPronunciationBody,
  buildCorrectWordBody,
  buildCorrectWordImageBody,
  wordEntityToFormValues,
} from '@/features/contributions/application/correct-contribution';
import type { WordEntityView } from '@/features/contributions/domain/contribution';

const SBS_ID = '01HXZSBS000000000000000001';
const IDN_ID = '01HXZIDN000000000000000001';
const WC_ID = '01HXZWC00000000000000000001';

function wordView(overrides: Partial<WordEntityView> = {}): WordEntityView {
  return {
    id: 'w1',
    languageId: SBS_ID,
    dialectId: null,
    lemma: 'makatn',
    wordType: 'word',
    status: 'published',
    notes: null,
    isVerified: false,
    isCorrected: false,
    meanings: [
      {
        id: 'm1',
        wordClassId: WC_ID,
        wordClassName: 'Verba',
        definition: 'Aktivitas makan',
        orderIndex: 1,
        translations: [{ languageId: IDN_ID, text: 'makan', type: 'direct' }],
        examples: [
          {
            sourceLanguageId: SBS_ID,
            source: 'Kami udah makatn tadi.',
            targetLanguageId: IDN_ID,
            target: 'Kami sudah makan tadi.',
            sourceType: 'native_speaker',
          },
        ],
      },
    ],
    categories: [{ id: 'cat1', name: 'Makanan' }],
    pronunciations: [{ id: 'p1', notation: 'ipa', value: '/makatn/', dialectId: null, status: 'published' }],
    images: [],
    relatedWords: [{ wordId: 'w2', lemma: 'ngamakn', relationType: 'synonym' }],
    appearsIn: [],
    variants: [{ id: 'v1', form: 'memakan', variantType: 'derivation', affixType: 'prefix', affixValue: 'me-', notes: null }],
    ...overrides,
  };
}

describe('wordEntityToFormValues', () => {
  it('mem-parse view kata jadi nilai form create (prefill koreksi)', () => {
    const values = wordEntityToFormValues(wordView());
    expect(values).toMatchObject({
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
      related_words: [{ relation_type: 'synonym', word_id: 'w2' }],
      variants: [{ form: 'memakan', variant_type: 'derivation', affix_type: 'prefix', affix_value: 'me-' }],
      pronunciation: { notation: 'ipa', value: '/makatn/' },
    });
  });

  it('memberi undefined pada field yang tidak tersedia/kosong', () => {
    const values = wordEntityToFormValues(
      wordView({ dialectId: null, notes: '   ', pronunciations: [], variants: [], relatedWords: [], categories: [] }),
    );
    expect(values.dialect_id).toBeUndefined();
    expect(values.notes).toBeUndefined();
    expect(values.pronunciation).toBeUndefined();
    expect(values.variants).toEqual([]);
    expect(values.related_words).toEqual([]);
  });
});

describe('buildCorrectWordBody', () => {
  it('body kata = create-word lengkap tanpa status + publish/comment', () => {
    const body = buildCorrectWordBody(wordEntityToFormValues(wordView()), { publish: true, comment: ' sudah benar' });
    expect(body.entity_type).toBe('word');
    expect(body.word).not.toHaveProperty('status');
    expect(body.word.lemma).toBe('makatn');
    expect(body.publish).toBe(true);
    expect(body.comment).toBe('sudah benar');
  });

  it('publish=false dan tanpa comment diabaikan', () => {
    const body = buildCorrectWordBody(wordEntityToFormValues(wordView()), { publish: false });
    expect(body.publish).toBe(false);
    expect(body.comment).toBeUndefined();
  });
});

describe('builder entity anak', () => {
  it('pronunciation: default notation ipa, optional kosong dijatuhkan', () => {
    const body = buildCorrectPronunciationBody(
      { value: ' /x/ ', dialect_id: null, speaker_name: '  ', notes: undefined },
      { publish: true },
    );
    expect(body).toEqual({
      entity_type: 'pronunciation',
      notation: 'ipa',
      value: '/x/',
      publish: true,
    });
  });

  it('pronunciation: optional terisi ikut dikirim', () => {
    const body = buildCorrectPronunciationBody(
      { notation: 'ipa', value: '/makatn/', dialect_id: 'd1', audio_url: 'https://a/x.mp3', notes: 'n1' },
      { publish: false, comment: 'oke' },
    );
    expect(body).toMatchObject({ dialect_id: 'd1', audio_url: 'https://a/x.mp3', notes: 'n1', publish: false, comment: 'oke' });
  });

  it('word_image: trim + is_primary + alt_text opsional', () => {
    const body = buildCorrectWordImageBody(
      { url: ' https://img/1.jpg ', provider_file_id: ' f1 ', alt_text: null, is_primary: true },
      { publish: true },
    );
    expect(body).toMatchObject({ url: 'https://img/1.jpg', provider_file_id: 'f1', is_primary: true });
    expect(body.alt_text).toBeUndefined();
  });

  it('example: source_type typed, target kosong tidak dikirim', () => {
    const body = buildCorrectExampleBody(
      { source_sentence: ' Kami udah makatn. ', target_sentence: null, source_type: 'interview' },
      { publish: true },
    );
    expect(body).toEqual({
      entity_type: 'example',
      source_sentence: 'Kami udah makatn.',
      source_type: 'interview',
      publish: true,
    });
  });
});

describe('buildCorrectContribution (dispatcher)', () => {
  it('memilih builder sesuai entity_type', () => {
    expect(buildCorrectContribution('word', wordEntityToFormValues(wordView()), { publish: true }).entity_type).toBe('word');
    expect(
      buildCorrectContribution('pronunciation', { value: '/x/' }, { publish: true }).entity_type,
    ).toBe('pronunciation');
    expect(
      buildCorrectContribution('word_image', { url: 'u', provider_file_id: 'f', is_primary: false }, { publish: true })
        .entity_type,
    ).toBe('word_image');
    expect(
      buildCorrectContribution('example', { source_sentence: 'x' }, { publish: true }).entity_type,
    ).toBe('example');
  });
});