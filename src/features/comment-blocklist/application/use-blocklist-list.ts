import { useCursorList } from '@/shared/hooks/use-cursor-list';
import { listBlocklistRequest } from '../infrastructure/blocklist-api';
import type { BlocklistWordItem } from '../domain/blocklist-word';

export function useBlocklistList(enabled: boolean) {
  return useCursorList<BlocklistWordItem>({
    queryKey: ['comment-blocklist'],
    fetcher: (pageParam, signal) => listBlocklistRequest({ cursor: pageParam, limit: 50 }, signal),
    enabled,
  });
}
