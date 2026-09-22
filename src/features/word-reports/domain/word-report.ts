import {
  TAKEDOWN_REASON_CODES,
  TAKEDOWN_REASON_LABELS,
  type TakedownReasonCode,
} from '@/features/words/domain/word';

export { TAKEDOWN_REASON_CODES, TAKEDOWN_REASON_LABELS, type TakedownReasonCode };

export const WORD_REPORT_STATUSES = ['open', 'resolved'] as const;
export type WordReportStatus = (typeof WORD_REPORT_STATUSES)[number];

export const WORD_REPORT_RESOLUTIONS = ['dismissed', 'taken_down', 'corrected'] as const;
export type WordReportResolution = (typeof WORD_REPORT_RESOLUTIONS)[number];

export const WORD_REPORT_STATUS_LABELS: Record<WordReportStatus, string> = {
  open: 'Terbuka',
  resolved: 'Ditutup',
};

export const WORD_REPORT_RESOLUTION_LABELS: Record<WordReportResolution, string> = {
  dismissed: 'Ditolak',
  taken_down: 'Entri ditarik',
  corrected: 'Sudah diperbaiki',
};

export interface WordReportListItem {
  id: string;
  word_id: string;
  lemma: string;
  word_status: string;
  user_id: string;
  username: string | null;
  reason_code: TakedownReasonCode;
  note: string | null;
  status: WordReportStatus;
  resolution: WordReportResolution | null;
  resolution_note: string | null;
  resolved_at: string | null;
  created_at: string;
}

export function noteRequired(reason: TakedownReasonCode): boolean {
  return reason === 'other' || reason === 'duplicate';
}
