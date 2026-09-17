import { useCursorList } from '@/shared/hooks/use-cursor-list';
import { listAuditLogsRequest } from '../infrastructure/audit-api';
import type { AuditLogListItem, ListAuditLogsParams } from '../domain/audit-log';

const PAGE_LIMIT = 20;

/**
 * List audit log — filter (user/entitas) + cursor pagination. Hanya di-enable
 * untuk role admin & root (guard diserahkan ke halaman/pemanggil).
 */
export function useAuditLogList(args: { filters?: Omit<ListAuditLogsParams, 'limit' | 'cursor'>; enabled?: boolean } = {}) {
  const { filters, enabled } = args;

  return useCursorList<AuditLogListItem>({
    queryKey: ['audit-logs', { ...filters }],
    fetcher: (pageParam, signal) =>
      listAuditLogsRequest({ ...filters, limit: PAGE_LIMIT, cursor: pageParam }, signal),
    enabled,
  });
}