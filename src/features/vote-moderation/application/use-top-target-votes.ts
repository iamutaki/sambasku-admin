import { useQuery } from '@tanstack/react-query';
import { getTopTargetsRequest } from '../infrastructure/vote-admin-api';
import type { AdminTopTargetItem, AdminVoteTargetType } from '../domain/vote-admin';
import { normalizeAdminTopTarget } from './vote-admin-mappers';

/**
 * Top targets per entity type terurut skor bersih (net) desc - deteksi dini
 * konten dengan vote tidak wajar. Bukan cursor list (limit tunggal, default
 * 50) jadi cukup useQuery biasa.
 */
export function useTopTargetVotes(args: {
  targetType: AdminVoteTargetType;
  enabled?: boolean;
}) {
  const { targetType, enabled } = args;

  return useQuery({
    queryKey: ['admin-top-targets', { targetType }],
    queryFn: async ({ signal }) => {
      const rows = await getTopTargetsRequest({ targetType, limit: 50 }, signal);
      return rows.map(normalizeAdminTopTarget) as AdminTopTargetItem[];
    },
    enabled: enabled ?? true,
    staleTime: 30_000,
  });
}
