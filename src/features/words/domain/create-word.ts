import type { WordStatus, WordType } from './word';

/**
 * Model fitur "Tambah Kata Baru" — kontrak POST /api/v1/admin/words
 * (docs/api/01-api-tambah-kata.md + create-word.validator.ts) dan data
 * referensi dropdown (languages/dialects/word-classes/categories).
 * Nilai enum mengikuti konvensi snake_case JSON API, BUKAN label UI.
 */

export const TRANSLATION_TYPES = ['direct', 'descriptive', 'idiomatic'] as const;
export type TranslationType = (typeof TRANSLATION_TYPES)[number];

export const RELATION_TYPES = ['synonym', 'antonym', 'has_component', 'derived_from'] as const;
export type RelationType = (typeof RELATION_TYPES)[number];

export const VARIANT_TYPES = ['inflection', 'derivation', 'alternative', 'reduplication'] as const;
export type VariantType = (typeof VARIANT_TYPES)[number];

export const AFFIX_TYPES = ['prefix', 'suffix', 'circumfix', 'reduplication'] as const;
export type AffixType = (typeof AFFIX_TYPES)[number];

export const EXAMPLE_SOURCE_TYPES = ['native_speaker', 'book', 'corpus', 'interview', 'other'] as const;
export type ExampleSourceType = (typeof EXAMPLE_SOURCE_TYPES)[number];

export const TRANSLATION_TYPE_LABELS: Record<TranslationType, string> = {
  direct: 'Langsung',
  descriptive: 'Deskriptif',
  idiomatic: 'Idiomatik',
};

export const RELATION_TYPE_LABELS: Record<RelationType, string> = {
  synonym: 'Sinonim',
  antonym: 'Antonim',
  has_component: 'Kata pembentuk',
  derived_from: 'Turunan dari',
};

export const VARIANT_TYPE_LABELS: Record<VariantType, string> = {
  inflection: 'Fleksi',
  derivation: 'Turunan',
  alternative: 'Alternatif',
  reduplication: 'Pengulangan',
};

export const AFFIX_TYPE_LABELS: Record<AffixType, string> = {
  prefix: 'Awalan',
  suffix: 'Akhiran',
  circumfix: 'Afiks ganda',
  reduplication: 'Pengulangan',
};

export const EXAMPLE_SOURCE_LABELS: Record<ExampleSourceType, string> = {
  native_speaker: 'Penutur Asli',
  book: 'Buku',
  corpus: 'Korpus',
  interview: 'Wawancara',
  other: 'Lainnya',
};

// ---- Data referensi dropdown (semua GET publik) ----
export interface LanguageOption {
  id: string;
  code: string;
  name: string;
  native_name: string | null;
  is_active: boolean;
}

export interface DialectOption {
  id: string;
  language_id: string;
  code: string;
  name: string;
  is_active: boolean;
}

export interface WordClassOption {
  id: string;
  code: string;
  name: string;
  parent_id: string | null;
}

export interface CategoryOption {
  id: string;
  name: string;
  description: string | null;
  parent_id: string | null;
}

// ---- Request body POST /api/v1/admin/words (create-word.validator.ts) ----
export interface CreateWordRequestTranslation {
  language_id: string;
  translation_text: string;
  translation_type: TranslationType;
}

export interface CreateWordRequestExample {
  source_language_id: string;
  source_sentence: string;
  target_language_id?: string;
  target_sentence?: string;
  source_type?: ExampleSourceType;
}

export interface CreateWordRequestMeaning {
  word_class_id: string;
  definition: string;
  order_index: number;
  translations: CreateWordRequestTranslation[];
  examples?: CreateWordRequestExample[];
}

export interface CreateWordRequestRelated {
  word_id: string;
  relation_type: RelationType;
}

export interface CreateWordRequestVariant {
  form: string;
  variant_type: VariantType;
  affix_type?: AffixType;
  affix_value?: string;
}

export interface CreateWordRequest {
  language_id: string;
  dialect_id?: string;
  lemma: string;
  notes?: string;
  word_type: WordType;
  meanings: CreateWordRequestMeaning[];
  category_ids: string[];
  related_words: CreateWordRequestRelated[];
  variants?: CreateWordRequestVariant[];
  pronunciation?: { notation: string; value: string };
  status: 'draft' | 'published';
}

/** Response sukses create — `status` dari backend = sumber kebenaran akhir
 * (approval gate: contributor "published" → "pending_review"). */
export interface CreateWordResult {
  word_id: string;
  lemma: string;
  word_type: WordType;
  status: WordStatus;
  is_verified: boolean;
  created_at: string;
  warnings?: { field: string; message: string }[];
}

// ---- Model nilai form antd (snake_case untuk mapping langsung ke body) ----
export interface CreateWordTranslationFormValue {
  language_id?: string;
  translation_text?: string;
  translation_type?: TranslationType;
}

export interface CreateWordExampleFormValue {
  source_language_id?: string;
  source_sentence?: string;
  target_language_id?: string;
  target_sentence?: string;
  source_type?: ExampleSourceType;
}

export interface CreateWordMeaningFormValue {
  word_class_id?: string;
  definition?: string;
  order_index?: number;
  translations?: CreateWordTranslationFormValue[];
  examples?: CreateWordExampleFormValue[];
}

export interface CreateWordRelatedFormValue {
  word_id?: string;
  relation_type?: RelationType;
}

export interface CreateWordVariantFormValue {
  form?: string;
  variant_type?: VariantType;
  affix_type?: AffixType;
  affix_value?: string;
}

export interface CreateWordFormValues {
  language_id?: string;
  dialect_id?: string;
  lemma?: string;
  notes?: string;
  word_type?: WordType;
  meanings?: CreateWordMeaningFormValue[];
  category_ids?: string[];
  related_words?: CreateWordRelatedFormValue[];
  variants?: CreateWordVariantFormValue[];
  pronunciation?: { notation?: string; value?: string };
}