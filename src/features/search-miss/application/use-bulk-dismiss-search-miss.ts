import { useMutation, useQueryClient } from '@tanstack/react-query';
import { bulkDismissSearchMissesRequest } from '../infrastructure/search-miss-api';

/**
 * Mass dismiss search-miss dari checkbox tabel. Invalidate list setelah
 * selesai agar baris yang di-dismiss hilang.
 */
export function useBulkDismissSearchMiss() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ids: string[]) => bulkDismissSearchMissesRequest(ids),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['search-misses'] });
    },
  });
}
