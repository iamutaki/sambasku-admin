import type { CreateWordRequest } from '@/features/words/domain/create-word';
import type { EntityType } from './contribution';

/**
 * Request body POST /api/v1/admin/contributions/:id/correct - discriminated
 * union pada `entity_type`. `publish` (opsional, default true) mengontrol
 * apakah koreksi langsung tayang (published+verified) atau HANYA ditimpa
 * (is_corrected=true, kontribusi tetap 'pending' tanpa review row).
 *
 * `comment` opsional; field entity mengikuti pola payload pembuatan aslinya
 * (create-word tanpa status / add-pronunciation / add-word-image / example).
 * Field opsional dengan nilai kosong TIDAK dikirim (batas kontrak API yang
 * ketat: `null` untuk `dialect_id`/`audio_url` dst. ditolak zod).
 */

export interface CorrectContributionShared {
  entity_type: EntityType;
  comment?: string;
  publish?: boolean;
}

/**
 * replace semantics: field create-word (tanpa status) Datar di root body,
 * sejajar `entity_type` / `publish`. API menolak bungkus `{ word: {...} }`.
 */
export type CorrectWordRequest = CorrectContributionShared &
  Omit<CreateWordRequest, 'status'> & {
    entity_type: 'word';
  };

export interface CorrectPronunciationRequest extends CorrectContributionShared {
  entity_type: 'pronunciation';
  notation: string;
  value: string;
  dialect_id?: string;
  audio_url?: string;
  speaker_name?: string;
  notes?: string;
}

export interface CorrectWordImageRequest extends CorrectContributionShared {
  entity_type: 'word_image';
  url: string;
  provider_file_id: string;
  alt_text?: string;
  is_primary: boolean;
}

export interface CorrectWordAudioRequest extends CorrectContributionShared {
  entity_type: 'word_audio';
  speaker_name?: string;
  dialect_id?: string;
  is_primary: boolean;
}

export interface CorrectExampleRequest extends CorrectContributionShared {
  entity_type: 'example';
  source_sentence: string;
  target_sentence?: string;
  source_type?: 'native_speaker' | 'book' | 'corpus' | 'interview' | 'other';
  notes?: string;
}

export type CorrectContributionRequest =
  | CorrectWordRequest
  | CorrectPronunciationRequest
  | CorrectWordImageRequest
  | CorrectWordAudioRequest
  | CorrectExampleRequest;