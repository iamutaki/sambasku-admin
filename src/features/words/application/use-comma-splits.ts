import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  applyCommaSplitRequest,
  listCommaSplitsRequest,
  markCommaLiteralRequest,
} from '../infrastructure/word-api';

export function useCommaSplits(enabled = true) {
  return useQuery({
    queryKey: ['words', 'comma-splits'],
    queryFn: ({ signal }) => listCommaSplitsRequest(signal),
    enabled,
  });
}

export function useApplyCommaSplit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: applyCommaSplitRequest,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['words'] });
    },
  });
}

export function useMarkCommaLiteral() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: markCommaLiteralRequest,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['words'] });
    },
  });
}
