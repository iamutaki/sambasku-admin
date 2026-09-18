import { useQuery } from '@tanstack/react-query';
import { getAdminWordDetailRequest } from '../infrastructure/word-api';

/**
 * Detail kata admin (prefill form edit) - GET /api/v1/admin/words/:id.
 * Satu sumber: kata tertentu dengan SEMUA status anak (prefill jujur).
 */
export function useWordDetail(id: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['words', 'detail', id],
    queryFn: ({ signal }) => getAdminWordDetailRequest(id, signal),
    enabled: options?.enabled ?? true,
    staleTime: 30_000,
  });
}