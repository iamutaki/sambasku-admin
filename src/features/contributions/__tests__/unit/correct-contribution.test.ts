import { describe, expect, it } from 'vitest';
import {
  buildCorrectWordBody,
  wordEntityToFormValues,
} from '@/features/contributions/application/correct-contribution';
import type { WordEntityView } from '@/features/contributions/domain/contribution';

const SBS = '01HXZSBS000000000000000001';
const IDN = '01HXZIDN000000000000000001';
const WC = '01HXZWC00000000000000000001';

function wordView(overrides: Partial<WordEntityView> = {}): WordEntityView {
  return {
    id: 'w1',
    languageId: SBS,
    dialectId: null,
    lemma: 'lading',
    wordType: 'word',
    status: 'pending_review',
    notes: null,
    isVerified: false,
    isCorrected: false,
    meanings: [
      {
        id: 'm1',
        wordClassId: WC,
        wordClassName: 'Nomina',
        definition: 'bilah besi tipis dan tajam',
        orderIndex: 1,
        translations: [{ languageId: IDN, text: 'pisau', type: 'direct' }],
        examples: [],
      },
    ],
    categories: [],
    pronunciations: [],
    images: [],
    relatedWords: [],
    appearsIn: [],
    variants: [],
    ...overrides,
  };
}

describe('wordEntityToFormValues', () => {
  it('menandai definisi dan terjemahan supaya field koreksi tampil terisi', () => {
    const values = wordEntityToFormValues(wordView());
    expect(values.lemma).toBe('lading');
    expect(values.meanings?.[0]).toMatchObject({
      word_class_id: WC,
      definition: 'bilah besi tipis dan tajam',
      is_have_definition: true,
      is_have_translation: true,
      meaning_completeness: 'both',
      translations: [
        { language_id: IDN, translation_text: 'pisau', translation_type: 'direct' },
      ],
    });
  });

  it('definisi placeholder "-" tidak membuka field definisi', () => {
    const values = wordEntityToFormValues(
      wordView({
        meanings: [
          {
            id: 'm1',
            wordClassId: WC,
            wordClassName: null,
            definition: '-',
            orderIndex: 1,
            translations: [{ languageId: IDN, text: 'pisau', type: 'direct' }],
            examples: [],
          },
        ],
      }),
    );
    expect(values.meanings?.[0]).toMatchObject({
      definition: '',
      is_have_definition: false,
      is_have_translation: true,
      meaning_completeness: 'padanan_only',
    });
  });
});

describe('buildCorrectWordBody', () => {
  it('mengirim field kata di root body, bukan di dalam word', () => {
    const body = buildCorrectWordBody(wordEntityToFormValues(wordView()), { publish: true });
    expect(body).toMatchObject({
      entity_type: 'word',
      language_id: SBS,
      lemma: 'lading',
      publish: true,
      meanings: [
        expect.objectContaining({
          word_class_id: WC,
          definition: 'bilah besi tipis dan tajam',
          translations: [expect.objectContaining({ translation_text: 'pisau' })],
        }),
      ],
    });
    expect(body).not.toHaveProperty('word');
  });
});
