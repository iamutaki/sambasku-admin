export const WORD_TYPES = ['word', 'idiom', 'peribahasa', 'ungkapan'] as const;
export type WordType = (typeof WORD_TYPES)[number];

export const WORD_STATUSES = ['draft', 'pending_review', 'published', 'rejected', 'taken_down'] as const;
export type WordStatus = (typeof WORD_STATUSES)[number];

export const WORD_TYPE_LABELS: Record<WordType, string> = {
  word: 'Kata',
  idiom: 'Idiom',
  peribahasa: 'Peribahasa',
  ungkapan: 'Ungkapan',
};

/** Register + peringatan konten (closed enum, sinkron API usage-labels). */
export const USAGE_LABELS = [
  'kasar',
  'tabu',
  'informal',
  'halus',
  'seksual',
  'diskriminatif',
] as const;
export type UsageLabel = (typeof USAGE_LABELS)[number];

export const REGISTER_LABELS = ['kasar', 'tabu', 'informal', 'halus'] as const satisfies readonly UsageLabel[];
export const WARNING_LABELS = ['seksual', 'diskriminatif'] as const satisfies readonly UsageLabel[];

export const USAGE_LABEL_LABELS: Record<UsageLabel, string> = {
  kasar: 'Kasar',
  tabu: 'Tabu',
  informal: 'Informal',
  halus: 'Halus',
  seksual: 'Seksual',
  diskriminatif: 'Diskriminatif',
};

export const WORD_STATUS_LABELS: Record<WordStatus, string> = {
  draft: 'Draft',
  pending_review: 'Menunggu Review',
  published: 'Tayang',
  rejected: 'Ditolak',
  taken_down: 'Ditarik',
};

export const TAKEDOWN_REASON_CODES = [
  'not_sambas',
  'inaccurate',
  'duplicate',
  'inappropriate',
  'spam',
  'other',
] as const;
export type TakedownReasonCode = (typeof TAKEDOWN_REASON_CODES)[number];

export const TAKEDOWN_REASON_LABELS: Record<TakedownReasonCode, string> = {
  not_sambas: 'Bukan kosakata Sambas',
  inaccurate: 'Arti atau ejaan salah',
  duplicate: 'Duplikat entri lain',
  inappropriate: 'Tidak pantas',
  spam: 'Spam',
  other: 'Lainnya',
};

/** Item list kata - contract GET /api/v1/admin/words (15-api) / search publik. */
export interface WordListItem {
  id: string; // ULID
  lemma: string;
  language_id: string;
  language_code: string;
  word_type: WordType;
  usage_labels?: UsageLabel[];
  status: WordStatus;
  is_verified: boolean;
  matched_translation?: string; // hanya saat search_in=translation
  matched_variant?: string; // 11: form variasi yang cocok (search_in=lemma)
}

export interface ListWordsParams {
  q?: string;
  wordType?: WordType;
  isVerified?: boolean;
  /** true=tayang, false=tidak tayang, omit=semua (GET /admin/words) */
  published?: boolean;
  limit?: number;
  cursor?: string;
}