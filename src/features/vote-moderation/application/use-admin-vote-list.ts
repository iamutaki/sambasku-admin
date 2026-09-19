import { useCursorList } from '@/shared/hooks/use-cursor-list';
import { listAdminVotesRequest } from '../infrastructure/vote-admin-api';
import type { AdminVoteListItem, AdminVoteTargetType } from '../domain/vote-admin';
import { normalizeAdminVoteListItem } from './vote-admin-mappers';

const PAGE_LIMIT = 20;

export interface UseAdminVoteListArgs {
  q?: string;
  targetType?: AdminVoteTargetType;
  value?: 1 | -1;
  targetId?: string;
  enabled?: boolean;
}

/**
 * List vote admin untuk moderasi. Query key mengandung SEMUA filter -
 * filter berubah = list baru dari halaman pertama (aturan Section 12
 * admin-base-stack).
 */
export function useAdminVoteList(args: UseAdminVoteListArgs = {}) {
  const { q, targetType, value, targetId, enabled } = args;

  return useCursorList<AdminVoteListItem>({
    queryKey: ['admin-votes', { q, targetType, value, targetId }],
    fetcher: async (pageParam, signal) => {
      const page = await listAdminVotesRequest(
        { q, targetType, value, targetId, limit: PAGE_LIMIT, cursor: pageParam },
        signal,
      );
      return { data: page.data.map(normalizeAdminVoteListItem), meta: page.meta };
    },
    enabled,
  });
}
