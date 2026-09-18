import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ReviewDecisionResult } from '../domain/contribution';
import { approveContributionRequest, rejectContributionRequest } from '../infrastructure/contribution-api';

export type ReviewDecision = 'approve' | 'reject';

export interface ReviewDecisionInput {
  id: string;
  decision: ReviewDecision;
  comment?: string;
}

/**
 * Keputusan approve / reject kontribusi. Reject mewajibkan comment (validator
 * backend min 1). Invalidasi 'contributions' menyegarkan list + detail.
 */
export function useReviewContribution(): ReturnType<
  typeof useMutation<ReviewDecisionResult, Error, ReviewDecisionInput>
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, decision, comment }: ReviewDecisionInput) =>
      decision === 'approve' ? approveContributionRequest(id, comment) : rejectContributionRequest(id, comment ?? ''),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contributions'] });
    },
  });
}