import { useCursorList } from '@/shared/hooks/use-cursor-list';
import { listVerifierApplicationsRequest } from '../infrastructure/verifier-application-api';
import type {
  VerifierApplicationListItem,
  VerifierApplicationStatus,
} from '../domain/verifier-application';

const PAGE_LIMIT = 20;

export function useVerifierApplicationList(args: {
  status?: VerifierApplicationStatus;
  enabled?: boolean;
} = {}) {
  const { status, enabled } = args;
  return useCursorList<VerifierApplicationListItem>({
    queryKey: ['verifier-applications', { status }],
    fetcher: (pageParam, signal) =>
      listVerifierApplicationsRequest({ status, limit: PAGE_LIMIT, cursor: pageParam }, signal),
    enabled,
  });
}
