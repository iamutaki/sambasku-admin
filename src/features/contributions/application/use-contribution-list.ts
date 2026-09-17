import { useCursorList } from '@/shared/hooks/use-cursor-list';
import { listContributionsRequest } from '../infrastructure/contribution-api';
import type { ContributionListItem, ContributionStatus, EntityType } from '../domain/contribution';

const PAGE_LIMIT = 20;

export interface UseContributionListArgs {
  status?: ContributionStatus;
  entityType?: EntityType;
  enabled?: boolean;
}

/** Antrean review kontribusi — filter status/jenis entitas + cursor pagination. */
export function useContributionList(args: UseContributionListArgs = {}) {
  const { status, entityType, enabled } = args;

  return useCursorList<ContributionListItem>({
    queryKey: ['contributions', { status, entityType }],
    fetcher: (pageParam, signal) =>
      listContributionsRequest({ status, entityType, limit: PAGE_LIMIT, cursor: pageParam }, signal),
    enabled,
  });
}