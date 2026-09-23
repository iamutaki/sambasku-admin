import { useCursorList } from '@/shared/hooks/use-cursor-list';
import { listAdminUsersRequest } from '../infrastructure/user-admin-api';
import type { AdminUserListItem, AdminUserRole } from '../domain/user-admin';
import { normalizeAdminUserListItem } from './user-admin-mappers';

export interface UseUserAdminListArgs {
  q?: string;
  role?: AdminUserRole;
  canContribute?: boolean;
  limit?: number;
}

export function useUserAdminList(args: UseUserAdminListArgs = {}) {
  const { q, role, canContribute, limit = 20 } = args;

  return useCursorList<AdminUserListItem>({
    queryKey: ['admin-users', { q, role, canContribute, limit }],
    fetcher: async (cursor, signal) => {
      const res = await listAdminUsersRequest({ q, role, canContribute, limit, cursor }, signal);
      return {
        data: res.data.map(normalizeAdminUserListItem),
        meta: res.meta,
      };
    },
  });
}
