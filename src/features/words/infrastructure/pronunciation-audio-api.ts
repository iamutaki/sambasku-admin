import { client } from '@/shared/api/client';
import type { ApiOkEnvelope } from '@/shared/api/types';

/** Respons 201 POST /api/v1/words/:wordId/pronunciations/audio */
export interface UploadedPronunciationAudio {
  id: string;
  word_id: string;
  example_id: string | null;
  dialect_id: string | null;
  url: string;
  mime_type: string;
  file_size: number;
  duration_ms: number | null;
  speaker_name: string | null;
  is_primary: boolean;
  status: string;
  is_verified: boolean;
  is_corrected: boolean;
}

export interface UploadPronunciationAudioFields {
  dialect_id?: string;
  example_id?: string;
  speaker_name?: string;
  duration_ms?: number;
}

const ACCEPTED_AUDIO = ['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/webm'];
const MAX_AUDIO_BYTES = 5 * 1024 * 1024;

/** Strip `;codecs=…` dll. — MediaRecorder sering mengirim `audio/webm;codecs=opus`. */
export function normalizeClientAudioMime(mime: string): string {
  return mime.toLowerCase().split(';')[0].trim();
}

export function validatePronunciationAudioFile(file: File): string | null {
  const mime = normalizeClientAudioMime(file.type);
  if (!ACCEPTED_AUDIO.includes(mime)) {
    return 'Format audio tidak didukung (mpeg, mp4, wav, ogg, webm).';
  }
  if (file.size <= 0) return 'File audio kosong.';
  if (file.size > MAX_AUDIO_BYTES) return 'File audio melebihi 5 MB.';
  return null;
}

/**
 * Upload file audio pelafalan — multipart ke API sambasku (bukan CDN terpisah).
 * Auth via interceptor `client` (Bearer access token).
 */
export async function uploadPronunciationAudioRequest(
  wordId: string,
  file: File,
  fields: UploadPronunciationAudioFields = {},
): Promise<UploadedPronunciationAudio> {
  const invalid = validatePronunciationAudioFile(file);
  if (invalid) throw new Error(invalid);

  const form = new FormData();
  form.append('audio', file);
  if (fields.dialect_id) form.append('dialect_id', fields.dialect_id);
  if (fields.example_id) form.append('example_id', fields.example_id);
  if (fields.speaker_name?.trim()) form.append('speaker_name', fields.speaker_name.trim());
  if (fields.duration_ms != null && fields.duration_ms > 0) {
    form.append('duration_ms', String(Math.round(fields.duration_ms)));
  }

  const res = await client.post<ApiOkEnvelope<UploadedPronunciationAudio>>(
    `/words/${wordId}/pronunciations/audio`,
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return res.data.data;
}
