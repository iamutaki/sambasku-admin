import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CorrectContributionRequest } from '../domain/correct-contribution';
import type { ReviewDecisionResult } from '../domain/contribution';
import { correctContributionRequest } from '../infrastructure/contribution-api';

/**
 * Kumulasi koreksi verifikator (replace semantics per entity_type).
 * Invalidasi 'contributions' menyegarkan list + detail setelah apply.
 */
export function useCorrectContribution(id: string): ReturnType<
  typeof useMutation<ReviewDecisionResult, Error, CorrectContributionRequest>
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CorrectContributionRequest) => correctContributionRequest(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contributions'] });
    },
  });
}