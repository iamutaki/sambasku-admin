import { authClient } from '@/shared/api/client';
import type { ApiOkEnvelope } from '@/shared/api/types';
import type { SessionUser } from '@/shared/auth/session';
import type { AuthSessionResult, LoginCredentials } from '../domain/user';

/**
 * POST /auth/login — klien web (client_type: 'web'). refresh_token dikembalikan
 * backend lewat httpOnly cookie (path /api/v1/auth), bukan di body.
 */
export async function loginRequest(credentials: LoginCredentials): Promise<AuthSessionResult> {
  const res = await authClient.post<
    ApiOkEnvelope<{ access_token: string; expires_in: number; user: SessionUser }>
  >('/auth/login', {
    email: credentials.email,
    password: credentials.password,
    client_type: 'web',
  });
  return {
    accessToken: res.data.data.access_token,
    expiresIn: res.data.data.expires_in,
    user: res.data.data.user,
  };
}

/** POST /auth/logout — revoke refresh token perangkat ini (dibaca dari cookie). */
export async function logoutRequest(): Promise<void> {
  await authClient.post<ApiOkEnvelope<null>>('/auth/logout', {});
}