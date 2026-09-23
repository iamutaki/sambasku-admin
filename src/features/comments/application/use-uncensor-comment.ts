import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { UncensorCommentResult } from '../domain/comment';
import { uncensorCommentRequest } from '../infrastructure/comment-api';

export function useUncensorComment(): ReturnType<
  typeof useMutation<UncensorCommentResult, Error, string>
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => uncensorCommentRequest(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments'] });
    },
  });
}
