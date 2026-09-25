import { USAGE_LABELS, type UsageLabel, type WordType } from '@/features/words/domain/word';
import type {
  ContributionDetailPayload,
  ContributionDetailView,
  ExampleChildData,
  PronunciationChildData,
  WordEntityView,
  WordAudioChildData,
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
  fields: PronunciationChildData | WordImageChildData | WordAudioChildData | ExampleChildData;
}

export function normalizeContributionDetail(payload: ContributionDetailPayload): ContributionDetailView {
  const contribution = normalizeContributionMeta(payload?.contribution);
  const review = payload?.review ?? null;
  const entity = payload?.entity;

  if (contribution.entity_type === 'word') {
    return {
      contribution,
      review,
      entityType: 'word',
      word: normalizeWordEntity(entity),
      rawEntity: entity,
    };
  }

  // Anak: pronunciation | word_image | word_audio | example (dan tipe API
  // lain yang belum ada di EntityType admin — tetap dinormalisasi aman).
  const childType = contribution.entity_type;
  return {
    contribution,
    review,
    entityType: childType,
    child: normalizeChildEntity(childType, entity),
    rawEntity: entity,
  };
}

/**
 * Meta kontribusi toleran snake_case (wire) + camelCase (jika ada transform).
 * Tanpa ini, `entity_type` undefined → CHILD_FIELD_KEYS[undefined] →
 * "keys is not iterable" (di bundle minify: "t is not iterable").
 */
function normalizeContributionMeta(
  raw: ContributionDetailPayload['contribution'] | null | undefined,
): ContributionDetailPayload['contribution'] {
  const r = toRecord(raw);
  const entityType = String(
    pickDefined(r, ['entity_type', 'entityType']) ?? 'word',
  ) as ContributionDetailPayload['contribution']['entity_type'];

  return {
    id: String(pickDefined(r, ['id']) ?? ''),
    user_id: String(pickDefined(r, ['user_id', 'userId']) ?? ''),
    contributor_username: String(
      pickDefined(r, ['contributor_username', 'contributorUsername']) ?? '',
    ),
    entity_type: entityType,
    entity_id: String(pickDefined(r, ['entity_id', 'entityId']) ?? ''),
    action: String(pickDefined(r, ['action']) ?? ''),
    status: (pickDefined(r, ['status']) as ContributionDetailPayload['contribution']['status']) ?? 'pending',
    created_at: String(pickDefined(r, ['created_at', 'createdAt']) ?? ''),
    word_lemma: asString(pickDefined(r, ['word_lemma', 'wordLemma'])),
    search_miss_id: asString(pickDefined(r, ['search_miss_id', 'searchMissId'])) ?? undefined,
    search_miss_term: asString(pickDefined(r, ['search_miss_term', 'searchMissTerm'])) ?? undefined,
    search_miss_direction:
      (pickDefined(r, ['search_miss_direction', 'searchMissDirection']) as
        | ContributionDetailPayload['contribution']['search_miss_direction']
        | undefined) ?? undefined,
  };
}

function toRecord(value: unknown): AnyRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as AnyRecord) : {};
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
          provider: asString(pickDefined(ir, ['provider'])),
          isVerified: Boolean(pickDefined(ir, ['is_verified', 'isVerified']) ?? false),
        };
      })
    : [];
  const variants = Array.isArray(r.variants) ? r.variants.map(normalizeVariant) : [];
  const rawUsageLabels = pickDefined(r, ['usage_labels', 'usageLabels']);
  const usageLabels = Array.isArray(rawUsageLabels)
    ? rawUsageLabels
        .map((code) => String(code))
        .filter((code): code is UsageLabel => (USAGE_LABELS as readonly string[]).includes(code))
    : [];

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
    usageLabels,
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
  word_audio: [
    'word_id',
    'example_id',
    'url',
    'speaker_name',
    'dialect_id',
    'is_primary',
    'duration_ms',
    'mime_type',
    'file_size',
  ],
  example: ['source_sentence', 'target_sentence', 'source_type', 'notes'],
} as const;

