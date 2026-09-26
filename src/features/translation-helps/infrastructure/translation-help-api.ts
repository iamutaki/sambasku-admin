import { client } from '@/shared/api/client';
import type { ApiCursorPageEnvelope, ApiOkEnvelope, CursorPage } from '@/shared/api/types';
import type {
  ListTranslationHelpsParams,
  TranslationHelpDetail,
  TranslationHelpListItem,
  TranslationHelpReply,
} from '../domain/translation-help';

/**
 * GET /api/v1/admin/translation-helps - antrean moderasi (filter status, cursor).
 */
export async function listTranslationHelpsRequest(
  params: ListTranslationHelpsParams,
  signal?: AbortSignal,
): Promise<CursorPage<TranslationHelpListItem>> {
  const res = await client.get<ApiCursorPageEnvelope<TranslationHelpListItem>>(
    '/admin/translation-helps',
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

/**
 * GET /api/v1/admin/translation-helps/:id - detail + replies (URL ImageKit saat pending).
 */
export async function getTranslationHelpDetailRequest(
  id: string,
  signal?: AbortSignal,
): Promise<TranslationHelpDetail> {
  const res = await client.get<ApiOkEnvelope<TranslationHelpDetail>>(
    `/admin/translation-helps/${id}`,
    { signal },
  );
  return res.data.data;
}

/**
 * POST /api/v1/admin/translation-helps/:id/approve
 * Multipart file_0..file_N (gambar tersensor) atau JSON kosong (teks / rehost as-is).
 */
export async function approveTranslationHelpRequest(
  id: string,
  censoredFiles?: (Blob | null)[],
): Promise<TranslationHelpListItem> {
  const hasCensored = censoredFiles?.some((f) => f != null && f.size > 0);
  if (!hasCensored || !censoredFiles) {
    const res = await client.post<ApiOkEnvelope<TranslationHelpListItem>>(
      `/admin/translation-helps/${id}/approve`,
      {},
    );
    return res.data.data;
  }

  const form = new FormData();
  censoredFiles.forEach((blob, i) => {
    if (blob && blob.size > 0) {
      form.append(`file_${i}`, blob, `censored_${i}.jpg`);
    } else {
      // Slot kosong → backend unduh ulang dari ImageKit (byteLength 0).
      form.append(`file_${i}`, new Blob([], { type: 'application/octet-stream' }), `empty_${i}`);
    }
  });

  const res = await client.post<ApiOkEnvelope<TranslationHelpListItem>>(
    `/admin/translation-helps/${id}/approve`,
    form,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
      transformRequest: [
        (data, headers) => {
          // Biarkan browser set boundary; jangan pakai application/json default.
          if (data instanceof FormData && headers) {
            delete headers['Content-Type'];
          }
          return data;
        },
      ],
    },
  );
  return res.data.data;
}

/** POST /api/v1/admin/translation-helps/:id/reject - note wajib. */
export async function rejectTranslationHelpRequest(
  id: string,
  note: string,
): Promise<TranslationHelpListItem> {
  const res = await client.post<ApiOkEnvelope<TranslationHelpListItem>>(
    `/admin/translation-helps/${id}/reject`,
    { note },
  );
  return res.data.data;
}

/** POST /api/v1/admin/translation-helps/:id/takedown - tarik dari feed. */
export async function takedownTranslationHelpRequest(id: string): Promise<TranslationHelpListItem> {
  const res = await client.post<ApiOkEnvelope<TranslationHelpListItem>>(
    `/admin/translation-helps/${id}/takedown`,
  );
  return res.data.data;
}

/** POST /api/v1/admin/translation-helps/:id/pin-reply */
export async function pinTranslationHelpReplyRequest(
  helpId: string,
  replyId: string,
): Promise<TranslationHelpListItem> {
  const res = await client.post<ApiOkEnvelope<TranslationHelpListItem>>(
    `/admin/translation-helps/${helpId}/pin-reply`,
    { reply_id: replyId },
  );
  return res.data.data;
}

/** POST /api/v1/admin/translation-helps/replies/:id/takedown */
export async function takedownTranslationHelpReplyRequest(
  replyId: string,
): Promise<TranslationHelpReply> {
  const res = await client.post<ApiOkEnvelope<TranslationHelpReply>>(
    `/admin/translation-helps/replies/${replyId}/takedown`,
  );
  return res.data.data;
}
