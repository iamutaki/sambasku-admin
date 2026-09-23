import { useQuery } from '@tanstack/react-query';
import { useCursorList } from '@/shared/hooks/use-cursor-list';
import { getWordReportRequest, listWordReportsRequest } from '../infrastructure/word-report-api';
import type { WordReportListItem, WordReportStatus } from '../domain/word-report';

const PAGE_LIMIT = 20;

export function useWordReportList(args: { status?: WordReportStatus } = {}) {
  const { status } = args;
  return useCursorList<WordReportListItem>({
    queryKey: ['word-reports', { status }],
    fetcher: (pageParam, signal) =>
      listWordReportsRequest({ status, limit: PAGE_LIMIT, cursor: pageParam }, signal),
  });
}

export function useWordReport(id: string) {
  return useQuery({
    queryKey: ['word-reports', 'detail', id],
    queryFn: ({ signal }) => getWordReportRequest(id, signal),
    enabled: id.length > 0,
  });
}
