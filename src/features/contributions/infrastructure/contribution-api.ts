import { client } from '@/shared/api/client';
import type { ApiCursorPageEnvelope, ApiOkEnvelope, CursorPage } from '@/shared/api/types';
import {
  buildCensoredApproveFormData,
  postMultipartApprove,
} from '@/shared/api/censored-approve-form';
import type {
  ContributionDetailPayload,
  ContributionListItem,
  ListContributionsParams,
  ReviewDecisionResult,
} from '../domain/contribution';
import type { CorrectContributionRequest } from '../domain/correct-contribution';

/**
 * GET /api/v1/admin/contributions - antrean review kontribusi
 * (role: admin/root/reviewer; filter status/entity_type, cursor pagination).
 * Bentuk backend: `{ success, data: [...], meta }` - dinormalisasi jadi
 * `CursorPage`.
 */
export async function listContributionsRequest(
  params: ListContributionsParams,
  signal?: AbortSignal,
): Promise<CursorPage<ContributionListItem>> {
  const res = await client.get<ApiCursorPageEnvelope<ContributionListItem>>('/admin/contributions', {
    params: {
      status: params.status,
      entity_type: params.entityType,
      limit: params.limit ?? 20,
      cursor: params.cursor,
    },
    signal,
  });
  return { data: res.data.data, meta: res.data.meta };
}

/**
 * GET /api/v1/admin/contributions/:id - detail kontribusi + payload entity
 * utuh untuk layar review (word detail semua status / row anak + parent).
 */
export async function getContributionDetailRequest(
  id: string,
  signal?: AbortSignal,
): Promise<ContributionDetailPayload> {
  const res = await client.get<ApiOkEnvelope<ContributionDetailPayload>>(`/admin/contributions/${id}`, {
    signal,
  });
  return res.data.data;
}

/** POST /api/v1/admin/contributions/:id/approve - JSON atau multipart sensor. */
export async function approveContributionRequest(
  id: string,
  comment?: string,
  imageDecisions?: { image_id: string; decision: 'approve' | 'reject' }[],
  censoredByImageId?: Record<string, Blob>,
): Promise<ReviewDecisionResult> {
  const hasCensored = Object.values(censoredByImageId ?? {}).some((b) => b && b.size > 0);
  if (!hasCensored) {
    const res = await client.post<ApiOkEnvelope<ReviewDecisionResult>>(`/admin/contributions/${id}/approve`, {
      ...(comment ? { comment } : {}),
      ...(imageDecisions?.length ? { image_decisions: imageDecisions } : {}),
    });
    return res.data.data;
  }

  const form = buildCensoredApproveFormData({
    comment,
    imageDecisions,
    censoredByImageId,
  });
  return postMultipartApprove<ReviewDecisionResult>(`/admin/contributions/${id}/approve`, form);
}

/** POST /api/v1/admin/contributions/:id/reject - tolak (comment WAJIB). */
export async function rejectContributionRequest(id: string, comment: string): Promise<ReviewDecisionResult> {
  const res = await client.post<ApiOkEnvelope<ReviewDecisionResult>>(`/admin/contributions/${id}/reject`, {
    comment,
  });
  return res.data.data;
}

/** POST /api/v1/admin/contributions/:id/correct - koreksi oleh verifikator. */
export async function correctContributionRequest(
  id: string,
  body: CorrectContributionRequest,
): Promise<ReviewDecisionResult> {
  const res = await client.post<ApiOkEnvelope<ReviewDecisionResult>>(`/admin/contributions/${id}/correct`, body);
  return res.data.data;
}