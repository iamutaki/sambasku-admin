import { useQuery } from '@tanstack/react-query';
import { normalizeContributionDetail } from './contribution-mappers';
import type { ContributionDetailView } from '../domain/contribution';
import { getContributionDetailRequest } from '../infrastructure/contribution-api';

/**
 * Detail kontribusi untuk layar review - hasil mentah api dinormalisasi ke
 * view model polymorphic; query `enabled` ketika id sudah ada (drawer).
 */
export function useContributionDetail(id: string | undefined): ReturnType<typeof useQuery<ContributionDetailView, Error, ContributionDetailView>> {
  return useQuery({
    queryKey: ['contributions', 'detail', id],
    queryFn: async ({ signal }) => {
      const payload = await getContributionDetailRequest(id!, signal);
      return normalizeContributionDetail(payload);
    },
    enabled: !!id,
    staleTime: 30_000,
  });
}