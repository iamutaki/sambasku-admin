import { useCursorList } from '@/shared/hooks/use-cursor-list';
import { listBlocklistRequest } from '../infrastructure/blocklist-api';
import type { BlocklistWordItem } from '../domain/blocklist-word';

export function useBlocklistList(enabled: boolean, q?: string) {
  const term = q?.trim() || undefined;
  return useCursorList<BlocklistWordItem>({
    queryKey: ['comment-blocklist', { q: term }],
    fetcher: (pageParam, signal) =>
      listBlocklistRequest({ cursor: pageParam, limit: 50, q: term }, signal),
    enabled,
  });
}
