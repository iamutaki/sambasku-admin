import { client } from '@/shared/api/client';
import type { ApiCursorPageEnvelope, ApiOkEnvelope, CursorPage } from '@/shared/api/types';
import type { SuggestionDetail, SuggestionListItem, SuggestionStatus } from '../domain/word-suggestion';

export async function listWordSuggestionsRequest(
  params: { status?: SuggestionStatus; limit?: number; cursor?: string },
  signal?: AbortSignal,
): Promise<CursorPage<SuggestionListItem>> {
  const res = await client.get<ApiCursorPageEnvelope<SuggestionListItem>>('/admin/word-suggestions', {
    params: {
      status: params.status,
      limit: params.limit ?? 20,
      cursor: params.cursor,
    },
    signal,
  });
  return { data: res.data.data, meta: res.data.meta };
}

export async function getWordSuggestionDetailRequest(
  id: string,
  signal?: AbortSignal,
): Promise<SuggestionDetail> {
  const res = await client.get<ApiOkEnvelope<SuggestionDetail>>(`/admin/word-suggestions/${id}`, {
    signal,
  });
  return res.data.data;
}

export async function approveWordSuggestionRequest(id: string, comment?: string) {
  const res = await client.post<ApiOkEnvelope<{ suggestion_id: string; word_lemma: string }>>(
    `/admin/word-suggestions/${id}/approve`,
    comment ? { comment } : {},
  );
  return res.data.data;
}

export async function rejectWordSuggestionRequest(id: string, comment: string) {
  const res = await client.post<ApiOkEnvelope<{ suggestion_id: string }>>(
    `/admin/word-suggestions/${id}/reject`,
    { comment },
  );
  return res.data.data;
}
