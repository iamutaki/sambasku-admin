import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  approveVerifierApplicationRequest,
  rejectVerifierApplicationRequest,
} from '../infrastructure/verifier-application-api';
import type {
  ApproveVerifierApplicationResult,
  RejectVerifierApplicationResult,
} from '../domain/verifier-application';

export type VerifierApplicationDecision = 'approve' | 'reject';

export type ReviewVerifierApplicationResult =
  | ApproveVerifierApplicationResult
  | RejectVerifierApplicationResult;

export function useReviewVerifierApplication() {
  const queryClient = useQueryClient();

  return useMutation<
    ReviewVerifierApplicationResult,
    Error,
    { id: string; decision: VerifierApplicationDecision; comment?: string }
  >({
    mutationFn: ({ id, decision, comment }) =>
      decision === 'approve'
        ? approveVerifierApplicationRequest(id)
        : rejectVerifierApplicationRequest(id, comment ?? ''),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['verifier-applications'] });
    },
  });
}
