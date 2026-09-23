import { client } from '@/shared/api/client';
import type { ApiCursorPageEnvelope, ApiOkEnvelope, CursorPage } from '@/shared/api/types';
import type { BugReportListItem, BugReportStatus, ListBugReportsParams } from '../domain/bug-report';

export async function listBugReportsRequest(
  params: ListBugReportsParams,
  signal?: AbortSignal,
): Promise<CursorPage<BugReportListItem>> {
  const res = await client.get<ApiCursorPageEnvelope<BugReportListItem>>('/admin/bug-reports', {
    params: {
      status: params.status,
      limit: params.limit ?? 20,
      cursor: params.cursor,
    },
    signal,
  });
  return { data: res.data.data, meta: res.data.meta };
}

export async function resolveBugReportRequest(
  id: string,
  body: { status: Exclude<BugReportStatus, 'open'>; note?: string },
): Promise<BugReportListItem> {
  const res = await client.post<ApiOkEnvelope<BugReportListItem>>(`/admin/bug-reports/${id}/resolve`, body);
  return res.data.data;
}
