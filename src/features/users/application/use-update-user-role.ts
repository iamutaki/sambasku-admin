import { useMutation, useQueryClient } from '@tanstack/react-query';
import { App } from 'antd';
import { normalizeError } from '@/shared/api/error';
import { setCanContributeRequest, updateUserRoleRequest } from '../infrastructure/user-admin-api';
import type { AdminUserRole } from '../domain/user-admin';

export interface UpdateRoleVariables {
  id: string;
  role: Exclude<AdminUserRole, 'root'>;
  username: string;
  prevRole: AdminUserRole;
}

export function useUpdateUserRole() {
  const queryClient = useQueryClient();
  const { message } = App.useApp();

  return useMutation({
    mutationKey: ['admin-users', 'update-role'],
    mutationFn: (vars: UpdateRoleVariables) => updateUserRoleRequest(vars.id, vars.role),
    onSuccess: async (_, vars) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
      ]);
      message.success(
        `Role "${vars.username}" diubah: ${vars.prevRole} → ${vars.role} (semua perangkat target logout otomatis)`,
      );
    },
    onError: (err, vars) => {
      const e = normalizeError(err);
      message.warning(
        `Gagal ubah role "${vars.username}": ${e.message || 'Kesalahan tidak diketahui'}`,
      );
    },
  });
}

export function useSetCanContribute() {
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  return useMutation({
    mutationFn: (vars: { id: string; canContribute: boolean; username: string }) =>
      setCanContributeRequest(vars.id, vars.canContribute),
    onSuccess: async (_, vars) => {
      await queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      message.success(
        vars.canContribute
          ? `${vars.username} bisa mengirim usulan lagi.`
          : `Kontribusi ${vars.username} dihentikan.`,
      );
    },
    onError: (err) => {
      message.warning(normalizeError(err).message || 'Gagal mengubah hak kontribusi');
    },
  });
}
