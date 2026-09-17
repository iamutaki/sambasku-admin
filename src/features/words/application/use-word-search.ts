import { useCursorList } from '@/shared/hooks/use-cursor-list';
import { listWordsRequest } from '../infrastructure/word-api';
import type { WordListItem } from '../domain/word';

const PAGE_LIMIT = 20;

export interface UseWordSearchArgs {
  q?: string;
  enabled?: boolean;
}

/**
 * Pencarian kata untuk relasi sinonim/antonim/turunan - cursor pagination,
 * debounce dilakukan di komponen (`useDebouncedValue`). Kunci query memuat
 * `q` sehingga setiap pencarian baru mulai dari halaman pertama.
 */
export function useWordSearch(args: UseWordSearchArgs = {}) {
  const { q, enabled } = args;

  return useCursorList<WordListItem>({
    queryKey: ['words', 'search', { q }],
    fetcher: (pageParam, signal) => listWordsRequest({ q, limit: PAGE_LIMIT, cursor: pageParam }, signal),
    enabled: enabled ?? true,
  });
}