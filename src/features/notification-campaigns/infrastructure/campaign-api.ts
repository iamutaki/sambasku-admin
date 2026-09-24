import { client } from '@/shared/api/client';
import type { ApiCursorPageEnvelope, CursorPage } from '@/shared/api/types';
import type {
  CampaignAudienceType,
  CampaignDetail,
  CampaignStatus,
  DeepLinkKind,
  NotificationCampaign,
  NotificationTemplate,
} from '../domain/campaign';

interface TemplateWire {
  id: string;
  name: string;
  title: string;
  body: string;
  deep_link_kind: DeepLinkKind;
  deep_link_value: string | null;
  created_by: string;
  created_at: string;
  updated_at: string | null;
}

interface CampaignWire {
  id: string;
  template_id: string | null;
  title: string;
  body: string;
  deep_link_kind: DeepLinkKind;
  deep_link_value: string | null;
  audience_type: CampaignAudienceType;
  status: CampaignStatus;
  send_at: string | null;
  targeted_users: number;
  push_success: number;
  push_failed: number;
  inbox_written: number;
  topic_sent: boolean;
  last_error: string | null;
  created_by: string;
  created_at: string;
  updated_at: string | null;
}

function mapTemplate(w: TemplateWire): NotificationTemplate {
  return {
    id: w.id,
    name: w.name,
    title: w.title,
    body: w.body,
    deepLinkKind: w.deep_link_kind,
    deepLinkValue: w.deep_link_value,
    createdBy: w.created_by,
    createdAt: w.created_at,
    updatedAt: w.updated_at,
  };
}

function mapCampaign(w: CampaignWire): NotificationCampaign {
  return {
    id: w.id,
    templateId: w.template_id,
    title: w.title,
    body: w.body,
    deepLinkKind: w.deep_link_kind,
    deepLinkValue: w.deep_link_value,
    audienceType: w.audience_type,
    status: w.status,
    sendAt: w.send_at,
    targetedUsers: w.targeted_users,
    pushSuccess: w.push_success,
    pushFailed: w.push_failed,
    inboxWritten: w.inbox_written,
    topicSent: w.topic_sent,
    lastError: w.last_error,
    createdBy: w.created_by,
    createdAt: w.created_at,
    updatedAt: w.updated_at,
  };
}

export async function listTemplatesRequest(
  params: { limit?: number; cursor?: string } = {},
  signal?: AbortSignal,
): Promise<CursorPage<NotificationTemplate>> {
  const res = await client.get<ApiCursorPageEnvelope<TemplateWire>>(
    '/admin/notification-templates',
    { params: { limit: params.limit ?? 50, cursor: params.cursor }, signal },
  );
  return { data: res.data.data.map(mapTemplate), meta: res.data.meta };
}

export async function createTemplateRequest(body: {
  name: string;
  title: string;
  body: string;
  deep_link_kind: DeepLinkKind;
  deep_link_value?: string | null;
}): Promise<NotificationTemplate> {
  const res = await client.post<{ success: true; data: TemplateWire }>(
    '/admin/notification-templates',
    body,
  );
  return mapTemplate(res.data.data);
}

export async function updateTemplateRequest(
  id: string,
  body: Partial<{
    name: string;
    title: string;
    body: string;
    deep_link_kind: DeepLinkKind;
    deep_link_value: string | null;
  }>,
): Promise<NotificationTemplate> {
  const res = await client.patch<{ success: true; data: TemplateWire }>(
    `/admin/notification-templates/${id}`,
    body,
  );
  return mapTemplate(res.data.data);
}

export async function deleteTemplateRequest(id: string): Promise<void> {
  await client.delete(`/admin/notification-templates/${id}`);
}

export async function listCampaignsRequest(
  params: { limit?: number; cursor?: string; status?: CampaignStatus } = {},
  signal?: AbortSignal,
): Promise<CursorPage<NotificationCampaign>> {
  const res = await client.get<ApiCursorPageEnvelope<CampaignWire>>(
    '/admin/notification-campaigns',
    {
      params: {
        limit: params.limit ?? 20,
        cursor: params.cursor,
        status: params.status,
      },
      signal,
    },
  );
  return { data: res.data.data.map(mapCampaign), meta: res.data.meta };
}

export async function getCampaignRequest(
  id: string,
  signal?: AbortSignal,
): Promise<CampaignDetail> {
  const res = await client.get<{
    success: true;
    data: CampaignWire & {
      recipient_counts: CampaignDetail['recipientCounts'];
      failures: Array<{
        id: string;
        user_id: string;
        status: string;
        error: string | null;
      }>;
    };
  }>(`/admin/notification-campaigns/${id}`, { signal });
  const w = res.data.data;
  return {
    ...mapCampaign(w),
    recipientCounts: w.recipient_counts,
    failures: w.failures.map((f) => ({
      id: f.id,
      userId: f.user_id,
      status: f.status,
      error: f.error,
    })),
  };
}

export async function createCampaignRequest(body: {
  template_id?: string | null;
  title?: string;
  body?: string;
  deep_link_kind?: DeepLinkKind;
  deep_link_value?: string | null;
  audience_type: CampaignAudienceType;
  user_ids?: string[];
  send_at?: string | null;
}): Promise<NotificationCampaign> {
  const res = await client.post<{ success: true; data: CampaignWire }>(
    '/admin/notification-campaigns',
    body,
  );
  return mapCampaign(res.data.data);
}

export async function sendCampaignRequest(id: string): Promise<NotificationCampaign> {
  const res = await client.post<{ success: true; data: CampaignWire }>(
    `/admin/notification-campaigns/${id}/send`,
  );
  return mapCampaign(res.data.data);
}

export async function cancelCampaignRequest(id: string): Promise<NotificationCampaign> {
  const res = await client.post<{ success: true; data: CampaignWire }>(
    `/admin/notification-campaigns/${id}/cancel`,
  );
  return mapCampaign(res.data.data);
}

export async function retryCampaignRequest(id: string): Promise<NotificationCampaign> {
  const res = await client.post<{ success: true; data: CampaignWire }>(
    `/admin/notification-campaigns/${id}/retry`,
  );
  return mapCampaign(res.data.data);
}

export async function estimateAudienceRequest(body: {
  audience_type: CampaignAudienceType;
  user_ids?: string[];
}): Promise<{ users_with_device: number; devices: number }> {
  const res = await client.post<{
    success: true;
    data: { users_with_device: number; devices: number };
  }>('/admin/notification-campaigns/estimate', body);
  return res.data.data;
}
