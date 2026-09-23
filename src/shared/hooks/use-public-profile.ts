import { useQuery } from '@tanstack/react-query';
import { client } from '@/shared/api/client';
import type { ApiError } from '@/shared/api/error';
import type { ApiOkEnvelope } from '@/shared/api/types';
import {
  normalizePublicActivity,
  normalizePublicProfile,
  type PublicActivityItem,
  type PublicActivityWire,
  type PublicProfile,
  type PublicProfileWire,
} from '@/shared/users/public-profile';

export type { PublicProfile, PublicActivityItem } from '@/shared/users/public-profile';

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

export async function getPublicActivityRequest(
  username: string,
  signal?: AbortSignal,
): Promise<PublicActivityItem[]> {
  const res = await client.get<ApiOkEnvelope<PublicActivityWire>>(
    `/users/${encodeURIComponent(username)}/activity`,
    { signal },
  );
  return normalizePublicActivity(res.data.data);
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

export function usePublicActivity(username: string | null | undefined, enabled = true) {
  return useQuery<PublicActivityItem[], ApiError>({
    queryKey: ['public-activity', username],
    queryFn: ({ signal }) => getPublicActivityRequest(username!, signal),
    enabled: enabled && !!username,
    staleTime: 60_000,
  });
}
