import type { WordStatus, WordType } from './word';

/**
 * Model fitur "Tambah Kata Baru" - kontrak POST /api/v1/admin/words
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
  alternative: 'Ejaan Alternatif',
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
  /** True = pilihan default form (biasanya code=umum). */
  is_default: boolean;
}

export interface WordClassOption {
  id: string;
  code: string;
  name: string;
  /** Nama umum yang lebih dikenal user (Verba → "Kata Kerja") */
  alias: string | null;
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
  is_have_definition?: boolean;
  is_have_translation?: boolean;
  translations: CreateWordRequestTranslation[];
  examples?: CreateWordRequestExample[];
}

/**
 * 04-api-sinonim-inline.md - override SATU PER SATU atas makna hasil
 * salinan (inherit makna induk). translate-and-replace: field yang TIDAK
 * disebut tetap memakai hasil salinan; translations/examples = replace total.
 */
export interface MeaningOverrideRequest {
  /** indeks 0-based makna INDUK yang dimodifikasi (di dalam body meanings) */
  meaning_index: number;
  definition?: string;
  word_class_id?: string;
  translations?: CreateWordRequestTranslation[];
  examples?: CreateWordRequestExample[];
}

/**
 * 04-api-sinonim-inline.md - kata baru yang dibuat INLINE (Form B).
 * subset CreateWordRequest + inherit_meanings.
 */
export interface InlineWordRequest {
  lemma: string;
  notes?: string;
  word_type?: WordType;
  category_ids?: string[];
  /** DEFAULT true - ikut definisi induk (disalin materialized oleh server) */
  inherit_meanings?: boolean;
  /** hanya sah saat inherit_meanings=true; indeks mengacu makna induk */
  meaning_overrides?: MeaningOverrideRequest[];
  /** wajib DAN hanya saat inherit_meanings=false */
  meanings?: CreateWordRequestMeaning[];
  variants?: CreateWordRequestVariant[];
  pronunciation?: { notation: string; value: string };
  /** default: ikut status yang dikirim di body induk */
  status?: 'draft' | 'published';
}

/**
 * 04-api-sinonim-inline.md - DUA bentuk per item related_words (union):
 * Form A = tautkan ke kata SUDAH ada (01); Form B = buat kata baru INLINE.
 * Tepat satu bentuk per item - validator backend yang memastikan.
 */
export type CreateWordRequestRelated =
  | { relation_type: RelationType; word_id: string }
  | { relation_type: RelationType; word: InlineWordRequest };

export interface CreateWordRequestVariant {
  form: string;
  variant_type: VariantType;
  affix_type?: AffixType;
  affix_value?: string;
}

/** Satu gambar di images[] create/update (hasil direct-upload ke CDN). */
export interface WordImageInput {
  url: string;
  provider_file_id: string;
  alt_text?: string;
  is_primary?: boolean;
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
  images?: WordImageInput[];
  status: 'draft' | 'published';
  /** Provenance jalur search-miss (12-api) */
  search_miss_id?: string;
}

/** Hasil kata inline (Form B) dari backend - untuk summary di toast sukses. */
export interface InlineCreatedWordResult {
  word_id: string;
  lemma: string;
  relation_type: RelationType;
  word_type: WordType;
  status: WordStatus;
  is_verified: boolean;
  meanings_count: number;
  inherited_meanings_count: number;
  overridden_meanings_count: number;
  warnings?: { field: string; message: string }[];
}

/** Response sukses create - `status` dari backend = sumber kebenaran akhir
 * (approval gate: contributor "published" → "pending_review"). */
export interface CreateWordResult {
  word_id: string;
  lemma: string;
  word_type: WordType;
  status: WordStatus;
  is_verified: boolean;
  created_at: string;
  warnings?: { field: string; message: string }[];
  inline_created_words?: InlineCreatedWordResult[];
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
  /** both | definition_only | padanan_only - unset = belum dipilih di UI */
  meaning_completeness?: 'both' | 'definition_only' | 'padanan_only';
  is_have_definition?: boolean;
  is_have_translation?: boolean;
  translations?: CreateWordTranslationFormValue[];
  examples?: CreateWordExampleFormValue[];
}

/** Bentuk entri item relasi di UI - dipakai tombol pemilah Form A/B. */
export type RelatedWordMode = 'link' | 'inline';

export interface MeaningOverrideFormValue {
  /** indeks makna induk (posisi di daftar "Makan / Arti" form, 0-based) */
  meaning_index?: number;
  definition?: string;
  word_class_id?: string;
  translations?: CreateWordTranslationFormValue[];
  examples?: CreateWordExampleFormValue[];
}

export interface InlineWordFormValue {
  lemma?: string;
  notes?: string;
  word_type?: WordType;
  /** default true (true = ikut definisi induk) */
  inherit_meanings?: boolean;
  /** hanya saat inherit_meanings=true */
  meaning_overrides?: MeaningOverrideFormValue[];
  /** hanya saat inherit_meanings=false */
  meanings?: CreateWordMeaningFormValue[];
  variants?: CreateWordVariantFormValue[];
  pronunciation?: { notation?: string; value?: string };
}

/** Model nilai form item related_words - `mode` internal UI (tidak dikirim
 * ke body); Form A punya word_id, Form B punya word. */
export interface CreateWordRelatedFormValue {
  relation_type?: RelationType;
  mode?: RelatedWordMode;
  word_id?: string;
  word?: InlineWordFormValue;
}

export interface CreateWordVariantFormValue {
  form?: string;
  variant_type?: VariantType;
  affix_type?: AffixType;
  affix_value?: string;
}

/**
 * Item gambar di form - field status/uid/fileName adalah state UI (tidak
 * dikirim ke body; lihat buildImages). url + provider_file_id baru terisi
 * setelah direct-upload selesai, atau langsung terisi saat prefill edit
 * (gambar existing dari detail).
 */
export type WordImageUploadStatus = 'uploading' | 'done' | 'error';

export interface WordImageFormValue {
  uid: string;
  fileName?: string;
  status?: WordImageUploadStatus;
  url?: string;
  provider_file_id?: string;
  alt_text?: string;
  is_primary?: boolean;
  /** Blob URL preview file lokal - UI only (sebelum/Failed upload), tidak ikut submit. */
  localUrl?: string;
  /** Persen progres upload 0-100 - UI only, tidak ikut submit. */
  progress?: number;
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
  images?: WordImageFormValue[];
}