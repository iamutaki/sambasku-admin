import type { CreateWordRequest, RelationType } from './create-word';
import type { WordStatus, WordType } from './word';

/**
 * Model fitur "Edit Kata" - konsumen dua endpoint admin:
 * 1. GET /api/v1/admin/words/:id  → WordDetail (prefill form edit, semua status)
 * 2. PUT /api/v1/admin/words/:id  → UpdateWordRequest/UpdateWordResult
 *
 * Kontrak: docs/api/05-api-edit-kata.md. Bentuk detail SAMA dengan
 * GET /api/v1/words/:id (docs/api/01-api-tambah-kata.md) plus created_at /
 * updated_at dan status yang SELALU terisi (termasuk draft/pending_review/
 * rejected) - anak juga ikut semua status.
 *
 * CATATAN full-replace: PUT menghapus field yang tidak dikirim. UI wajib
 * mengirim ulang seluruh form hasil prefill GET - itu sebabnya mapper
 * wordDetailToFormValues mengembalikan SEMUA field (tidak ada yang ditiadakan).
 */

export interface WordDetailMeaningTranslation {
  language_id: string;
  translation_text: string;
  translation_type: string;
}

export interface WordDetailMeaningExample {
  id: string;
  source_language_id: string;
  source_sentence: string;
  target_language_id: string | null;
  target_sentence: string | null;
  source_type: string | null;
}

export interface WordDetailMeaning {
  id: string;
  word_class: { id: string; code: string; name: string; parent_id: string | null } | null;
  inherited_from_meaning_id: string | null;
  definition: string;
  order_index: number;
  translations: WordDetailMeaningTranslation[];
  examples: WordDetailMeaningExample[];
}

export interface WordDetailRelation {
  word_id: string;
  lemma: string;
  relation_type: string;
}

export interface WordDetailVariant {
  id: string;
  form: string;
  variant_type: string;
  affix_type: string | null;
  affix_value: string | null;
  dialect_id: string | null;
  notes: string | null;
}

export interface WordDetail {
  id: string;
  lemma: string;
  language_id: string;
  notes: string | null;
  word_type: WordType;
  status: WordStatus;
  is_verified: boolean;
  is_corrected: boolean;
  created_at: string;
  updated_at: string | null;
  meanings: WordDetailMeaning[];
  categories: { id: string; name: string }[];
  pronunciations: { id: string; notation: string; value: string; dialect_id: string | null }[];
  images: { id: string; url: string; provider_file_id: string; alt_text: string | null; is_primary: boolean }[];
  related_words: WordDetailRelation[];
  appears_in: WordDetailRelation[];
  variants: WordDetailVariant[];
}

/**
 * Body PUT /api/v1/admin/words/:id - FULL REPLACE. Bentuk sama dengan create
 * (docs/api/01-api-tambah-kata.md) dengan SATU pengecualian: related_words
 * HANYA Form A ({ relation_type, word_id }) - kreasi kata inline (Form B,
 * docs/api/04-api-sinonim-inline.md) ditolak backend pada endpoint edit.
 */
export type UpdateWordRequest = Omit<CreateWordRequest, 'related_words'> & {
  related_words: { relation_type: RelationType; word_id: string }[];
};

/** Response sukses update - `status` dari backend (approval gate verifier). */
export interface UpdateWordResult {
  word_id: string;
  lemma: string;
  word_type: WordType;
  status: WordStatus;
  is_verified: boolean;
  is_corrected: boolean;
  updated_at: string | null;
  warnings?: { field: string; message: string }[];
}