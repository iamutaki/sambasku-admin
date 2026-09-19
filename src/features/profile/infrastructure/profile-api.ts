import { client } from '@/shared/api/client';
import type { ApiOkEnvelope } from '@/shared/api/types';

export interface ChangePasswordInput {
  old_password: string;
  new_password: string;
  confirm_password: string;
}

/**
 * POST /api/v1/auth/change-password - ubah password sendiri (login).
 * PENTING pakai `client` (Bearer), BUKAN `authClient`: prefix `/auth/`
 * dikecualikan dari auto-retry 401 di interceptor, jadi 401 "Password
 * lama salah" tidak memicu refresh cycle. Sukses = SEMUA session
 * ter-revoke; pemanggil wajib clear sesi lokal setelahnya.
 */
export async function changePasswordRequest(input: ChangePasswordInput): Promise<string> {
  const res = await client.post<ApiOkEnvelope<{ message: string }>>('/auth/change-password', input);
  return res.data.data.message;
}
