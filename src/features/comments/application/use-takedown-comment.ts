import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { TakedownCommentResult } from '../domain/comment';
import { takedownCommentRequest } from '../infrastructure/comment-api';

/** Takedown komentar published. Invalidasi prefix ['comments']. */
export function useTakedownComment(): ReturnType<
  typeof useMutation<TakedownCommentResult, Error, string>
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => takedownCommentRequest(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments'] });
    },
  });
}
