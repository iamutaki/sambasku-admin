import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  approveTranslationHelpRequest,
  pinTranslationHelpReplyRequest,
  rejectTranslationHelpRequest,
  takedownTranslationHelpReplyRequest,
  takedownTranslationHelpRequest,
} from '../infrastructure/translation-help-api';
import type { TranslationHelpListItem, TranslationHelpReply } from '../domain/translation-help';

function invalidateAll(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['translation-helps'] });
}

export function useApproveTranslationHelp() {
  const queryClient = useQueryClient();
  return useMutation<
    TranslationHelpListItem,
    Error,
    { id: string; censoredFiles?: (Blob | null)[] }
  >({
    mutationFn: ({ id, censoredFiles }) => approveTranslationHelpRequest(id, censoredFiles),
    onSuccess: () => invalidateAll(queryClient),
  });
}

export function useRejectTranslationHelp() {
  const queryClient = useQueryClient();
  return useMutation<TranslationHelpListItem, Error, { id: string; note: string }>({
    mutationFn: ({ id, note }) => rejectTranslationHelpRequest(id, note),
    onSuccess: () => invalidateAll(queryClient),
  });
}

export function useTakedownTranslationHelp() {
  const queryClient = useQueryClient();
  return useMutation<TranslationHelpListItem, Error, { id: string }>({
    mutationFn: ({ id }) => takedownTranslationHelpRequest(id),
    onSuccess: () => invalidateAll(queryClient),
  });
}

export function usePinTranslationHelpReply() {
  const queryClient = useQueryClient();
  return useMutation<TranslationHelpListItem, Error, { helpId: string; replyId: string }>({
    mutationFn: ({ helpId, replyId }) => pinTranslationHelpReplyRequest(helpId, replyId),
    onSuccess: () => invalidateAll(queryClient),
  });
}

export function useTakedownTranslationHelpReply() {
  const queryClient = useQueryClient();
  return useMutation<TranslationHelpReply, Error, { replyId: string }>({
    mutationFn: ({ replyId }) => takedownTranslationHelpReplyRequest(replyId),
    onSuccess: () => invalidateAll(queryClient),
  });
}
