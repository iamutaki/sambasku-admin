import { useMutation, useQueryClient } from '@tanstack/react-query';
import { resetTargetVotesRequest } from '../infrastructure/vote-admin-api';
import type { AdminVoteTargetType } from '../domain/vote-admin';

export interface ResetTargetVotesArgs {
  targetType: AdminVoteTargetType;
  targetId: string;
}

/**
 * Reset SEMUA vote satu target (anti-brigading). Return deleted_count untuk
 * pesan sukses di presentation. Invalidasi sama dengan delete vote.
 */
export function useResetTargetVotes() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (args: ResetTargetVotesArgs) =>
      resetTargetVotesRequest({ targetType: args.targetType, targetId: args.targetId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-votes'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-top-targets'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
