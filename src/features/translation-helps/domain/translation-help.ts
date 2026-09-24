export const TRANSLATION_HELP_STATUSES = [
  'pending_review',
  'published',
  'rejected',
  'taken_down',
] as const;

export type TranslationHelpStatus = (typeof TRANSLATION_HELP_STATUSES)[number];

export const TRANSLATION_HELP_STATUS_LABELS: Record<TranslationHelpStatus, string> = {
  pending_review: 'Menunggu',
  published: 'Tayang',
  rejected: 'Ditolak',
  taken_down: 'Ditarik',
};

export const TRANSLATION_HELP_STATUS_TAG_COLOR: Record<TranslationHelpStatus, string> = {
  pending_review: 'orange',
  published: 'green',
  rejected: 'red',
  taken_down: 'default',
};

export type TranslationHelpReplyStatus = 'published' | 'taken_down' | 'deleted_by_author';

export interface TranslationHelpImage {
  url: string;
  provider_file_id: string;
  public_url: string | null;
}

export interface TranslationHelpListItem {
  id: string;
  user_id: string;
  username: string | null;
  body: string | null;
  images: TranslationHelpImage[];
  status: TranslationHelpStatus;
  rejection_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  pinned_reply_id: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface TranslationHelpReply {
  id: string;
  user_id: string;
  username: string | null;
  body: string | null;
  status: TranslationHelpReplyStatus;
  is_verifier: boolean;
  is_pinned: boolean;
  created_at: string;
  body_original: string | null;
  is_censored: boolean;
  reviewed_by: string | null;
  reviewed_at: string | null;
}

export interface TranslationHelpDetail extends TranslationHelpListItem {
  replies: TranslationHelpReply[];
}

export interface ListTranslationHelpsParams {
  status?: TranslationHelpStatus;
  limit?: number;
  cursor?: string;
}

/** URL preview admin: public_url jika sudah tayang, selain itu url staging (ImageKit). */
export function previewImageUrl(img: TranslationHelpImage): string {
  return img.public_url || img.url;
}
