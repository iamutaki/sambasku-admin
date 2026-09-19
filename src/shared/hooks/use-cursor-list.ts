import { useInfiniteQuery, type QueryKey } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { ApiError } from '@/shared/api/error';
import type { CursorPage } from '@/shared/api/types';
import { getNextCursor } from '@/shared/utils/cursor';

export interface CursorListFetcher<T> {
  (pageParam: string | undefined, signal: AbortSignal | undefined): Promise<CursorPage<T>>;
}

export interface CursorListOptions<T> {
  /** queryKey TanStack Query - setiap perubahan key = list baru dari halaman 1. */
  queryKey: QueryKey;
  fetcher: CursorListFetcher<T>;
  enabled?: boolean;
  staleTime?: number;
}

/**
 * Hook baku untuk semua halaman list ber-pagination cursor (docs/api Section
 * 13: `?limit=&cursor=` + `meta.has_more`). Memakai `useInfiniteQuery`:
 * - halaman tersimpan berurutan (page 1, 2, 3, ...)
 * - `getNextPageParam` membaca `meta.next_cursor`
 * - `loadMore()` memicu halaman berikutnya (infinite scroll / tombol "Muat lagi")
 *
 * Dengan `signal` dari TanStack Query, request yang tidak relevan lagi
 * (mis. user mengetik query baru) otomatis di-cancel - mencegah race response.
 */
export function useCursorList<T>(options: CursorListOptions<T>) {
  const query = useInfiniteQuery<CursorPage<T>, ApiError>({
    queryKey: options.queryKey,
    queryFn: ({ pageParam, signal }) => options.fetcher(pageParam as string | undefined, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => getNextCursor(lastPage.meta),
    enabled: options.enabled ?? true,
    staleTime: options.staleTime ?? 30_000,
  });

  const items = useMemo(() => query.data?.pages.flatMap((page) => page.data) ?? [], [query.data]);

  return {
    items,
    hasMore: Boolean(query.hasNextPage),
    loadMore: query.fetchNextPage,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isFetchingNextPage: query.isFetchingNextPage,
    isError: query.isError,
    error: query.error ?? null,
    refetch: query.refetch,
  };
}