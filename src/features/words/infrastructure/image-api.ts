import { client } from '@/shared/api/client';
import type { ApiOkEnvelope } from '@/shared/api/types';

/**
 * Upload gambar kata lewat API (GitHub) — multipart ke POST /api/v1/images.
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
  const form = new FormData();
  form.append('file', file);

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
