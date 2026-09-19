/**
 * Item antrean moderasi komentar - contract GET /api/v1/admin/comments
 * (docs/api/09-api-comment.md #4). Kosakata status IKUT konten:
 * pending_review | published | rejected (BUKAN workflow contributions).
 */

export const COMMENT_STATUSES = ['pending_review', 'published', 'rejected'] as const;
export type CommentStatus = (typeof COMMENT_STATUSES)[number];

export const COMMENT_STATUS_LABELS: Record<CommentStatus, string> = {
  pending_review: 'Menunggu',
  published: 'Diterbitkan',
  rejected: 'Ditolak',
};

export const COMMENT_STATUS_TAG_COLOR: Record<CommentStatus, string> = {
  pending_review: 'orange',
  published: 'green',
  rejected: 'red',
};

/** Item mentah antrean dari backend (snake_case dibiarkan apa adanya). */
export interface AdminCommentItem {
  id: string;
  word_id: string;
  user_id: string;
  username: string | null;
  body: string;
  status: CommentStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface ListCommentsParams {
  status?: CommentStatus;
  /** filter per kata (section komentar di detail admin); absen = semua kata */
  wordId?: string;
  limit?: number;
  cursor?: string;
}

/**
 * Hasil keputusan moderasi (approve/reject) - POST /admin/comments/:id/...
 * Response 200 berisi id + status akhir + reviewer + waktu keputusan.
 */
export interface ReviewCommentResult {
  id: string;
  status: CommentStatus;
  reviewed_by: string;
  reviewed_at: string | null;
}