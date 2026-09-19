import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ReviewCommentResult } from '../domain/comment';
import { approveCommentRequest, rejectCommentRequest } from '../infrastructure/comment-api';

export type ReviewCommentDecision = 'approve' | 'reject';

export interface ReviewCommentInput {
  id: string;
  decision: ReviewCommentDecision;
}

/**
 * Keputusan approve / reject komentar (tanpa alasan - spesifikasi 09).
 * Invalidasi 'comments' menyegarkan antrean setelah keputusan. 409
 * COMMENT_ALREADY_REVIEWED (race dua moderator) tampil sebagai error
 * mutation; caller melakukan refetch agar list tetap akurat.
 */
export function useReviewComment(): ReturnType<
  typeof useMutation<ReviewCommentResult, Error, ReviewCommentInput>
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, decision }: ReviewCommentInput) =>
      decision === 'approve' ? approveCommentRequest(id) : rejectCommentRequest(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments'] });
    },
  });
}