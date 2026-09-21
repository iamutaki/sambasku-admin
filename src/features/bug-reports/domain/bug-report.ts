export const BUG_REPORT_STATUSES = ['open', 'resolved', 'rejected'] as const;
export type BugReportStatus = (typeof BUG_REPORT_STATUSES)[number];

export const BUG_REPORT_STATUS_LABELS: Record<BugReportStatus, string> = {
  open: 'Terbuka',
  resolved: 'Selesai',
  rejected: 'Ditolak',
};

export const BUG_REPORT_STATUS_TAG_COLOR: Record<BugReportStatus, string> = {
  open: 'orange',
  resolved: 'green',
  rejected: 'red',
};

export interface BugReportImage {
  url: string;
  provider_file_id: string;
}

export interface BugReportListItem {
  id: string;
  user_id: string | null;
  username: string | null;
  device_id: string | null;
  description: string;
  images: BugReportImage[];
  app_version: string | null;
  platform: string | null;
  status: BugReportStatus;
  resolution_note: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface ListBugReportsParams {
  status?: BugReportStatus;
  limit?: number;
  cursor?: string;
}

export function platformLabel(item: Pick<BugReportListItem, 'platform' | 'app_version'>): string {
  const parts = [item.platform, item.app_version].filter(Boolean);
  return parts.length ? parts.join(' ') : '-';
}
