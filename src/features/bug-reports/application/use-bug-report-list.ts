import { useCursorList } from '@/shared/hooks/use-cursor-list';
import { listBugReportsRequest } from '../infrastructure/bug-report-api';
import type { BugReportListItem, BugReportStatus } from '../domain/bug-report';

const PAGE_LIMIT = 20;

export function useBugReportList(args: { status?: BugReportStatus; enabled?: boolean } = {}) {
  const { status, enabled } = args;
  return useCursorList<BugReportListItem>({
    queryKey: ['bug-reports', { status }],
    fetcher: (pageParam, signal) =>
      listBugReportsRequest({ status, limit: PAGE_LIMIT, cursor: pageParam }, signal),
    enabled,
  });
}
