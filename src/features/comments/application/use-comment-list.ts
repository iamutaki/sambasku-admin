import { useCursorList } from '@/shared/hooks/use-cursor-list';
import type { AdminCommentItem, CommentStatus } from '../domain/comment';
import { listAdminCommentsRequest } from '../infrastructure/comment-api';

const PAGE_LIMIT = 20;

export interface UseCommentListArgs {
  status?: CommentStatus;
  enabled?: boolean;
}

/** Antrean moderasi komentar - filter status + cursor pagination. */
export function useCommentList(args: UseCommentListArgs = {}) {
  const { status, enabled } = args;

  return useCursorList<AdminCommentItem>({
    queryKey: ['comments', { status }],
    fetcher: (pageParam, signal) =>
      listAdminCommentsRequest({ status, limit: PAGE_LIMIT, cursor: pageParam }, signal),
    enabled,
  });
}