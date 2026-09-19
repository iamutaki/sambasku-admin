import { useMutation, useQueryClient } from '@tanstack/react-query';
import { sessionStore } from '@/shared/auth/session';
import { changePasswordRequest, type ChangePasswordInput } from '../infrastructure/profile-api';

/**
 * Use case ubah password sendiri. Setelah sukses backend sudah me-revoke
 * SEMUA refresh token - clear sesi lokal + cache query di sini (bukan di
 * form), form cukup menampilkan pesan lalu navigasi ke /login.
 * Return pesan sukses dari backend untuk ditampilkan form.
 */
export function useChangePassword() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ChangePasswordInput) => changePasswordRequest(input),
    onSuccess: () => {
      sessionStore.clear();
      // Query ter-cache tidak boleh nyangkut dengan sesi yang sudah mati.
      queryClient.clear();
    },
  });
}
