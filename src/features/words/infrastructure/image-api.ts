import { client } from '@/shared/api/client';
import type { ApiOkEnvelope } from '@/shared/api/types';
import { compressImageForUpload } from '@/shared/utils/compress-image';

/**
 * Upload gambar kata lewat API (GitHub) - multipart ke POST /api/v1/images.
 * Kompresi dulu (max 720×720, JPEG 80) selaras mobile.
 * ImageKit tetap dipakai laporan bug / bukti verifikator (endpoint token terpisah).
 */
export interface UploadedImage {
  url: string;
  file_id: string;
  provider: string;
  sha: string;
}

export async function uploadWordImage(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<UploadedImage> {
  const compressed = await compressImageForUpload(file);
  const maxBytes = 5 * 1024 * 1024;
  if (compressed.size > maxBytes) {
    throw new Error('Gambar masih terlalu besar setelah dikompresi (maks 5 MB)');
  }
  const form = new FormData();
  form.append('file', compressed);

  const res = await client.post<
    ApiOkEnvelope<{
      url: string;
      provider: string;
      provider_file_id: string;
      sha: string;
    }>
  >('/images?purpose=word', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e) => {
      if (e.total && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    },
  });

  const data = res.data.data;
  return {
    url: data.url,
    file_id: data.provider_file_id,
    provider: data.provider,
    sha: data.sha,
  };
}
