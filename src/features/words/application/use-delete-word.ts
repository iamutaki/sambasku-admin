import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteWordRequest } from '../infrastructure/word-api';

/**
 * Use case Hapus Kata - soft-delete (07-api-delete-kata.md). Semua query
 * yang kembali menampilkan kata ini dibuang sekali jalan: list/search
 * (['words'], termasuk detail yang sedang di-cache dari halaman edit).
 */
export function useDeleteWord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteWordRequest(id),
    onSuccess: (_, id) => {
      queryClient.removeQueries({ queryKey: ['words', 'detail', id] });
      queryClient.invalidateQueries({ queryKey: ['words'] });
    },
  });
}