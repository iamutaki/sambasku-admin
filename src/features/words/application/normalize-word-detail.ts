import { WORD_STATUSES, WORD_TYPES } from '../domain/word';
import type {
  WordDetail,
  WordDetailAudio,
  WordDetailMeaning,
  WordDetailMeaningExample,
  WordDetailRelation,
  WordDetailVariant,
} from '../domain/word-detail';

/**
 * GET /admin/words/:id kadang mengirim null pada kolom teks opsional
 * (notes, target_sentence, target_language_id, source_type, definition).
 * Tanpa normalisasi, `.trim()` / akses array di halaman detail melempar.
 * Field yang boleh kosong tetap null; array yang hilang jadi [].
 */
export function normalizeWordDetail(raw: unknown): WordDetail {
  const word = record(raw) ?? {};
  return {
    id: strOr(word.id),
    lemma: strOr(word.lemma),
    language_id: strOr(word.language_id),
    notes: str(word.notes),
    word_type: enumOr(word.word_type, WORD_TYPES, 'word'),
    status: enumOr(word.status, WORD_STATUSES, 'draft'),
    is_verified: bool(word.is_verified),
    is_corrected: bool(word.is_corrected),
    self_verified: bool(word.self_verified),
    created_by: verifier(word.created_by),
    verified_by: verifier(word.verified_by),
    verified_at: str(word.verified_at),
    created_at: strOr(word.created_at),
    updated_at: str(word.updated_at),
    takedown_reason_code: str(word.takedown_reason_code),
    takedown_note: str(word.takedown_note),
    taken_down_at: str(word.taken_down_at),
    meanings: list(word.meanings).map(meaning),
    categories: list(word.categories).map((item) => {
      const category = record(item) ?? {};
      return { id: strOr(category.id), name: strOr(category.name) };
    }),
    pronunciations: list(word.pronunciations).map((item) => {
      const pronunciation = record(item) ?? {};
      return {
        id: strOr(pronunciation.id),
        notation: strOr(pronunciation.notation),
        value: strOr(pronunciation.value),
        dialect_id: str(pronunciation.dialect_id),
      };
    }),
    audios: list(word.audios).flatMap(audio),
    images: list(word.images).map((item) => {
      const image = record(item) ?? {};
      return {
        id: strOr(image.id),
        url: strOr(image.url),
        provider_file_id: strOr(image.provider_file_id),
        sha: str(image.sha),
        alt_text: str(image.alt_text),
        is_primary: bool(image.is_primary),
      };
    }),
    related_words: list(word.related_words).map(relation),
    appears_in: list(word.appears_in).map(relation),
    variants: list(word.variants).map(variant),
  };
}

function meaning(raw: unknown): WordDetailMeaning {
  const item = record(raw) ?? {};
  const wordClass = record(item.word_class);
  return {
    id: strOr(item.id),
    word_class:
      wordClass && str(wordClass.id)
        ? {
            id: strOr(wordClass.id),
            code: strOr(wordClass.code),
            name: strOr(wordClass.name),
            alias: str(wordClass.alias),
            parent_id: str(wordClass.parent_id),
          }
        : null,
    inherited_from_meaning_id: str(item.inherited_from_meaning_id),
    definition: str(item.definition),
    order_index: intOr(item.order_index, 0),
    translations: list(item.translations).map((entry) => {
      const translation = record(entry) ?? {};
      return {
        language_id: strOr(translation.language_id),
        translation_text: strOr(translation.translation_text),
        translation_type: strOr(translation.translation_type, 'direct'),
      };
    }),
    examples: list(item.examples).map(example),
  };
}

function example(raw: unknown): WordDetailMeaningExample {
  const item = record(raw) ?? {};
  return {
    id: strOr(item.id),
    source_language_id: strOr(item.source_language_id),
    source_sentence: strOr(item.source_sentence),
    target_language_id: str(item.target_language_id),
    target_sentence: str(item.target_sentence),
    source_type: str(item.source_type),
    audios: list(item.audios).flatMap(audio),
  };
}

function audio(raw: unknown): WordDetailAudio[] {
  const item = record(raw);
  if (!item) return [];
  const id = str(item.id);
  const url = str(item.url);
  if (!id || !url) return [];
  return [
    {
      id,
      url,
      dialect_id: str(item.dialect_id),
      speaker_name: str(item.speaker_name),
      duration_ms: intOrNull(item.duration_ms),
      is_primary: bool(item.is_primary),
      mime_type: strOr(item.mime_type),
      ...(typeof item.file_size === 'number' ? { file_size: item.file_size } : {}),
      ...(typeof item.status === 'string' ? { status: item.status } : {}),
      example_id: str(item.example_id),
    },
  ];
}

function relation(raw: unknown): WordDetailRelation {
  const item = record(raw) ?? {};
  return {
    word_id: strOr(item.word_id),
    lemma: strOr(item.lemma),
    relation_type: strOr(item.relation_type),
  };
}

function variant(raw: unknown): WordDetailVariant {
  const item = record(raw) ?? {};
  return {
    id: strOr(item.id),
    form: strOr(item.form),
    variant_type: strOr(item.variant_type, 'alternative'),
    affix_type: str(item.affix_type),
    affix_value: str(item.affix_value),
    dialect_id: str(item.dialect_id),
    notes: str(item.notes),
  };
}

function verifier(raw: unknown): WordDetail['verified_by'] {
  const item = record(raw);
  if (!item) return null;
  const username = str(item.username);
  const role = str(item.role);
  if (!username || !role) return null;
  return { username, role };
}

function record(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/** String sungguhan, termasuk string kosong. Null / tipe lain → null. */
function str(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function strOr(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function bool(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function intOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : null;
}

function intOr(value: unknown, fallback: number): number {
  return intOrNull(value) ?? fallback;
}

function enumOr<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}
