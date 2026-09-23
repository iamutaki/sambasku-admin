import { client } from '@/shared/api/client';
import type { ApiCursorPageEnvelope, ApiOkEnvelope, CursorPage } from '@/shared/api/types';
import type { TakedownReasonCode } from '@/features/words/domain/word';
import type { WordReportListItem, WordReportStatus } from '../domain/word-report';

export async function listWordReportsRequest(
  params: { status?: WordReportStatus; limit?: number; cursor?: string },
  signal?: AbortSignal,
): Promise<CursorPage<WordReportListItem>> {
  const res = await client.get<ApiCursorPageEnvelope<WordReportListItem>>('/admin/word-reports', {
    params: {
      status: params.status,
      limit: params.limit ?? 20,
      cursor: params.cursor,
    },
    signal,
  });
  return { data: res.data.data, meta: res.data.meta };
}

export async function getWordReportRequest(id: string, signal?: AbortSignal): Promise<WordReportListItem> {
  const res = await client.get<ApiOkEnvelope<WordReportListItem>>(`/admin/word-reports/${id}`, { signal });
  return res.data.data;
}

export async function dismissWordReportRequest(id: string, note?: string): Promise<WordReportListItem> {
  const res = await client.post<ApiOkEnvelope<WordReportListItem>>(`/admin/word-reports/${id}/dismiss`, {
    note,
  });
  return res.data.data;
}

export async function markWordReportCorrectedRequest(id: string, note?: string): Promise<WordReportListItem> {
  const res = await client.post<ApiOkEnvelope<WordReportListItem>>(
    `/admin/word-reports/${id}/mark-corrected`,
    { note },
  );
  return res.data.data;
}

export async function takedownFromReportRequest(
  id: string,
  body: { reason_code: TakedownReasonCode; note?: string },
): Promise<WordReportListItem> {
  const res = await client.post<ApiOkEnvelope<WordReportListItem>>(`/admin/word-reports/${id}/takedown`, body);
  return res.data.data;
}
