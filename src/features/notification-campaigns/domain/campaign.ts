export type DeepLinkKind = 'word' | 'contribution' | 'suggestion' | 'url' | 'none';
export type CampaignAudienceType = 'all' | 'selected';
export type CampaignStatus =
  | 'draft'
  | 'scheduled'
  | 'sending'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface NotificationTemplate {
  id: string;
  name: string;
  title: string;
  body: string;
  deepLinkKind: DeepLinkKind;
  deepLinkValue: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string | null;
}

export interface NotificationCampaign {
  id: string;
  templateId: string | null;
  title: string;
  body: string;
  deepLinkKind: DeepLinkKind;
  deepLinkValue: string | null;
  audienceType: CampaignAudienceType;
  status: CampaignStatus;
  sendAt: string | null;
  targetedUsers: number;
  pushSuccess: number;
  pushFailed: number;
  inboxWritten: number;
  topicSent: boolean;
  lastError: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string | null;
}

export interface CampaignDetail extends NotificationCampaign {
  recipientCounts: {
    pending: number;
    sent: number;
    failed: number;
    skipped_no_token: number;
  } | null;
  failures: Array<{
    id: string;
    userId: string;
    status: string;
    error: string | null;
  }>;
}

export const CAMPAIGN_STATUS_LABELS: Record<CampaignStatus, string> = {
  draft: 'Draft',
  scheduled: 'Terjadwal',
  sending: 'Mengirim',
  completed: 'Selesai',
  failed: 'Gagal',
  cancelled: 'Dibatalkan',
};

export const CAMPAIGN_STATUS_COLORS: Record<CampaignStatus, string> = {
  draft: 'default',
  scheduled: 'blue',
  sending: 'processing',
  completed: 'success',
  failed: 'error',
  cancelled: 'warning',
};

export const DEEP_LINK_KIND_LABELS: Record<DeepLinkKind, string> = {
  none: 'Tanpa deep link',
  word: 'Kata',
  contribution: 'Kontribusi',
  suggestion: 'Usul edit',
  url: 'URL',
};

export const AUDIENCE_LABELS: Record<CampaignAudienceType, string> = {
  all: 'Semua device aktif',
  selected: 'Pengguna terpilih',
};
