import { useMutation, useQueryClient } from '@tanstack/react-query';
import { dismissSearchMissRequest } from '../infrastructure/search-miss-api';

/**
 * Dismiss 1 search miss (soft delete). Setelah sukses, seluruh query
 * `['search-misses']` di-refresh otomatis supaya item hilang dari list
 * tanpa user klik "Muat ulang".
 */
export function useDismissSearchMiss() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => dismissSearchMissRequest(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['search-misses'] });
    },
  });
}
