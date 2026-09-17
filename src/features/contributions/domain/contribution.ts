export const CONTRIBUTION_STATUSES = ['pending', 'approved', 'rejected', 'corrected'] as const;
export type ContributionStatus = (typeof CONTRIBUTION_STATUSES)[number];

export const ENTITY_TYPES = ['word', 'pronunciation', 'word_image', 'example'] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

export const CONTRIBUTION_STATUS_LABELS: Record<ContributionStatus, string> = {
  pending: 'Menunggu',
  approved: 'Disetujui',
  rejected: 'Ditolak',
  corrected: 'Dikoreksi',
};

export const ENTITY_TYPE_LABELS: Record<EntityType, string> = {
  word: 'Kata',
  pronunciation: 'Pengucapan',
  word_image: 'Gambar',
  example: 'Contoh Kalimat',
};

/**
 * Item antrean review - contract GET /api/v1/admin/contributions
 * (docs/api/03-api-kontribusi-verifikasi.md).
 */
export interface ContributionListItem {
  id: string;
  user_id: string;
  contributor_username: string;
  entity_type: EntityType;
  entity_id: string;
  action: string;
  status: ContributionStatus;
  created_at: string;
}

export interface ListContributionsParams {
  status?: ContributionStatus;
  entityType?: EntityType;
  limit?: number;
  cursor?: string;
}