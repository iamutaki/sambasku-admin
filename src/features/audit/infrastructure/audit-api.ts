import { client } from '@/shared/api/client';
import type { ApiCursorPageEnvelope, CursorPage } from '@/shared/api/types';
import type { AuditLogListItem, ListAuditLogsParams } from '../domain/audit-log';

/**
 * GET /api/v1/admin/audit-logs - jejak mutasi data (role: admin & root).
 * Filter AND opsional (user_id / entity_type / entity_id) + cursor pagination.
 * Bentuk backend: `{ success, data: [...], meta }` - dinormalisasi jadi
 * `CursorPage`.
 */
export async function listAuditLogsRequest(
  params: ListAuditLogsParams,
  signal?: AbortSignal,
): Promise<CursorPage<AuditLogListItem>> {
  const res = await client.get<ApiCursorPageEnvelope<AuditLogListItem>>('/admin/audit-logs', {
    params: {
      user_id: params.userId || undefined,
      entity_type: params.entityType || undefined,
      entity_id: params.entityId || undefined,
      limit: params.limit ?? 20,
      cursor: params.cursor,
    },
    signal,
  });
  return { data: res.data.data, meta: res.data.meta };
}