/** Domain usul perubahan kata (docs/api/17-api-suggest-edit-word.md). */

export type SuggestionStatus = 'pending' | 'approved' | 'rejected' | 'corrected';

export type SuggestionReasonCode =
  | 'typo'
  | 'inaccurate_definition'
  | 'missing_example'
  | 'missing_relation'
  | 'image_issue'
  | 'other';

export interface SuggestionListItem {
  id: string;
  word_id: string;
  word_lemma: string;
  contributor_id: string;
  contributor_username: string | null;
  reason: string;
  reason_code: SuggestionReasonCode;
  status: SuggestionStatus;
  created_at: string;
  summary_changes: {
    lemma: string | null;
    notes: string | null;
    meanings_count: number;
    categories_added: number;
    categories_removed: number;
    relations_count: number;
    variants_count: number;
    images_count: number;
  };
}

export interface SuggestionDetail {
  suggestion: {
    id: string;
    word_id: string;
    word_lemma: string;
    contributor_id: string;
    contributor_username: string | null;
    reason: string;
    reason_code: SuggestionReasonCode;
    proposed_changes: Record<string, unknown>;
    status: SuggestionStatus;
    created_at: string;
  };
  current_word: {
    lemma: string;
    notes: string | null;
    meanings: Array<{
      id: string;
      word_class: { code: string; name: string } | null;
      definition: string;
      translations: Array<{ translation_text: string }>;
    }>;
    category_ids: string[];
    relations: Array<{ relation_type: string; word_id: string; lemma: string }>;
    variants: Array<{ form: string; variant_type: string; dialect_id: string | null }>;
    images: Array<{ id: string; url: string; is_primary: boolean; alt_text: string | null }>;
  };
  diff: {
    lemma: { current: string | null; proposed: string | null; changed: boolean };
    notes: { current: string | null; proposed: string | null; changed: boolean };
    meanings: Array<{
      meaning_id: string | null;
      changes: Array<{ current: string | null; proposed: string | null; changed: boolean }>;
    }>;
    categories: { added: string[]; removed: string[] };
    relations: {
      added: Array<{ relation_type: string; word_id: string; lemma?: string }>;
      removed: Array<{ relation_type: string; word_id: string; lemma?: string }>;
    };
    variants: {
      added: Array<{ form: string; variant_type: string }>;
      removed: Array<{ form: string; variant_type: string }>;
    };
    images: {
      added: Array<{
        url: string;
        is_primary: boolean;
        provider?: string | null;
        provider_file_id?: string | null;
      }>;
      removed: Array<{ image_id: string }>;
      set_primary: Array<{ image_id: string }>;
    };
  };
}

export const SUGGESTION_STATUS_LABELS: Record<SuggestionStatus, string> = {
  pending: 'Menunggu',
  approved: 'Disetujui',
  rejected: 'Ditolak',
  corrected: 'Dikoreksi',
};

export const REASON_CODE_LABELS: Record<SuggestionReasonCode, string> = {
  typo: 'Kesalahan penulisan',
  inaccurate_definition: 'Definisi kurang tepat',
  missing_example: 'Kurang contoh',
  missing_relation: 'Relasi/sinonim kurang',
  image_issue: 'Gambar kurang/salah',
  other: 'Lainnya',
};
