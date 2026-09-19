import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  resolveSearchMissRequest,
  type ResolveSearchMissBody,
} from '../infrastructure/search-miss-api';

export interface ResolveSearchMissVariables {
  id: string;
  body: ResolveSearchMissBody;
}

/** POST resolve miss → invalidate list search-misses (+ words bila sinonim baru). */
export function useResolveSearchMiss() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, body }: ResolveSearchMissVariables) => resolveSearchMissRequest(id, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['search-misses'] });
      void queryClient.invalidateQueries({ queryKey: ['words'] });
    },
  });
}
