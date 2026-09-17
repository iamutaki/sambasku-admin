/**
 * Item jejak audit — contract GET /api/v1/admin/audit-logs
 * (docs/api/02-api-audit-logs.md). `old_data`/`new_data` sudah dijamin bersih
 * di sisi tulis (tanpa password/token — Section 21 api-base-stack).
 */
export interface AuditLogListItem {
  id: string; // ULID
  user_id: string | null;
  /** username pelaku (JOIN users); null kalau user_id null / user terhapus */
  user_name: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  request_id: string | null;
  created_at: string;
}

export interface ListAuditLogsParams {
  userId?: string;
  entityType?: string;
  entityId?: string;
  limit?: number;
  cursor?: string;
}

/** Aksi yang diketahui (Section 21 + modul audit) — tampil sebagai Tag warna. */
export const AUDIT_ACTION_TAG_COLOR: Record<string, string> = {
  create: 'green',
  update: 'blue',
  delete: 'red',
  password_change: 'purple',
  publish: 'cyan',
  verify: 'blue',
  unverify: 'orange',
  approve: 'green',
  reject: 'red',
  correct: 'gold',
};