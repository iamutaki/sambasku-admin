import { client } from '@/shared/api/client';
import type { ApiOkEnvelope } from '@/shared/api/types';
import type { VoteCountsItem } from '../domain/vote';

/**
 * GET /api/v1/votes/counts?targets=word:01X,comment:01Y - batch jumlah vote
 * (publik, semua role auth). Admin hanya MEMBACA counts (read-only).
 */
export async function getVoteCountsRequest(
  targetsQuery: string,
  signal?: AbortSignal,
): Promise<VoteCountsItem[]> {
  const res = await client.get<ApiOkEnvelope<VoteCountsItem[]>>('/votes/counts', {
    params: { targets: targetsQuery },
    signal,
  });
  return res.data.data;
}