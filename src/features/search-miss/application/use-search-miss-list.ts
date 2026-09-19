import { useCursorList } from '@/shared/hooks/use-cursor-list';
import { listSearchMissesRequest } from '../infrastructure/search-miss-api';
import type { SearchMissDirection, SearchMissListItem } from '../domain/search-miss';
import { normalizeSearchMissListItem } from './search-miss-mappers';

const PAGE_LIMIT = 20;

export interface UseSearchMissListArgs {
  q?: string;
  direction?: SearchMissDirection;
  fulfilled?: boolean;
  enabled?: boolean;
}

/**
 * List search miss admin: q untuk pencarian lemma partial,
 * direction/fulfilled sebagai filter AND. Query key MENGANDUNG SEMUA
 * filter - filter berubah = list baru dari halaman pertama (aturan
 * Section 12 admin-base-stack).
 */
export function useSearchMissList(args: UseSearchMissListArgs = {}) {
  const { q, direction, fulfilled, enabled } = args;

  return useCursorList<SearchMissListItem>({
    queryKey: ['search-misses', { q, direction, fulfilled }],
    fetcher: async (pageParam, signal) => {
      const page = await listSearchMissesRequest(
        { q, direction, fulfilled, limit: PAGE_LIMIT, cursor: pageParam },
        signal,
      );
      return {
        data: page.data.map(normalizeSearchMissListItem),
        meta: page.meta,
      };
    },
    enabled,
  });
}
