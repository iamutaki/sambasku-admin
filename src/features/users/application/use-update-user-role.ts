import { useMutation, useQueryClient } from '@tanstack/react-query';
import { App } from 'antd';
import { normalizeError } from '@/shared/api/error';
import { updateUserRoleRequest } from '../infrastructure/user-admin-api';
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
