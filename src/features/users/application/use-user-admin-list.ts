import { useCursorList } from '@/shared/hooks/use-cursor-list';
import { listAdminUsersRequest } from '../infrastructure/user-admin-api';
import type { AdminUserListItem, AdminUserRole } from '../domain/user-admin';
import { normalizeAdminUserListItem } from './user-admin-mappers';

export interface UseUserAdminListArgs {
  q?: string;
  role?: AdminUserRole;
  limit?: number;
}

export function useUserAdminList(args: UseUserAdminListArgs = {}) {
  const { q, role, limit = 20 } = args;

  return useCursorList<AdminUserListItem>({
    queryKey: ['admin-users', { q, role, limit }],
    fetcher: async (cursor, signal) => {
      const res = await listAdminUsersRequest({ q, role, limit, cursor }, signal);
      return {
        data: res.data.map(normalizeAdminUserListItem),
        meta: res.meta,
      };
    },
  });
}
