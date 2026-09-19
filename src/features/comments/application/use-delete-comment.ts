import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteCommentRequest } from '../infrastructure/comment-api';

/**
 * Delete Comment - hapus permanen komentar (tidak bisa dibatalkan).
 * Setelah sukses invalidasi list komentar (prefix ['comments']).
 */
export function useDeleteComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteCommentRequest(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments'] });
    },
  });
}
