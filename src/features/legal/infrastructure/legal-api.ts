import { client } from '@/shared/api/client';
import type { ApiOkEnvelope } from '@/shared/api/types';
import type { AppSettingItem, LegalDocument, LegalDocumentStatus, LegalDocumentType } from '../domain/legal';

export async function listLegalDocumentsRequest(
  params: { type?: LegalDocumentType; status?: LegalDocumentStatus; limit?: number },
  signal?: AbortSignal,
): Promise<{ items: LegalDocument[]; next_cursor: string | null; has_more: boolean }> {
  const res = await client.get<
    ApiOkEnvelope<{ items: LegalDocument[]; next_cursor: string | null; has_more: boolean }>
  >('/admin/legal/documents', {
    params: {
      document_type: params.type,
      status: params.status,
      limit: params.limit ?? 50,
    },
    signal,
  });
  return res.data.data;
}

export async function createLegalDraftRequest(body: {
  document_type: LegalDocumentType;
  version: string;
  title: string;
  body_markdown: string;
}): Promise<LegalDocument> {
  const res = await client.post<ApiOkEnvelope<LegalDocument>>('/admin/legal/documents', body);
  return res.data.data;
}

export async function updateLegalDraftRequest(
  id: string,
  body: { title?: string; body_markdown?: string },
): Promise<LegalDocument> {
  const res = await client.patch<ApiOkEnvelope<LegalDocument>>(`/admin/legal/documents/${id}`, body);
  return res.data.data;
}

export async function publishLegalDocumentRequest(id: string): Promise<LegalDocument> {
  const res = await client.post<ApiOkEnvelope<LegalDocument>>(`/admin/legal/documents/${id}/publish`);
  return res.data.data;
}

export async function archiveLegalDocumentRequest(id: string): Promise<LegalDocument> {
  const res = await client.post<ApiOkEnvelope<LegalDocument>>(`/admin/legal/documents/${id}/archive`);
  return res.data.data;
}

export async function getLegalSettingsRequest(signal?: AbortSignal): Promise<AppSettingItem[]> {
  const res = await client.get<ApiOkEnvelope<{ settings: AppSettingItem[] }>>('/admin/legal/settings', {
    signal,
  });
  return res.data.data.settings;
}

export async function patchLegalSettingsRequest(
  settings: { key: string; value: string }[],
): Promise<AppSettingItem[]> {
  const res = await client.patch<ApiOkEnvelope<{ settings: AppSettingItem[] }>>('/admin/legal/settings', {
    settings,
  });
  return res.data.data.settings;
}
