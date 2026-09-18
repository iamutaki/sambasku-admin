import type { WordType } from '@/features/words/domain/word';
import type {
  ContributionDetailPayload,
  ContributionDetailView,
  ExampleChildData,
  PronunciationChildData,
  WordEntityView,
  WordImageChildData,
  WordMeaningExampleView,
  WordMeaningView,
  WordRelationView,
  WordVariantView,
} from '../domain/contribution';

type AnyRecord = Record<string, unknown>;

/**
 * Normalisasi payload detail kontribusi → view model untuk layar review.
 * MURNI (tanpa React/axios) - ter-unit-test.
 *
 * Payload entity polymorphic bisa hadir dalam dua bentuk karena drifting
 * kontrak (lihat catatan di domain/contribution.ts): WordDetail camelCase
 * atau bentuk documented snake_case. Mapper menerima keduanya.
 */

interface ChildEntityLike {
  id: string;
  wordId: string;
  wordLemma: string | null;
  meaningId?: string;
  status: string;
  isVerified: boolean;
  isCorrected: boolean;
  fields: PronunciationChildData | WordImageChildData | ExampleChildData;
}

export function normalizeContributionDetail(payload: ContributionDetailPayload): ContributionDetailView {
  const { contribution, review, entity } = payload;

  if (contribution.entity_type === 'word') {
    return {
      contribution,
      review,
      entityType: 'word',
      word: normalizeWordEntity(entity),
      rawEntity: entity,
    };
  }

  return {
    contribution,
    review,
    entityType: contribution.entity_type,
    child: normalizeChildEntity(contribution.entity_type, entity),
    rawEntity: entity,
  };
}

function toRecord(value: unknown): AnyRecord {
  return value && typeof value === 'object' ? (value as AnyRecord) : {};
}

/** Nilai pertama yang terdefinisi non-null dari kunci (camelCase/snake_case). */
function pickDefined(obj: AnyRecord, keys: string[]): unknown {
  for (const key of keys) {
    const value = obj[key];
    if (value !== undefined && value !== null) return value;
  }
  return undefined;
}

function asString(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  return String(value);
}

function normalizeWordEntity(raw: unknown): WordEntityView {
  const r = toRecord(raw);

  const meanings = Array.isArray(r.meanings) ? r.meanings.map(normalizeMeaning) : [];
  const categories = Array.isArray(r.categories)
    ? r.categories.map((c) => {
        const cr = toRecord(c);
        return { id: String(cr.id ?? cr.name ?? ''), name: String(cr.name ?? '') };
      })
    : [];
  const pronunciations = Array.isArray(r.pronunciations)
    ? r.pronunciations.map((p) => {
        const pr = toRecord(p);
        return {
          id: String(pickDefined(pr, ['id']) ?? ''),
          notation: String(pickDefined(pr, ['notation']) ?? 'ipa'),
          value: String(pickDefined(pr, ['value']) ?? ''),
          dialectId: asString(pickDefined(pr, ['dialect_id', 'dialectId'])),
          status: asString(pickDefined(pr, ['status'])) ?? undefined,
        };
      })
    : [];
  const images = Array.isArray(r.images)
    ? r.images.map((img) => {
        const ir = toRecord(img);
        return {
          id: String(pickDefined(ir, ['id']) ?? ''),
          url: String(pickDefined(ir, ['url']) ?? ''),
          altText: asString(pickDefined(ir, ['alt_text', 'altText'])),
          isPrimary: Boolean(pickDefined(ir, ['is_primary', 'isPrimary']) ?? false),
          status: asString(pickDefined(ir, ['status'])) ?? undefined,
        };
      })
    : [];
  const variants = Array.isArray(r.variants) ? r.variants.map(normalizeVariant) : [];

  return {
    id: String(pickDefined(r, ['id']) ?? ''),
    languageId: asString(pickDefined(r, ['language_id', 'languageId'])),
    dialectId: asString(pickDefined(r, ['dialect_id', 'dialectId'])),
    lemma: String(pickDefined(r, ['lemma']) ?? ''),
    wordType: (pickDefined(r, ['word_type', 'wordType']) as WordType) ?? 'word',
    status: String(pickDefined(r, ['status']) ?? ''),
    notes: asString(pickDefined(r, ['notes'])),
    isVerified: Boolean(pickDefined(r, ['is_verified', 'isVerified']) ?? false),
    isCorrected: Boolean(pickDefined(r, ['is_corrected', 'isCorrected']) ?? false),
    meanings,
    categories,
    pronunciations,
    images,
    relatedWords: normalizeRelations(pickDefined(r, ['related_words', 'relatedWords'])),
    appearsIn: normalizeRelations(pickDefined(r, ['appears_in', 'appearsIn'])),
    variants,
  };
}

function normalizeMeaning(raw: unknown): WordMeaningView {
  const m = toRecord(raw);
  // word_class bisa objek {id, name} (impl) atau field datar word_class_id/name
  const wordClass = toRecord(pickDefined(m, ['word_class', 'wordClass']));
  const wordClassId =
    asString(wordClass.id) ?? asString(pickDefined(m, ['word_class_id', 'wordClassId']));
  const wordClassName =
    asString(wordClass.name) ??
    asString(pickDefined(m, ['word_class_name', 'wordClassName']));
  const translations = Array.isArray(m.translations)
    ? m.translations.map((t) => {
        const tr = toRecord(t);
        return {
          languageId: String(pickDefined(tr, ['language_id', 'languageId']) ?? ''),
          text: String(pickDefined(tr, ['translation_text', 'translationText']) ?? ''),
          type: String(pickDefined(tr, ['translation_type', 'translationType']) ?? 'direct'),
        };
      })
    : [];
  const examples = Array.isArray(m.examples) ? m.examples.map(normalizeExample) : [];

  return {
    id: String(pickDefined(m, ['id']) ?? ''),
    wordClassId,
    wordClassName,
    definition: String(pickDefined(m, ['definition']) ?? ''),
    orderIndex: Number(pickDefined(m, ['order_index', 'orderIndex']) ?? 0),
    translations,
    examples,
  };
}

