import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/shared/auth/use-auth';
import { buildTargetsQuery, type VoteCountsItem } from '../domain/vote';
import { getVoteCountsRequest } from '../infrastructure/vote-api';

export interface VoteCountsMap {
  upvotes: number;
  downvotes: number;
}

/** Item counts → map key "type:id" → { upvotes, downvotes }. */
export function toVoteCountMap(items: VoteCountsItem[]): Record<string, VoteCountsMap> {
  return Object.fromEntries(items.map((i) => [`${i.target_type}:${i.target_id}`, { upvotes: i.upvotes, downvotes: i.downvotes }]));
}

/** role verifikator = bisa buka halaman yang membaca counts. */
export function isVoteCountsReader(role: string | undefined): boolean {
  return role === 'reviewer' || role === 'admin' || role === 'root';
}

/**
 * Batch counts vote (read-only) untuk target yang diminta. Query ber-join
 * dengan role gate verifikator; cache 'votes/counts' - counts jarang berubah
 * dalam sesi moderasi.
 */
export function useVoteCounts(targets: string[], enabled = true) {
  const { user } = useAuth();
  const canRead = isVoteCountsReader(user?.role);

  return useQuery({
    queryKey: ['votes', 'counts', targets],
    queryFn: ({ signal }) => getVoteCountsRequest(buildTargetsQuery(targets), signal),
    enabled: enabled && canRead && targets.length > 0,
    staleTime: 60_000,
  });
}