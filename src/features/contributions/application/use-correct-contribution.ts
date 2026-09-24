import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CorrectContributionRequest } from '../domain/correct-contribution';
import type { ReviewDecisionResult } from '../domain/contribution';
import { correctContributionRequest } from '../infrastructure/contribution-api';
import { dropContributionFromListCaches } from './drop-contribution-from-cache';

/**
 * Koreksi verifikator (replace semantics per entity_type).
 * Drop cache list hanya bila usulan ditutup (status !== pending).
 */
export function useCorrectContribution(id: string): ReturnType<
  typeof useMutation<ReviewDecisionResult, Error, CorrectContributionRequest>
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CorrectContributionRequest) => correctContributionRequest(id, body),
    onSuccess: (result) => {
      if (result.status !== 'pending') {
        dropContributionFromListCaches(queryClient, id);
      }
      queryClient.invalidateQueries({ queryKey: ['contributions'] });
    },
  });
}
