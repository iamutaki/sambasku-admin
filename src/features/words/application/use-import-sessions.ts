import { useQuery } from '@tanstack/react-query';
import { useCursorList } from '@/shared/hooks/use-cursor-list';
import {
  getWordImportSessionRequest,
  listWordImportSessionsRequest,
  type WordImportSession,
} from '../infrastructure/word-api';

const PAGE_LIMIT = 20;

export function useImportSessionList() {
  return useCursorList<WordImportSession>({
    queryKey: ['word-import-sessions'],
    fetcher: (pageParam, signal) =>
      listWordImportSessionsRequest({ limit: PAGE_LIMIT, cursor: pageParam }, signal),
  });
}

export function useImportSession(id: string) {
  return useQuery({
    queryKey: ['word-import-sessions', 'detail', id],
    queryFn: ({ signal }) => getWordImportSessionRequest(id, signal),
    enabled: id.length > 0,
  });
}
