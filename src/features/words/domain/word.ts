export const WORD_TYPES = ['word', 'idiom', 'peribahasa', 'ungkapan'] as const;
export type WordType = (typeof WORD_TYPES)[number];

export const WORD_STATUSES = ['draft', 'pending_review', 'published', 'rejected'] as const;
export type WordStatus = (typeof WORD_STATUSES)[number];

export const WORD_TYPE_LABELS: Record<WordType, string> = {
  word: 'Kata',
  idiom: 'Idiom',
  peribahasa: 'Peribahasa',
  ungkapan: 'Ungkapan',
};

export const WORD_STATUS_LABELS: Record<WordStatus, string> = {
  draft: 'Draft',
  pending_review: 'Menunggu Review',
  published: 'Tayang',
  rejected: 'Ditolak',
};

/** Item list kata — contract GET /api/v1/words/search (docs/api/01-api-tambah-kata.md). */
export interface WordListItem {
  id: string; // ULID
  lemma: string;
  language_id: string;
  language_code: string;
  word_type: WordType;
  status: WordStatus;
  matched_translation?: string; // hanya saat search_in=translation
}

export interface ListWordsParams {
  q?: string;
  wordType?: WordType;
  isVerified?: boolean;
  limit?: number;
  cursor?: string;
}