import { buildCreateWordBody } from '@/features/words/application/create-word-utils';
import type {
  AffixType,
  CreateWordFormValues,
  ExampleSourceType,
  RelationType,
  TranslationType,
  VariantType,
} from '@/features/words/domain/create-word';
import type { EntityType, WordEntityView } from '../domain/contribution';
import type {
  CorrectContributionRequest,
  CorrectExampleRequest,
  CorrectPronunciationRequest,
  CorrectWordImageRequest,
  CorrectWordRequest,
} from '../domain/correct-contribution';

/**
 * Helper murni form koreksi - ter-unit-test:
 * 1. `wordEntityToFormValues` - prefill form kata dari WordEntityView (detail)
 * 2. `buildCorrectWordBody`   - nilai form kata → body correct (replace semantics)
 * 3. builder per entity anak (pronunciation/word_image/example)
 *
 * Field opsional yang kosong/null TIDAK dikirim - kontrak API ketat (zod)
 * menolak `null` untuk field opsional seperti dialect_id/audio_url.
 */

export interface CorrectDecisionExtra {
  comment?: string;
  publish: boolean;
}

// ---- Prefill form kata ----

export function wordEntityToFormValues(view: WordEntityView): CreateWordFormValues {
  return {
    language_id: view.languageId ?? undefined,
    dialect_id: view.dialectId ?? undefined,
    lemma: view.lemma,
    ...(view.notes?.trim() ? { notes: view.notes } : {}),
    word_type: view.wordType,
    meanings: view.meanings.map((m) => ({
      word_class_id: m.wordClassId ?? undefined,
      definition: m.definition,
      order_index: m.orderIndex,
      translations: m.translations.map((t) => ({
        language_id: t.languageId,
        translation_text: t.text,
        translation_type: t.type as TranslationType,
      })),
      examples: m.examples.map((e) => ({
        source_language_id: e.sourceLanguageId ?? undefined,
        source_sentence: e.source,
        target_language_id: e.targetLanguageId ?? undefined,
        target_sentence: e.target ?? undefined,
        source_type: (e.sourceType as ExampleSourceType) ?? undefined,
      })),
    })),
    category_ids: view.categories.map((c) => c.id),
    related_words: view.relatedWords.map((rel) => ({
      relation_type: rel.relationType as RelationType,
      word_id: rel.wordId,
    })),
    variants: view.variants.map((v) => ({
      form: v.form,
      variant_type: v.variantType as VariantType,
      ...(v.affixType ? { affix_type: v.affixType as AffixType } : {}),
      ...(v.affixValue ? { affix_value: v.affixValue } : {}),
    })),
    pronunciation: view.pronunciations[0]
      ? { notation: view.pronunciations[0].notation, value: view.pronunciations[0].value }
      : undefined,
  };
}

// ---- Form value per entity anak (nama field = nama body API) ----

export interface CorrectPronunciationFormValues {
  notation?: string;
  value?: string;
  dialect_id?: string | null;
  audio_url?: string | null;
  speaker_name?: string | null;
  notes?: string | null;
}

export interface CorrectWordImageFormValues {
  url?: string;
  provider_file_id?: string;
  alt_text?: string | null;
  is_primary: boolean;
}

export interface CorrectExampleFormValues {
  source_sentence?: string;
  target_sentence?: string | null;
  source_type?: ExampleSourceType | null;
  notes?: string | null;
}

export type CorrectFormValues =
  | CreateWordFormValues
  | CorrectPronunciationFormValues
  | CorrectWordImageFormValues
  | CorrectExampleFormValues;

// ---- Builder body ----

export function buildCorrectWordBody(
  values: CreateWordFormValues,
  extra: CorrectDecisionExtra,
): CorrectWordRequest {
  // body kata = create-word penuh (replace semantics) TANPA status - status
  // hasil akhir ditentukan `publish` + approval gate di sisi server.
  const { status, ...word } = buildCreateWordBody(values, 'published');
  void status;
  return {
    entity_type: 'word',
    word,
    ...extraFields(extra),
  };
}

export function buildCorrectPronunciationBody(
  values: CorrectPronunciationFormValues,
  extra: CorrectDecisionExtra,
): CorrectPronunciationRequest {
  return {
    entity_type: 'pronunciation',
    notation: values.notation?.trim() || 'ipa',
    value: (values.value ?? '').trim(),
    ...(values.dialect_id ? { dialect_id: values.dialect_id } : {}),
    ...(values.audio_url?.trim() ? { audio_url: values.audio_url.trim() } : {}),
    ...(values.speaker_name?.trim() ? { speaker_name: values.speaker_name.trim() } : {}),
    ...(values.notes?.trim() ? { notes: values.notes.trim() } : {}),
    ...extraFields(extra),
  };
}

export function buildCorrectWordImageBody(
  values: CorrectWordImageFormValues,
  extra: CorrectDecisionExtra,
): CorrectWordImageRequest {
  return {
    entity_type: 'word_image',
    url: (values.url ?? '').trim(),
    provider_file_id: (values.provider_file_id ?? '').trim(),
    alt_text: values.alt_text?.trim() ? values.alt_text.trim() : undefined,
    is_primary: values.is_primary,
    ...extraFields(extra),
  };
}

export function buildCorrectExampleBody(
  values: CorrectExampleFormValues,
  extra: CorrectDecisionExtra,
): CorrectExampleRequest {
  return {
    entity_type: 'example',
    source_sentence: (values.source_sentence ?? '').trim(),
    target_sentence: values.target_sentence?.trim() ? values.target_sentence.trim() : undefined,
    ...(values.source_type ? { source_type: values.source_type } : {}),
    ...(values.notes?.trim() ? { notes: values.notes.trim() } : {}),
    ...extraFields(extra),
  };
}

/** Dispatcher - satu pintu untuk build body sesuai entity_type kontribusi. */
export function buildCorrectContribution(
  entityType: EntityType,
  values: CorrectFormValues,
  extra: CorrectDecisionExtra,
): CorrectContributionRequest {
  switch (entityType) {
    case 'word':
      return buildCorrectWordBody(values as CreateWordFormValues, extra);
    case 'pronunciation':
      return buildCorrectPronunciationBody(values as CorrectPronunciationFormValues, extra);
    case 'word_image':
      return buildCorrectWordImageBody(values as CorrectWordImageFormValues, extra);
    case 'example':
      return buildCorrectExampleBody(values as CorrectExampleFormValues, extra);
  }
}

function extraFields(extra: CorrectDecisionExtra): { comment?: string; publish: boolean } {
  return {
    publish: extra.publish,
    ...(extra.comment?.trim() ? { comment: extra.comment.trim() } : {}),
  };
}