function normalizeExample(raw: unknown): WordMeaningExampleView {
  const e = toRecord(raw);
  return {
    sourceLanguageId: asString(pickDefined(e, ['source_language_id', 'sourceLanguageId'])),
    source: String(pickDefined(e, ['source_sentence', 'sourceSentence']) ?? ''),
    targetLanguageId: asString(pickDefined(e, ['target_language_id', 'targetLanguageId'])),
    target: asString(pickDefined(e, ['target_sentence', 'targetSentence'])),
    sourceType: asString(pickDefined(e, ['source_type', 'sourceType'])),
  };
}

function normalizeRelations(raw: unknown): WordRelationView[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((rel) => {
    const rr = toRecord(rel);
    return {
      wordId: String(pickDefined(rr, ['word_id', 'wordId']) ?? ''),
      lemma: String(pickDefined(rr, ['lemma']) ?? ''),
      relationType: String(pickDefined(rr, ['relation_type', 'relationType']) ?? ''),
    };
  });
}

function normalizeVariant(raw: unknown): WordVariantView {
  const v = toRecord(raw);
  return {
    id: String(pickDefined(v, ['id']) ?? ''),
    form: String(pickDefined(v, ['form']) ?? ''),
    variantType: String(pickDefined(v, ['variant_type', 'variantType']) ?? 'alternative'),
    affixType: asString(pickDefined(v, ['affix_type', 'affixType'])),
    affixValue: asString(pickDefined(v, ['affix_value', 'affixValue'])),
    notes: asString(pickDefined(v, ['notes'])),
  };
}

const CHILD_FIELD_KEYS = {
  pronunciation: ['notation', 'value', 'dialect_id', 'audio_url', 'speaker_name', 'notes'],
  word_image: ['provider', 'provider_file_id', 'url', 'alt_text', 'is_primary'],
  example: ['source_sentence', 'target_sentence', 'source_type', 'notes'],
} as const;

type ChildFieldKey = (typeof CHILD_FIELD_KEYS)[keyof typeof CHILD_FIELD_KEYS][number];

function normalizeChildEntity(
  entityType: 'pronunciation' | 'word_image' | 'example',
  raw: unknown,
): ChildEntityLike {
  const r = toRecord(raw);
  const data = toRecord(pickDefined(r, ['data']));

  // Gabungkan matriks `data` (impl) + field datar (docs) - impl menang.
  const matrix: Record<string, unknown> = { ...pickFields(r, CHILD_FIELD_KEYS[entityType]), ...data };

  const wordId = String(pickDefined(r, ['wordId', 'word_id']) ?? '');
  const wordLemma = asString(pickDefined(r, ['wordLemma', 'word_lemma']));
  const meaningId = asString(pickDefined(r, ['meaningId', 'meaning_id'])) ?? undefined;
  const isVerified = Boolean(pickDefined(r, ['isVerified', 'is_verified']) ?? false);
  const isCorrected = Boolean(pickDefined(r, ['isCorrected', 'is_corrected']) ?? false);

  const base = {
    id: String(pickDefined(r, ['id']) ?? ''),
    wordId,
    wordLemma,
    ...(meaningId ? { meaningId } : {}),
    status: String(pickDefined(r, ['status']) ?? ''),
    isVerified,
    isCorrected,
  };

  if (entityType === 'pronunciation') {
    const fields: PronunciationChildData = {
      notation: String(pickDefined(matrix, ['notation']) ?? 'ipa'),
      value: String(pickDefined(matrix, ['value']) ?? ''),
      dialect_id: asString(pickDefined(matrix, ['dialect_id'])),
      audio_url: asString(pickDefined(matrix, ['audio_url'])),
      speaker_name: asString(pickDefined(matrix, ['speaker_name'])),
      notes: asString(pickDefined(matrix, ['notes'])),
    };
    return { ...base, fields };
  }

  if (entityType === 'word_image') {
    const fields: WordImageChildData = {
      provider: asString(pickDefined(matrix, ['provider'])),
      provider_file_id: String(pickDefined(matrix, ['provider_file_id']) ?? ''),
      url: String(pickDefined(matrix, ['url']) ?? ''),
      alt_text: asString(pickDefined(matrix, ['alt_text'])),
      is_primary: Boolean(pickDefined(matrix, ['is_primary']) ?? false),
    };
    return { ...base, fields };
  }

  const fields: ExampleChildData = {
    source_sentence: String(pickDefined(matrix, ['source_sentence']) ?? ''),
    target_sentence: asString(pickDefined(matrix, ['target_sentence'])),
    source_type: asString(pickDefined(matrix, ['source_type'])),
    notes: asString(pickDefined(matrix, ['notes'])),
  };
  return { ...base, fields };
}

function pickFields(obj: AnyRecord, keys: readonly ChildFieldKey[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    const value = obj[key];
    if (value !== undefined) out[key] = value;
  }
  return out;
}