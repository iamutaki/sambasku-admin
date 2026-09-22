import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createBlocklistRequest, deleteBlocklistRequest } from '../infrastructure/blocklist-api';

export function useCreateBlocklistWord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (word: string) => createBlocklistRequest(word),
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
