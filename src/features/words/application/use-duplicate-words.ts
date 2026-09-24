import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listDuplicateWordsRequest,
  mergeDuplicateWordsRequest,
} from '../infrastructure/word-api';

export function useDuplicateWordGroups(enabled = true) {
  return useQuery({
    queryKey: ['words', 'duplicates'],
    queryFn: ({ signal }) => listDuplicateWordsRequest(signal),
    enabled,
  });
}

export function useMergeDuplicateWords() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: mergeDuplicateWordsRequest,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['words'] });
    },
  });
}
