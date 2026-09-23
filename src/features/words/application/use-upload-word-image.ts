import { useCallback, useState } from 'react';
import { ApiError } from '@/shared/api/error';
import { type UploadedImage, uploadWordImage } from '../infrastructure/image-api';

/**
 * Hook upload satu gambar kata: multipart ke API → GitHub.
 * 503 PUBLIC_IMAGE_UPLOAD_UNAVAILABLE → flag `unavailable`.
 */
export function useUploadWordImage() {
  const [unavailable, setUnavailable] = useState(false);

  const upload = useCallback(async (file: File, onProgress?: (percent: number) => void): Promise<UploadedImage> => {
    try {
      const uploaded = await uploadWordImage(file, onProgress);
      setUnavailable(false);
      return uploaded;
    } catch (err) {
      if (err instanceof ApiError && err.status === 503) setUnavailable(true);
      throw err;
    }
  }, []);

  return { upload, unavailable };
}
