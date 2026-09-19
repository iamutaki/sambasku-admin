import { useMutation, useQueryClient } from '@tanstack/react-query';
import { verifyWordRequest, unverifyWordRequest } from '../infrastructure/word-api';

/**
 * Verify Word - publish / tandai verified 1 kata. Setelah sukses:
 * - invalidasi list kata (prefix ['words'])
 * - invalidasi detail kata (key ['word', id]) supaya detail refresh otomatis.
 */
export function useVerifyWord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => verifyWordRequest(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['words'] });
      queryClient.invalidateQueries({ queryKey: ['word', id] });
    },
  });
}

/**
 * Unverify Word - batal verified (kembali ke status non-published).
 * Setelah sukses - invalidasi list & detail kata.
 */
export function useUnverifyWord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => unverifyWordRequest(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['words'] });
      queryClient.invalidateQueries({ queryKey: ['word', id] });
    },
  });
}
