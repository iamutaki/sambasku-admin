import { useMutation, useQueryClient } from '@tanstack/react-query';
import { resolveBugReportRequest } from '../infrastructure/bug-report-api';
import type { BugReportListItem, BugReportStatus } from '../domain/bug-report';

export function useResolveBugReport() {
  const queryClient = useQueryClient();

  return useMutation<
    BugReportListItem,
    Error,
    { id: string; status: Exclude<BugReportStatus, 'open'>; note?: string }
  >({
    mutationFn: ({ id, status, note }) => resolveBugReportRequest(id, { status, note }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bug-reports'] });
    },
  });
}
