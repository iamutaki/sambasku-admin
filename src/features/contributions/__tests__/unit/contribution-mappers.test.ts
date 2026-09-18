import { describe, expect, it } from 'vitest';
import { normalizeContributionDetail } from '@/features/contributions/application/contribution-mappers';
import type { ContributionDetailPayload, ContributionDetailView, ContributionListItem } from '@/features/contributions/domain/contribution';

const SBS_ID = '01HXZSBS000000000000000001';
const IDN_ID = '01HXZIDN000000000000000001';
const WC_ID = '01HXZWC00000000000000000001';

// Akses anggota union redistributed oleh `entityType` (word vs child).
const wordOf = (d: ContributionDetailView) => (d.entityType === 'word' ? d.word : null);
const childOf = (d: ContributionDetailView) => (d.entityType === 'word' ? null : d.child);

function listItem(overrides: Partial<ContributionListItem>): ContributionListItem {
  return {
    id: 'c1',
    user_id: 'u1',
    contributor_username: 'kontributor',
    entity_type: 'word',
    entity_id: 'e1',
    action: 'create',
    status: 'pending',
    created_at: '2026-09-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('normalizeContributionDetail - word (layout impl camelCase)', () => {
  it('menormalisasi WordDetail dengan relasi/makna/anak', () => {
    const payload: ContributionDetailPayload = {
      contribution: listItem({}),
      review: null,
      entity: {
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
            wordClass: { id: WC_ID, name: 'Verba › Verba Transitif' },
            definition: 'Aktivitas makan',
            orderIndex: 1,
            translations: [{ languageId: IDN_ID, translationText: 'makan', translationType: 'direct' }],
            examples: [
              {
                sourceLanguageId: SBS_ID,
                sourceSentence: 'Kami udah makatn tadi.',
                targetLanguageId: IDN_ID,
                targetSentence: 'Kami sudah makan tadi.',
                sourceType: 'native_speaker',
              },
            ],
          },
        ],
        categories: [{ id: 'cat1', name: 'Makanan' }],
        pronunciations: [
          { id: 'p1', notation: 'ipa', value: '/makatn/', dialectId: null, status: 'published' },
        ],
        images: [{ id: 'i1', url: 'https://img/1.jpg', altText: null, isPrimary: true, status: 'published' }],
        relatedWords: [{ wordId: 'w2', lemma: 'ngamakn', relationType: 'synonym' }],
        appearsIn: [{ wordId: 'w3', lemma: 'makanan', relationType: 'has_component' }],
        variants: [
          { id: 'v1', form: 'memakan', variantType: 'derivation', affixType: 'prefix', affixValue: 'me-', notes: null },
        ],
      },
    };

    const detail = normalizeContributionDetail(payload);
    expect(detail.entityType).toBe('word');
    const word = wordOf(detail)!;
    expect(word).toBeDefined();

    expect(word.lemma).toBe('makatn');
    expect(word.languageId).toBe(SBS_ID);
    expect(word.wordType).toBe('word');
    expect(word.status).toBe('published');
    expect(word.isVerified).toBe(false);

    expect(word.meanings).toHaveLength(1);
    expect(word.meanings[0]).toMatchObject({
      id: 'm1',
      wordClassId: WC_ID,
      wordClassName: 'Verba › Verba Transitif',
      definition: 'Aktivitas makan',
      orderIndex: 1,
      translations: [{ languageId: IDN_ID, text: 'makan', type: 'direct' }],
      examples: [
        { sourceLanguageId: SBS_ID, source: 'Kami udah makatn tadi.', target: 'Kami sudah makan tadi.', sourceType: 'native_speaker' },
      ],
    });

    expect(word.categories).toEqual([{ id: 'cat1', name: 'Makanan' }]);
    expect(word.pronunciations[0]).toMatchObject({ notation: 'ipa', value: '/makatn/', status: 'published' });
    expect(word.images[0]).toMatchObject({ url: 'https://img/1.jpg', isPrimary: true });
    expect(word.relatedWords).toEqual([{ wordId: 'w2', lemma: 'ngamakn', relationType: 'synonym' }]);
    expect(word.appearsIn).toEqual([{ wordId: 'w3', lemma: 'makanan', relationType: 'has_component' }]);
    expect(word.variants[0]).toMatchObject({
      form: 'memakan',
      variantType: 'derivation',
      affixType: 'prefix',
      affixValue: 'me-',
    });
  });
});

