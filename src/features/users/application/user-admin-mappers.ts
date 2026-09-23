import type { AdminUserWire } from '../infrastructure/user-admin-api';
import type { AdminUserListItem, AdminUserRole } from '../domain/user-admin';

export function normalizeAdminUserListItem(wire: AdminUserWire): AdminUserListItem {
  return {
    id: wire.id,
    username: wire.username,
    email: wire.email,
    role: wire.role as AdminUserRole,
    isActive: wire.is_active,
    canContribute: wire.can_contribute ?? true,
    createdAt: wire.created_at,
    updatedAt: wire.updated_at,
  };
}
