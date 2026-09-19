import { useCursorList } from '@/shared/hooks/use-cursor-list';
import type { AdminCommentItem } from '../domain/comment';
import { listAdminCommentsRequest } from '../infrastructure/comment-api';

const PAGE_LIMIT = 20;

/**
 * Semua komentar SATU kata - semua status sekaligus (tanpa filter status)
 * untuk section "8. Komentar" di halaman detail admin. Key `['comments',
 * 'word', id]` ikut ter-invalidasi oleh prefix `['comments']` di
 * useReviewComment → approve/reject langsung menyegarkan section ini.
 */
export function useWordComments(wordId: string, enabled = true) {
  return useCursorList<AdminCommentItem>({
    queryKey: ['comments', 'word', wordId],
    fetcher: (pageParam, signal) =>
      listAdminCommentsRequest({ wordId, limit: PAGE_LIMIT, cursor: pageParam }, signal),
    enabled: enabled && !!wordId,
  });
}
