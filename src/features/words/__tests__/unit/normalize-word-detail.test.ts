import { describe, expect, it } from 'vitest';
import { wordDetailToFormValues } from '@/features/words/application/word-detail-mappers';
import { normalizeWordDetail } from '@/features/words/application/normalize-word-detail';

/**
 * Cuplikan GET detail "somet": notes null, target_sentence contoh kedua null,
 * parent_id null. Bentuk ini yang menjatuhkan cast String di klien.
 */
const SOMET_DETAIL = {
  id: '01M33HCMTN85A4QNPZE8CHWC02',
  lemma: 'somet',
  language_id: '01M32TP336MKN6E26BV09FMXEF',
  notes: null,
  word_type: 'word',
  usage_labels: [],
  status: 'published',
  is_verified: true,
  is_corrected: false,
  self_verified: true,
  verified_by: { username: 'admin', role: 'admin' },
  verified_at: '2026-09-22T03:08:44.000Z',
  meanings: [
    {
      id: '01M34HHXKHJNZTMMY74PB34AMD',
      word_class: {
        id: '01M32TP3T3257CZKV1CQDJ1ZKE',
        code: 'n',
        name: 'Nomina',
        alias: 'Kata Benda',
        description: 'noun',
        parent_id: null,
      },
      inherited_from_meaning_id: null,
      definition: 'bulu (rambut) yang tumbuh di atas bibir atas',
      is_have_definition: true,
      is_have_translation: true,
      order_index: 1,
      translations: [
        {
          language_id: '01M32TP371ZJ2JKVG24K2XNDZ4',
          translation_text: 'kumis',
          translation_type: 'direct',
        },
      ],
      examples: [
        {
          id: '01M34HHXSTWP83207QC7NXMVZH',
          source_language_id: '01M32TP336MKN6E26BV09FMXEF',
          source_sentence: 'carekan tabal somet biak iye',
          target_language_id: '01M32TP371ZJ2JKVG24K2XNDZ4',
          target_sentence: 'sungguh tebal kumis orang itu',
          source_type: 'native_speaker',
          audios: [
            {
              id: '01M33KJM35RVNNGEE03RD4BFR5',
              url: 'https://example.com/a.wav',
              dialect_id: '01M32TP3E1JFBBG0QF1A278EPD',
              speaker_name: 'Ibnul Mutaki',
              duration_ms: 1720,
              is_primary: true,
              mime_type: 'audio/wav',
            },
          ],
        },
        {
          id: '01M34HHXSTV18D0JBFJ0F80QTS',
          source_language_id: '01M32TP336MKN6E26BV09FMXEF',
          source_sentence: 'sometmu yo cukor',
          target_language_id: '01M32TP371ZJ2JKVG24K2XNDZ4',
          target_sentence: null,
          source_type: null,
          audios: [
            {
              id: '01M34HJY6XW7Y9V1NFFNADJ0KV',
              url: 'https://example.com/b.wav',
              dialect_id: null,
              speaker_name: null,
              duration_ms: null,
              is_primary: true,
              mime_type: 'audio/wav',
            },
          ],
        },
      ],
    },
  ],
  categories: [],
  pronunciations: [],
  images: [],
  audios: [],
  related_words: [],
  appears_in: [],
  variants: [],
};

describe('normalizeWordDetail', () => {
  it('menerima target_sentence, notes, dan source_type null tanpa melempar', () => {
    const detail = normalizeWordDetail(SOMET_DETAIL);

    expect(detail.notes).toBeNull();
    expect(detail.lemma).toBe('somet');
    expect(detail.created_at).toBe('');
    expect(detail.meanings[0]?.word_class?.parent_id).toBeNull();
    expect(detail.meanings[0]?.examples[0]?.target_sentence).toBe('sungguh tebal kumis orang itu');
    expect(detail.meanings[0]?.examples[1]?.target_sentence).toBeNull();
    expect(detail.meanings[0]?.examples[1]?.source_type).toBeNull();
    expect(detail.meanings[0]?.examples[1]?.audios?.[0]?.speaker_name).toBeNull();
    expect(detail.categories).toEqual([]);
    expect(detail.variants).toEqual([]);
  });

  it('definisi null jadi placeholder, contoh tanpa terjemahan tidak ikut ke form', () => {
    const detail = normalizeWordDetail({
      ...SOMET_DETAIL,
      meanings: [
        {
          ...SOMET_DETAIL.meanings[0],
          definition: null,
        },
      ],
    });

    expect(detail.meanings[0]?.definition).toBeNull();
    const values = wordDetailToFormValues(detail);
    expect(values.meanings?.[0]?.definition).toBe('');
    expect(values.meanings?.[0]?.is_have_definition).toBe(false);
    expect(values.meanings?.[0]?.examples?.[1]).toEqual({
      source_language_id: '01M32TP336MKN6E26BV09FMXEF',
      source_sentence: 'sometmu yo cukor',
      target_language_id: '01M32TP371ZJ2JKVG24K2XNDZ4',
    });
  });

  it('payload rusak (bukan objek, array hilang) tetap jadi detail kosong yang aman', () => {
    const detail = normalizeWordDetail(null);
    expect(detail.lemma).toBe('');
    expect(detail.meanings).toEqual([]);
    expect(detail.word_type).toBe('word');
    expect(() => wordDetailToFormValues(detail)).not.toThrow();
  });
});
