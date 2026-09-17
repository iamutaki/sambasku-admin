import { useMutation } from '@tanstack/react-query';
import { sessionStore } from '@/shared/auth/session';
import { logoutRequest } from '../infrastructure/auth-api';

/**
 * Use case Logout — revoke refresh token di backend (best-effort) lalu
 * bersihkan sesi. Setelah clear(), ConsoleLayout akan otomatis redirect ke
 * /login (effect reaktif pada sessionStore).
 */
export function useLogout() {
  return useMutation({
    mutationFn: async () => {
      try {
        await logoutRequest();
      } finally {
        sessionStore.clear();
      }
    },
  });
}