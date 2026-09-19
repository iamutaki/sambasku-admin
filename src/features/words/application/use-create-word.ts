import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createWordRequest } from '../infrastructure/word-api';
import type { CreateWordRequest } from '../domain/create-word';

/**
 * Use case Tambah Kata - satu pemilik logika "setelah sukses" (invalidate
 * list + search kata). Status akhir memberitahu UI via hasil mutation
 * (`CreateWordResult.status`), sumber kebenaran dari backend (approval gate).
 */
export function useCreateWord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreateWordRequest) => createWordRequest(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['words'] });
    },
  });
}