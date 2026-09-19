import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateWordRequest } from '../infrastructure/word-api';
import type { UpdateWordRequest } from '../domain/word-detail';

/**
 * Use case Edit Kata - satu pemilik logika "setelah sukses". Detail kata
 * yang di-cache di-hapus (removeQueries), BUKAN sekadar di-invalidate: kalau
 * hanya stale, saat halaman edit dibuka lagi React Query tetap menyajikan data
 * lama dari cache (isPending=false) dan prefill form memakai nilai pra-edit -
 * bug "edit lagi tapi bukan data terbaru". List/search di-refresh saja.
 */
export function useUpdateWord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateWordRequest }) =>
      updateWordRequest(id, body),
    onSuccess: (_, { id }) => {
      queryClient.removeQueries({ queryKey: ['words', 'detail', id] });
      queryClient.invalidateQueries({ queryKey: ['words'] });
    },
  });
}