import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  updateSearchMissRequest,
  type UpdateSearchMissBody,
} from '../infrastructure/search-miss-api';

export interface UpdateSearchMissVariables {
  id: string;
  body: UpdateSearchMissBody;
}

/**
 * PATCH koreksi term / toggle tayang. Invalidate list search-misses.
 */
export function useUpdateSearchMiss() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, body }: UpdateSearchMissVariables) => updateSearchMissRequest(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['search-misses'] });
    },
  });
}
