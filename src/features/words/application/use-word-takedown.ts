import { useMutation, useQueryClient } from '@tanstack/react-query';
import { restoreWordRequest, takedownWordRequest } from '../infrastructure/word-api';
import type { TakedownReasonCode } from '../domain/word';

export function useTakedownWord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; reason_code: TakedownReasonCode; note?: string }) =>
      takedownWordRequest(input.id, { reason_code: input.reason_code, note: input.note }),
    onSuccess: (_, input) => {
      queryClient.invalidateQueries({ queryKey: ['words'] });
      queryClient.invalidateQueries({ queryKey: ['word-reports'] });
      void input;
    },
  });
}

export function useRestoreWord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => restoreWordRequest(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['words'] });
      queryClient.invalidateQueries({ queryKey: ['word-reports'] });
    },
  });
}
