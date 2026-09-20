import { client } from '@/shared/api/client';
import type { ApiCursorPageEnvelope, ApiOkEnvelope, CursorPage } from '@/shared/api/types';
import type {
  ApproveVerifierApplicationResult,
  ListVerifierApplicationsParams,
  RejectVerifierApplicationResult,
  VerifierApplicationDetail,
  VerifierApplicationListItem,
} from '../domain/verifier-application';

export async function listVerifierApplicationsRequest(
  params: ListVerifierApplicationsParams,
  signal?: AbortSignal,
): Promise<CursorPage<VerifierApplicationListItem>> {
  const res = await client.get<ApiCursorPageEnvelope<VerifierApplicationListItem>>(
    '/admin/verifier-applications',
    {
      params: {
        status: params.status,
        limit: params.limit ?? 20,
        cursor: params.cursor,
      },
      signal,
    },
  );
  return { data: res.data.data, meta: res.data.meta };
}

export async function getVerifierApplicationDetailRequest(
  id: string,
  signal?: AbortSignal,
): Promise<VerifierApplicationDetail> {
  const res = await client.get<ApiOkEnvelope<VerifierApplicationDetail>>(
    `/admin/verifier-applications/${id}`,
    { signal },
  );
  return res.data.data;
}

export async function approveVerifierApplicationRequest(
  id: string,
): Promise<ApproveVerifierApplicationResult> {
  const res = await client.post<ApiOkEnvelope<ApproveVerifierApplicationResult>>(
    `/admin/verifier-applications/${id}/approve`,
    {},
  );
  return res.data.data;
}

export async function rejectVerifierApplicationRequest(
  id: string,
  comment: string,
): Promise<RejectVerifierApplicationResult> {
  const res = await client.post<ApiOkEnvelope<RejectVerifierApplicationResult>>(
    `/admin/verifier-applications/${id}/reject`,
    { comment },
  );
  return res.data.data;
}
