import { client } from '@/shared/api/client';
import type { ApiCursorPageEnvelope, CursorPage } from '@/shared/api/types';
import type { ContributionListItem, ListContributionsParams } from '../domain/contribution';

/**
 * GET /api/v1/admin/contributions — antrean review kontribusi
 * (role: admin/root/reviewer; filter status/entity_type, cursor pagination).
 * Bentuk backend: `{ success, data: [...], meta }` — dinormalisasi jadi
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