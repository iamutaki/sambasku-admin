import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteAdminVoteRequest } from '../infrastructure/vote-admin-api';

/**
 * Hapus satu vote spam. Setelah sukses refresh list vote + top targets
 * (skor berubah) + dashboard (statistik vote) tanpa reload manual.
 */
export function useDeleteAdminVote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteAdminVoteRequest(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-votes'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-top-targets'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
