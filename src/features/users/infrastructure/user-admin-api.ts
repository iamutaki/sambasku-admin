import { client } from '@/shared/api/client';
import type { ApiCursorPageEnvelope, CursorPage } from '@/shared/api/types';
import type { AdminUserRole } from '../domain/user-admin';

export interface AdminUserWire {
  id: string;
  username: string;
  email: string;
  role: string;
  is_active: boolean;
  can_contribute: boolean;
  created_at: string;
  updated_at: string | null;
}

export interface ListAdminUsersParams {
  q?: string;
  role?: AdminUserRole;
  canContribute?: boolean;
  limit?: number;
  cursor?: string;
}

export async function listAdminUsersRequest(
  params: ListAdminUsersParams,
  signal?: AbortSignal,
): Promise<CursorPage<AdminUserWire>> {
  const res = await client.get<ApiCursorPageEnvelope<AdminUserWire>>('/admin/users', {
    params: {
      q: params.q || undefined,
      role: params.role || undefined,
      can_contribute: params.canContribute === undefined ? undefined : String(params.canContribute),
      limit: params.limit ?? 20,
      cursor: params.cursor,
    },
    signal,
  });
  return { data: res.data.data, meta: res.data.meta };
}

export async function updateUserRoleRequest(
  id: string,
  role: Exclude<AdminUserRole, 'root'>,
  signal?: AbortSignal,
): Promise<{ id: string; role: AdminUserRole }> {
  const res = await client.patch<{
    success: true;
    data: { id: string; role: AdminUserRole };
  }>(`/admin/users/${id}/role`, { role }, { signal });
  return res.data.data;
}

export async function setCanContributeRequest(id: string, canContribute: boolean): Promise<void> {
  await client.patch(`/admin/contribution-access/${id}`, { can_contribute: canContribute });
}

export interface CreateAdminUserInput {
  username: string;
  email: string;
  phone?: string;
  password: string;
  confirm_password: string;
  role: Exclude<AdminUserRole, 'root'>;
  is_active: boolean;
}

export async function createAdminUserRequest(input: CreateAdminUserInput): Promise<AdminUserWire> {
  const res = await client.post<{ success: true; data: AdminUserWire }>('/admin/users', input);
  return res.data.data;
}

export async function setUserActiveRequest(id: string, isActive: boolean): Promise<void> {
  await client.patch(`/admin/users/${id}/active`, { is_active: isActive });
}
