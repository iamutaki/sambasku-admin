import { useMutation, useQueryClient } from '@tanstack/react-query';
import { bulkCreateBlocklistRequest, deleteBlocklistRequest } from '../infrastructure/blocklist-api';

export function useBulkCreateBlocklistWords() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (words: string[]) => bulkCreateBlocklistRequest(words),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['comment-blocklist'] }),
  });
}

export function useDeleteBlocklistWord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteBlocklistRequest(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['comment-blocklist'] }),
  });
}
