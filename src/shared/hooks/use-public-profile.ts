import { useQuery } from '@tanstack/react-query';
import { client } from '@/shared/api/client';
import type { ApiError } from '@/shared/api/error';
import type { ApiOkEnvelope } from '@/shared/api/types';
import {
  normalizePublicProfile,
  type PublicProfile,
  type PublicProfileWire,
} from '@/shared/users/public-profile';

export type { PublicProfile } from '@/shared/users/public-profile';

export async function getPublicProfileRequest(
  username: string,
  signal?: AbortSignal,
): Promise<PublicProfile> {
  const res = await client.get<ApiOkEnvelope<PublicProfileWire>>(
    `/users/${encodeURIComponent(username)}`,
    { signal },
  );
  return normalizePublicProfile(res.data.data);
}

/**
 * Profil publik by username (`GET /api/v1/users/:username`).
 * Dipakai modal info user di admin; tidak memuat user_id / email / phone.
 */
export function usePublicProfile(username: string | null | undefined, enabled = true) {
  return useQuery<PublicProfile, ApiError>({
    queryKey: ['public-profile', username],
    queryFn: ({ signal }) => getPublicProfileRequest(username!, signal),
    enabled: enabled && !!username,
    staleTime: 60_000,
  });
}
