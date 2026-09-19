import { useMutation, useQueryClient } from '@tanstack/react-query';
import { publishWordRequest, unpublishWordRequest } from '../infrastructure/word-api';

/** Publikasikan kata (status → published). Merge otomatis jika lemma twin sudah tayang. */
export function usePublishWord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => publishWordRequest(id),
    onSuccess: (data, id) => {
      queryClient.invalidateQueries({ queryKey: ['words'] });
      queryClient.invalidateQueries({ queryKey: ['word', id] });
      if (data?.merged_into_word_id) {
        queryClient.invalidateQueries({ queryKey: ['word', data.merged_into_word_id] });
      }
    },
  });
}

/** Tarik kata dari tayang (status → draft). */
export function useUnpublishWord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => unpublishWordRequest(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['words'] });
      queryClient.invalidateQueries({ queryKey: ['word', id] });
    },
  });
}
