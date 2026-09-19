import { client } from '@/shared/api/client';
import type { ApiCursorPageEnvelope, ApiOkEnvelope, CursorPage } from '@/shared/api/types';
import type { AdminVoteTargetType } from '../domain/vote-admin';

export interface AdminVoteWire {
  id: string;
  voter_id: string;
  voter_username: string;
  voter_email: string;
  target_type: AdminVoteTargetType;
  target_id: string;
  target_preview: string | null;
  value: 1 | -1;
  created_at: string;
  updated_at: string | null;
}

export interface AdminTopTargetWire {
  target_type: AdminVoteTargetType;
  target_id: string;
  target_preview: string | null;
  upvotes: number;
  downvotes: number;
  net: number;
}

export interface ResetTargetVotesResultWire {
  target_type: AdminVoteTargetType;
  target_id: string;
  deleted_count: number;
}

export interface ListAdminVotesParams {
  q?: string;
  targetType?: AdminVoteTargetType;
  value?: 1 | -1;
  targetId?: string;
  limit?: number;
  cursor?: string;
}

/**
 * GET /api/v1/admin/votes - daftar vote (join voter) dengan filter AND
 * opsional + cursor pagination. Response wire TIDAK mengandung password_hash
 * (NFR-5 - backend select kolom aman saja).
 */
export async function listAdminVotesRequest(
  params: ListAdminVotesParams,
  signal?: AbortSignal,
): Promise<CursorPage<AdminVoteWire>> {
  const res = await client.get<ApiCursorPageEnvelope<AdminVoteWire>>('/admin/votes', {
    params: {
      q: params.q || undefined,
      target_type: params.targetType,
      value: params.value,
      target_id: params.targetId || undefined,
      limit: params.limit ?? 20,
      cursor: params.cursor,
    },
    signal,
  });
  return { data: res.data.data, meta: res.data.meta };
}

/** DELETE /api/v1/admin/votes/:id - hapus satu vote spam (hard delete). */
export async function deleteAdminVoteRequest(id: string, signal?: AbortSignal): Promise<unknown> {
  const res = await client.delete<ApiOkEnvelope<unknown>>(`/admin/votes/${id}`, { signal });
  return res.data.data;
}

/**
 * DELETE /api/v1/admin/votes/reset-target - hapus SEMUA vote satu target
 * (anti-brigading). Return jumlah baris yang dihapus.
 */
export async function resetTargetVotesRequest(
  body: { targetType: AdminVoteTargetType; targetId: string },
  signal?: AbortSignal,
): Promise<ResetTargetVotesResultWire> {
  const res = await client.delete<ApiOkEnvelope<ResetTargetVotesResultWire>>(
    '/admin/votes/reset-target',
    { data: { target_type: body.targetType, target_id: body.targetId }, signal },
  );
  return res.data.data;
}

/** GET /api/v1/admin/votes/top-targets - target terurut skor bersih desc. */
export async function getTopTargetsRequest(
  params: { targetType: AdminVoteTargetType; limit?: number },
  signal?: AbortSignal,
): Promise<AdminTopTargetWire[]> {
  const res = await client.get<ApiOkEnvelope<AdminTopTargetWire[]>>('/admin/votes/top-targets', {
    params: { target_type: params.targetType, limit: params.limit ?? 50 },
    signal,
  });
  return res.data.data;
}
