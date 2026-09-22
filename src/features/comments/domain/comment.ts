/**
 * Item antrean / detail komentar - GET /api/v1/admin/comments
 * (docs/api/09-api-comment.md). Post-moderation statuses.
 */

export const COMMENT_STATUSES = ['published', 'taken_down', 'deleted_by_author'] as const;
export type CommentStatus = (typeof COMMENT_STATUSES)[number];

export const COMMENT_STATUS_LABELS: Record<CommentStatus, string> = {
  published: 'Diterbitkan',
  taken_down: 'Di-takedown',
  deleted_by_author: 'Dihapus penulis',
};

export const COMMENT_STATUS_TAG_COLOR: Record<CommentStatus, string> = {
  published: 'green',
  taken_down: 'red',
  deleted_by_author: 'default',
};

export interface AdminCommentItem {
  id: string;
  word_id: string;
  word_lemma: string | null;
  user_id: string;
  username: string | null;
  body: string;
  body_original: string | null;
  is_censored: boolean;
  status: CommentStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface ListCommentsParams {
  status?: CommentStatus;
  wordId?: string;
  limit?: number;
  cursor?: string;
}

export interface TakedownCommentResult {
  id: string;
  status: 'taken_down';
  reviewed_by: string;
  reviewed_at: string | null;
}

export interface UncensorCommentResult {
  id: string;
  body: string;
  body_original: null;
  is_censored: false;
}