function normalizeChildEntity(entityType: string, raw: unknown): ChildEntityLike {
  const r = toRecord(raw);
  // `data` bisa object (impl) atau hilang (docs datar). Array/primitive → {}.
  const dataRaw = pickDefined(r, ['data']);
  const data =
    dataRaw && typeof dataRaw === 'object' && !Array.isArray(dataRaw)
      ? (dataRaw as AnyRecord)
      : {};

  // Gabungkan matriks `data` (impl) + field datar (docs) - impl menang.
  // fieldKeysFor selalu mengembalikan array (tidak pernah undefined) supaya
  // `for…of` tidak melempar "keys/t is not iterable".
  const matrix: Record<string, unknown> = { ...pickFields(r, fieldKeysFor(entityType)), ...data };

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
      dialect_id: asString(pickDefined(matrix, ['dialect_id', 'dialectId'])),
      audio_url: asString(pickDefined(matrix, ['audio_url', 'audioUrl'])),
      speaker_name: asString(pickDefined(matrix, ['speaker_name', 'speakerName'])),
      notes: asString(pickDefined(matrix, ['notes'])),
    };
    return { ...base, fields };
  }

  if (entityType === 'word_image') {
    const fields: WordImageChildData = {
      provider: asString(pickDefined(matrix, ['provider'])),
      provider_file_id: String(pickDefined(matrix, ['provider_file_id', 'providerFileId']) ?? ''),
      url: String(pickDefined(matrix, ['url']) ?? ''),
      alt_text: asString(pickDefined(matrix, ['alt_text', 'altText'])),
      is_primary: Boolean(pickDefined(matrix, ['is_primary', 'isPrimary']) ?? false),
    };
    return { ...base, fields };
  }

  if (entityType === 'word_audio') {
    const durationRaw = pickDefined(matrix, ['duration_ms', 'durationMs']);
    const fileSizeRaw = pickDefined(matrix, ['file_size', 'fileSize']);
    const fields: WordAudioChildData = {
      word_id: String(pickDefined(matrix, ['word_id', 'wordId']) ?? wordId),
      example_id: asString(pickDefined(matrix, ['example_id', 'exampleId'])),
      url: String(pickDefined(matrix, ['url']) ?? ''),
      speaker_name: asString(pickDefined(matrix, ['speaker_name', 'speakerName'])),
      dialect_id: asString(pickDefined(matrix, ['dialect_id', 'dialectId'])),
      is_primary: Boolean(pickDefined(matrix, ['is_primary', 'isPrimary']) ?? false),
      duration_ms:
        durationRaw === undefined || durationRaw === null ? null : Number(durationRaw),
      mime_type: asString(pickDefined(matrix, ['mime_type', 'mimeType'])),
      file_size:
        fileSizeRaw === undefined || fileSizeRaw === null ? null : Number(fileSizeRaw),
    };
    return { ...base, fields };
  }

  // example + fallback tipe tidak dikenal (mis. meaning) — jangan throw.
  const fields: ExampleChildData = {
    source_sentence: String(
      pickDefined(matrix, ['source_sentence', 'sourceSentence', 'definition']) ?? '',
    ),
    target_sentence: asString(pickDefined(matrix, ['target_sentence', 'targetSentence'])),
    source_type: asString(pickDefined(matrix, ['source_type', 'sourceType'])),
    notes: asString(pickDefined(matrix, ['notes'])),
  };
  return { ...base, fields };
}

/** Kunci field per entity_type — selalu array (kosong jika tipe tidak dikenal). */
function fieldKeysFor(entityType: string): readonly string[] {
  switch (entityType) {
    case 'pronunciation':
      return CHILD_FIELD_KEYS.pronunciation;
    case 'word_image':
      return CHILD_FIELD_KEYS.word_image;
    case 'word_audio':
      return CHILD_FIELD_KEYS.word_audio;
    case 'example':
      return CHILD_FIELD_KEYS.example;
    default:
      return [];
  }
}

function pickFields(obj: AnyRecord, keys: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!Array.isArray(keys)) return out;
  for (const key of keys) {
    const value = obj[key];
    if (value !== undefined) out[key] = value;
  }
  return out;
}