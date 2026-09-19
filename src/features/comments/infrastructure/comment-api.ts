import { client } from '@/shared/api/client';
import type { ApiCursorPageEnvelope, ApiOkEnvelope, CursorPage } from '@/shared/api/types';
import type { AdminCommentItem, ListCommentsParams, ReviewCommentResult } from '../domain/comment';

/**
 * GET /api/v1/admin/comments - antrean moderasi komentar
 * (role: admin/root/reviewer; filter status, cursor pagination).
 * Bentuk backend: `{ success, data: [...], meta }` - dinormalisasi jadi
 * `CursorPage`.
 */
export async function listAdminCommentsRequest(
  params: ListCommentsParams,
  signal?: AbortSignal,
): Promise<CursorPage<AdminCommentItem>> {
  const res = await client.get<ApiCursorPageEnvelope<AdminCommentItem>>('/admin/comments', {
    params: {
      status: params.status,
      word_id: params.wordId,
      limit: params.limit ?? 20,
      cursor: params.cursor,
    },
    signal,
  });
  return { data: res.data.data, meta: res.data.meta };
}

/** POST /api/v1/admin/comments/:id/approve - terbitkan komentar. */
export async function approveCommentRequest(id: string): Promise<ReviewCommentResult> {
  const res = await client.post<ApiOkEnvelope<ReviewCommentResult>>(`/admin/comments/${id}/approve`);
  return res.data.data;
}

/** POST /api/v1/admin/comments/:id/reject - tolak komentar (tanpa alasan). */
export async function rejectCommentRequest(id: string): Promise<ReviewCommentResult> {
  const res = await client.post<ApiOkEnvelope<ReviewCommentResult>>(`/admin/comments/${id}/reject`);
  return res.data.data;
}