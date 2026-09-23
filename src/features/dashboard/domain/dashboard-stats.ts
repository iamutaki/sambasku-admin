/**
 * Statistik dashboard - contract GET /api/v1/admin/dashboard/stats.
 * View model hasil normalisasi dari wire (snake_case) → camelCase.
 */
export type WordStatusKey = 'draft' | 'pending_review' | 'published' | 'rejected';
export type ContributionStatusKey = 'pending' | 'approved' | 'rejected' | 'corrected';
export type AppRoleKey = 'root' | 'admin' | 'editor' | 'reviewer' | 'contributor';

export interface DashboardStats {
  words: {
    total: number;
    verified: number;
    deleted: number;
    byStatus: Record<WordStatusKey, number>;
  };
  contributions: {
    total: number;
    byStatus: Record<ContributionStatusKey, number>;
  };
  users: {
    active: number;
    byRole: Record<AppRoleKey, number>;
  };
  activity: {
    auditLogsLast7Days: number;
  };
}

export const WORD_STATUS_LABELS: Record<WordStatusKey, string> = {
  draft: 'Draft',
  pending_review: 'Menunggu Review',
  published: 'Published',
  rejected: 'Ditolak',
};

export const CONTRIBUTION_STATUS_LABELS: Record<ContributionStatusKey, string> = {
  pending: 'Menunggu',
  approved: 'Disetujui',
  rejected: 'Ditolak',
  corrected: 'Dikoreksi',
};

export const ROLE_LABELS_SHORT: Record<AppRoleKey, string> = {
  root: 'Root',
  admin: 'Admin',
  editor: 'Editor',
  reviewer: 'Verifikator',
  contributor: 'Kontributor',
};

export const WORD_STATUS_TAG_COLOR: Record<WordStatusKey, string> = {
  published: 'green',
  pending_review: 'orange',
  draft: 'default',
  rejected: 'red',
};

export const CONTRIBUTION_STATUS_TAG_COLOR: Record<ContributionStatusKey, string> = {
  pending: 'orange',
  approved: 'green',
  rejected: 'red',
  corrected: 'gold',
};