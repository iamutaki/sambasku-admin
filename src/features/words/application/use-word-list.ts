import { useCursorList } from '@/shared/hooks/use-cursor-list';
import { listWordsRequest } from '../infrastructure/word-api';
import type { WordListItem, WordType } from '../domain/word';

const PAGE_LIMIT = 20;

export interface UseWordListArgs {
  q?: string;
  wordType?: WordType;
  isVerified?: boolean;
  enabled?: boolean;
}

/**
 * List kata admin: `q` untuk penelusuran lemma (debounce dilakukan di UI),
 * `wordType`/`isVerified` sebagai filter. Kunci query menyertakan SEMUA
 * filter - filter berubah ⇒ list dimulai ulang dari halaman pertama.
 */
export function useWordList(args: UseWordListArgs = {}) {
  const { q, wordType, isVerified, enabled } = args;

  return useCursorList<WordListItem>({
    queryKey: ['words', { q, wordType, isVerified }],
    fetcher: (pageParam, signal) =>
      listWordsRequest({ q, wordType, isVerified, limit: PAGE_LIMIT, cursor: pageParam }, signal),
    enabled,
  });
}