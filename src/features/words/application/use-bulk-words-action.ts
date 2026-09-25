import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  bulkWordsActionRequest,
  type BulkWordsAction,
  type BulkWordsResult,
} from '../infrastructure/word-api';

/**
 * Mass-action Kata (delete | publish | unpublish) dari checkbox tabel.
 * Invalidate list/detail setelah selesai agar baris yang berubah hilang/update.
 */
export function useBulkWordsAction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: { action: BulkWordsAction; ids: string[] }) => bulkWordsActionRequest(body),
    onSuccess: (data: BulkWordsResult) => {
      for (const item of data.results) {
        if (item.ok) {
          queryClient.removeQueries({ queryKey: ['words', 'detail', item.id] });
          if (item.merged_into_word_id) {
            queryClient.removeQueries({ queryKey: ['words', 'detail', item.merged_into_word_id] });
          }
        }
      }
      queryClient.invalidateQueries({ queryKey: ['words'] });
    },
  });
}