describe('normalizeContributionDetail - word (layout docs snake_case)', () => {
  it('membaca field datar snake_case + word_class terpisah', () => {
    const payload: ContributionDetailPayload = {
      contribution: listItem({}),
      review: null,
      entity: {
        id: 'w1',
        language_id: SBS_ID,
        lemma: 'makatn',
        word_type: 'idiom',
        status: 'published',
        is_verified: true,
        is_corrected: true,
        meanings: [
          {
            id: 'm1',
            word_class_id: WC_ID,
            word_class_name: 'Frasa',
            definition: 'Definisi docs',
            order_index: 2,
            translations: [
              { language_id: IDN_ID, translation_text: 'makan', translation_type: 'idiomatic' },
            ],
          },
        ],
      },
    };
    const word = wordOf(normalizeContributionDetail(payload))!;
    expect(word.wordType).toBe('idiom');
    expect(word.isVerified).toBe(true);
    expect(word.meanings[0]).toMatchObject({
      wordClassId: WC_ID,
      wordClassName: 'Frasa',
      orderIndex: 2,
      translations: [{ languageId: IDN_ID, text: 'makan', type: 'idiomatic' }],
    });
    expect(word.categories).toEqual([]);
    expect(word.relatedWords).toEqual([]);
  });
});

describe('normalizeContributionDetail - anak (pronunciation)', () => {
  it('layout impl: row + data bersarang', () => {
    const payload: ContributionDetailPayload = {
      contribution: listItem({ entity_type: 'pronunciation', entity_id: 'p1' }),
      review: null,
      entity: {
        id: 'p1',
        wordId: 'w1',
        wordLemma: 'makatn',
        data: { notation: 'ipa', value: '/makatn/', dialect_id: null, audio_url: null, speaker_name: 'Pak S', notes: null },
        status: 'pending_review',
        isVerified: false,
        isCorrected: false,
      },
    };
    const detail = normalizeContributionDetail(payload);
    expect(detail.entityType).toBe('pronunciation');
    expect(wordOf(detail)).toBeNull();
    expect(childOf(detail)!).toMatchObject({
      id: 'p1',
      wordId: 'w1',
      wordLemma: 'makatn',
      status: 'pending_review',
      isVerified: false,
      fields: { notation: 'ipa', value: '/makatn/', dialect_id: null, speaker_name: 'Pak S' },
    });
  });

  it('layout docs: field datar snake_case tanpa data', () => {
    const payload: ContributionDetailPayload = {
      contribution: listItem({ entity_type: 'pronunciation', entity_id: 'p1' }),
      review: null,
      entity: {
        id: 'p1',
        word_id: 'w1',
        word_lemma: 'makatn',
        notation: 'ipa',
        value: '/kanyang/',
        dialect_id: null,
        audio_url: null,
        speaker_name: null,
        status: 'pending_review',
        is_verified: false,
        is_corrected: false,
      },
    };
    const child = childOf(normalizeContributionDetail(payload))!;
    expect(child.fields).toMatchObject({ notation: 'ipa', value: '/kanyang/' });
    expect(child.wordLemma).toBe('makatn');
  });
});

describe('normalizeContributionDetail - anak (word_image & example)', () => {
  it('word_image: provider_file_id + is_primary', () => {
    const payload: ContributionDetailPayload = {
      contribution: listItem({ entity_type: 'word_image', entity_id: 'img1' }),
      review: null,
      entity: {
        id: 'img1',
        wordId: 'w1',
        wordLemma: 'beras',
        data: { url: 'https://img/beras.jpg', provider_file_id: 'file-1', alt_text: 'Beras', is_primary: true },
        status: 'pending_review',
        isVerified: false,
        isCorrected: false,
      },
    };
    const child = childOf(normalizeContributionDetail(payload))!;
    expect(child.fields).toMatchObject({
      url: 'https://img/beras.jpg',
      provider_file_id: 'file-1',
      alt_text: 'Beras',
      is_primary: true,
    });
  });

  it('example: source_type dipetakan', () => {
    const payload: ContributionDetailPayload = {
      contribution: listItem({ entity_type: 'example', entity_id: 'ex1' }),
      review: null,
      entity: {
        id: 'ex1',
        wordId: 'w1',
        wordLemma: 'makatn',
        data: {
          source_sentence: 'Kami udah makatn.',
          target_sentence: 'Kami sudah makan.',
          source_type: 'interview',
          notes: null,
        },
        status: 'pending_review',
        isVerified: false,
        isCorrected: false,
      },
    };
    const child = childOf(normalizeContributionDetail(payload))!;
    expect(child.fields).toMatchObject({
      source_sentence: 'Kami udah makatn.',
      target_sentence: 'Kami sudah makan.',
      source_type: 'interview',
    });
  });

  it('review tersedia saat sudah diputuskan', () => {
    const payload: ContributionDetailPayload = {
      contribution: listItem({ status: 'rejected' }),
      review: {
        reviewer_id: 'adm1',
        status: 'rejected',
        comment: 'Definisi kurang tepat',
        created_at: '2026-09-02T00:00:00.000Z',
      },
      entity: { id: 'w1', lemma: 'x', meanings: [] },
    };
    const detail = normalizeContributionDetail(payload);
    expect(detail.review?.comment).toBe('Definisi kurang tepat');
    expect(wordOf(detail)!.lemma).toBe('x');
  });
});