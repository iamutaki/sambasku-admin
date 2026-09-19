import { useCallback, useState } from 'react';
import { ApiError } from '@/shared/api/error';
import { type UploadedImage, getUploadTokenRequest, uploadToImageKit } from '../infrastructure/image-api';

/**
 * Hook upload satu gambar kata: token dari backend → POST langsung ke CDN.
 * 503 IMAGE_UPLOAD_UNAVAILABLE → flag `unavailable` true (UI mematikan
 * section upload tapi form tetap bisa disubmit tanpa gambar).
 * Token diambil sekali per file - TTL 30 menit jauh di atas durasi hidup
 * form; cache kalau kelak 429 token jadi masalah (burst 10 file).
 */
export function useUploadWordImage() {
  const [unavailable, setUnavailable] = useState(false);

  const upload = useCallback(async (file: File, onProgress?: (percent: number) => void): Promise<UploadedImage> => {
    try {
      const creds = await getUploadTokenRequest();
      setUnavailable(false);
      return await uploadToImageKit(file, creds, onProgress);
    } catch (err) {
      if (err instanceof ApiError && err.status === 503) setUnavailable(true);
      throw err;
    }
  }, []);

  return { upload, unavailable };
}
