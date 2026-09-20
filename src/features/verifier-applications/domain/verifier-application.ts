export const VERIFIER_APPLICATION_STATUSES = ['pending', 'approved', 'rejected'] as const;
export type VerifierApplicationStatus = (typeof VERIFIER_APPLICATION_STATUSES)[number];

export const VERIFIER_APPLICATION_STATUS_LABELS: Record<VerifierApplicationStatus, string> = {
  pending: 'Menunggu',
  approved: 'Disetujui',
  rejected: 'Ditolak',
};

export const SOCIAL_PLATFORM_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  x: 'X',
  website: 'Website',
};

export interface VerifierApplicationSocialScreenshot {
  url: string;
  provider_file_id: string;
}

export interface VerifierApplicationSocialLink {
  platform: string;
  username: string;
  screenshot: VerifierApplicationSocialScreenshot;
}

export interface VerifierApplicationListItem {
  id: string;
  user_id: string;
  username: string | null;
  phone: string;
  status: VerifierApplicationStatus;
  created_at: string;
}

export interface VerifierApplicationDetail extends VerifierApplicationListItem {
  address: string;
  social_links: VerifierApplicationSocialLink[];
  admin_comment: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  updated_at: string | null;
}

export interface ListVerifierApplicationsParams {
  status?: VerifierApplicationStatus;
  limit?: number;
  cursor?: string;
}

export interface ApproveVerifierApplicationResult {
  id: string;
  status: 'approved';
  role: 'reviewer';
}

export interface RejectVerifierApplicationResult {
  id: string;
  status: 'rejected';
}
