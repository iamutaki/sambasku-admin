import { useCursorList } from '@/shared/hooks/use-cursor-list';
import { listTranslationHelpsRequest } from '../infrastructure/translation-help-api';
import type { TranslationHelpListItem, TranslationHelpStatus } from '../domain/translation-help';

const PAGE_LIMIT = 20;

export function useTranslationHelpList(
  args: { status?: TranslationHelpStatus; enabled?: boolean } = {},
) {
  const { status, enabled } = args;
  return useCursorList<TranslationHelpListItem>({
    queryKey: ['translation-helps', { status }],
    fetcher: (pageParam, signal) =>
      listTranslationHelpsRequest({ status, limit: PAGE_LIMIT, cursor: pageParam }, signal),
    enabled,
  });
}
