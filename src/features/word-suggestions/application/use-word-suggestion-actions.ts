import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  approveWordSuggestionRequest,
  getWordSuggestionDetailRequest,
  rejectWordSuggestionRequest,
} from '../infrastructure/word-suggestion-api';

export function useWordSuggestionDetail(id: string) {
  return useQuery({
    queryKey: ['word-suggestions', id],
    queryFn: ({ signal }) => getWordSuggestionDetailRequest(id, signal),
    enabled: !!id,
  });
}

export function useApproveWordSuggestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, comment }: { id: string; comment?: string }) =>
      approveWordSuggestionRequest(id, comment),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['word-suggestions'] });
    },
  });
}

export function useRejectWordSuggestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, comment }: { id: string; comment: string }) =>
      rejectWordSuggestionRequest(id, comment),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['word-suggestions'] });
    },
  });
}
