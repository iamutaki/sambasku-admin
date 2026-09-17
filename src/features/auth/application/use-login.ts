import { useQueryClient } from '@tanstack/react-query';
import { useMutation } from '@tanstack/react-query';
import { sessionStore } from '@/shared/auth/session';
import { loginRequest } from '../infrastructure/auth-api';
import type { LoginCredentials, AuthSessionResult } from '../domain/user';

/**
 * Use case Login - satu-satunya pemilik logika "apa yang terjadi setelah
 * backend mengembalikan token" (simpan ke session store + kosongkan cache
 * data user sebelumnya). Halaman/form cukup consume hook ini.
 */
export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (credentials: LoginCredentials) => loginRequest(credentials),
    onSuccess: (result: AuthSessionResult) => {
      sessionStore.signIn(result.accessToken, result.expiresIn, result.user);
      // Pengguna baru: data query (list, dsb) dari sesi sebelumnya tidak valid.
      queryClient.clear();
    },
  });
}