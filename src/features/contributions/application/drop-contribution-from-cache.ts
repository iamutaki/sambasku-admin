import type { InfiniteData, QueryClient } from '@tanstack/react-query';
import type { CursorPage } from '@/shared/api/types';
import type { ContributionListItem } from '../domain/contribution';

type ContributionListData = InfiniteData<CursorPage<ContributionListItem>>;

/** Query list memakai key `['contributions', { status, entityType }]`. */
function isContributionListQuery(queryKey: readonly unknown[]): boolean {
  return (
    queryKey[0] === 'contributions' &&
    queryKey[1] !== 'detail' &&
    typeof queryKey[1] === 'object' &&
    queryKey[1] !== null
  );
}

/**
 * Hapus item dari semua cache antrean contributions (infinite pages).
 * Dipakai setelah approve/reject/correct yang menutup usulan supaya
 * auto-advance tidak menunggu refetch.
 */
export function dropContributionFromListCaches(queryClient: QueryClient, id: string): void {
  queryClient.setQueriesData<ContributionListData>(
    {
      predicate: (query) => isContributionListQuery(query.queryKey),
    },
    (old) => {
      if (!old?.pages) return old;
      return {
        ...old,
        pages: old.pages.map((page) => ({
          ...page,
          data: page.data.filter((item) => item.id !== id),
        })),
      };
    },
  );
}
