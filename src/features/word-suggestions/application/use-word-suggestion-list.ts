import { useCursorList } from '@/shared/hooks/use-cursor-list';
import { listWordSuggestionsRequest } from '../infrastructure/word-suggestion-api';
import type { SuggestionListItem, SuggestionStatus } from '../domain/word-suggestion';

export function useWordSuggestionList(args: { status?: SuggestionStatus; enabled?: boolean } = {}) {
  const { status, enabled } = args;
  return useCursorList<SuggestionListItem>({
    queryKey: ['word-suggestions', { status }],
    fetcher: (pageParam, signal) =>
      listWordSuggestionsRequest({ status, limit: 20, cursor: pageParam }, signal),
    enabled,
  });
}
