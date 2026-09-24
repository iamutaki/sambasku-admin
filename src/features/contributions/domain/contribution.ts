import type { UsageLabel, WordType } from '@/features/words/domain/word';

export const CONTRIBUTION_STATUSES = ['pending', 'approved', 'rejected', 'corrected'] as const;
export type ContributionStatus = (typeof CONTRIBUTION_STATUSES)[number];

export const ENTITY_TYPES = ['word', 'pronunciation', 'word_image', 'word_audio', 'example'] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

export const CONTRIBUTION_STATUS_LABELS: Record<ContributionStatus, string> = {
  pending: 'Menunggu',
  approved: 'Disetujui',
  rejected: 'Ditolak',
  corrected: 'Dikoreksi',
};

export const ENTITY_TYPE_LABELS: Record<EntityType, string> = {
  word: 'Kata',
  pronunciation: 'Pengucapan',
  word_image: 'Gambar',
  word_audio: 'Audio Pelafalan',
  example: 'Contoh Kalimat',
};

/**
 * Item antrean review - contract GET /api/v1/admin/contributions
 * (docs/api/03-api-kontribusi-verifikasi.md).
 */
export interface ContributionListItem {
  id: string;
  user_id: string;
  contributor_username: string;
  entity_type: EntityType;
  entity_id: string;
  action: string;
  status: ContributionStatus;
  created_at: string;
  /** Lemma kata terkait — word = lemma sendiri; anak = lemma parent. */
  word_lemma?: string | null;
  search_miss_id?: string | null;
  search_miss_term?: string | null;
  search_miss_direction?: 'lemma' | 'translation' | null;
}

export interface ListContributionsParams {
  status?: ContributionStatus;
  entityType?: EntityType;
  limit?: number;
  cursor?: string;
}

// ---------------------------------------------------------------------------
// Detail kontribusi - GET /api/v1/admin/contributions/:id
// Response `data` = { contribution, review, entity } dengan `entity`
// POLYMORPHIC per entity_type (docs/api/03-api-kontribusi-verifikasi.md):
//  - 'word'          → detail kata semua status (anak pending ikut terlihat)
//  - 'pronunciation' → row + referensi parent (field editable di data.*)
 //  - 'word_image'    → row + referensi parent
//  - 'word_audio'    → row + referensi parent
//  - 'example'       → row + referensi parent
//
// CATATAN drifting kontrak: docs/json menuliskan bentuk datar snake_case,
// sementara serializer backend saat ini mengeluarkan WordDetail camelCase
// (word) dan ChildEntityWithParent { id, wordId, wordLemma, data, status,
// isVerified, isCorrected } (anak). View model TIDAK mengunci salah satu -
// mapper memakai keduanya secara toleran (application/contribution-mappers.ts).
// ---------------------------------------------------------------------------
export interface ContributionReview {
  reviewer_id: string | null;
  status: ContributionStatus;
  comment: string | null;
  created_at: string;
}

/** Payload mentah detail dari backend - `entity` polymorphic tak dikenal. */
export interface ContributionDetailPayload {
  contribution: ContributionListItem;
  review: ContributionReview | null;
  entity: unknown;
}

// ---- View model ternormalisasi (diproduksi contribution-mappers.ts) ----

export interface WordMeaningTranslationView {
  languageId: string;
  text: string;
  type: string;
}

export interface WordMeaningExampleView {
  sourceLanguageId: string | null;
  source: string;
  targetLanguageId: string | null;
  target: string | null;
  sourceType: string | null;
}

export interface WordMeaningView {
  id: string;
  wordClassId: string | null;
  wordClassName: string | null;
  definition: string;
  orderIndex: number;
  translations: WordMeaningTranslationView[];
  examples: WordMeaningExampleView[];
}

export interface WordPronunciationView {
  id: string;
  notation: string;
  value: string;
  dialectId: string | null;
  status?: string;
}

export interface WordImageView {
  id: string;
  url: string;
  altText: string | null;
  isPrimary: boolean;
  status?: string;
}

export interface WordRelationView {
  wordId: string;
  lemma: string;
  relationType: string;
}

export interface WordVariantView {
  id: string;
  form: string;
  variantType: string;
  affixType: string | null;
  affixValue: string | null;
  notes: string | null;
}

/** View konten kata dipakai layar review (dan prefill form koreksi). */
export interface WordEntityView {
  id: string;
  languageId: string | null;
  dialectId: string | null;
  lemma: string;
  wordType: WordType;
  status: string;
  notes: string | null;
  isVerified: boolean;
  isCorrected: boolean;
  /** Register & peringatan (`usage_labels` API). */
  usageLabels: UsageLabel[];
  meanings: WordMeaningView[];
  categories: { id: string; name: string }[];
  pronunciations: WordPronunciationView[];
  images: WordImageView[];
  relatedWords: WordRelationView[];
  appearsIn: WordRelationView[];
  variants: WordVariantView[];
}

/** Field yang boleh dikoreksi verifikator (data.* entity anak). */
export interface PronunciationChildData {
  notation: string;
  value: string;
  dialect_id: string | null;
  audio_url: string | null;
  speaker_name: string | null;
  notes: string | null;
}

export interface WordImageChildData {
  provider: string | null;
  provider_file_id: string;
  url: string;
  alt_text: string | null;
  is_primary: boolean;
}

export interface WordAudioChildData {
  word_id: string;
  example_id: string | null;
  url: string;
  speaker_name: string | null;
  dialect_id: string | null;
  is_primary: boolean;
  duration_ms: number | null;
  mime_type: string | null;
  file_size: number | null;
}

export interface ExampleChildData {
  source_sentence: string;
  target_sentence: string | null;
  source_type: string | null;
  notes: string | null;
}

export interface ChildEntityView<D> {
  id: string;
  wordId: string;
  wordLemma: string | null;
  meaningId?: string;
  status: string;
  isVerified: boolean;
  isCorrected: boolean;
  fields: D;
}

/** View model detail kontribusi - union terdiskriminasi oleh `entityType`
 * (word → `word` dibutuhkan; entity anak → `child` dibutuhkan). */
export type ContributionDetailView =
  | {
      contribution: ContributionListItem;
      review: ContributionReview | null;
      entityType: 'word';
      word: WordEntityView;
      /** payload entity mentah - dipakai prefill form koreksi (tetap tersimpan) */
      rawEntity: unknown;
    }
  | {
      contribution: ContributionListItem;
      review: ContributionReview | null;
      entityType: Exclude<EntityType, 'word'>;
      child: ChildEntityView<
        PronunciationChildData | WordImageChildData | WordAudioChildData | ExampleChildData
      >;
      /** payload entity mentah - dipakai prefill form koreksi (tetap tersimpan) */
      rawEntity: unknown;
    };

/** Hasil keputusan review (approve/reject/correct) - POST /:id/... */
export interface ReviewDecisionResult {
  contribution_id: string;
  entity_type: EntityType;
  entity_id: string;
  status: ContributionStatus;
  is_corrected?: boolean;
  /** Makna digabung ke kata published yang sudah ada (12-api §8) */
  merged_into_word_id?: string;
}