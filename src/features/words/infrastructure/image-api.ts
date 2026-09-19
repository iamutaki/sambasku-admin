import { client } from '@/shared/api/client';
import type { ApiOkEnvelope } from '@/shared/api/types';

/**
 * GET /api/v1/admin/images/upload-token - kredensial direct-upload
 * (05-support-image). Backend hanya menandatangani; byte gambar TIDAK
 * pernah melewati backend. 503 IMAGE_UPLOAD_UNAVAILABLE = IMAGEKIT_*
 * belum dikonfigurasi → fitur upload dimatikan di UI.
 */
export interface ImageUploadCredentials {
  token: string;
  signature: string;
  expire: number;
  public_key: string;
  upload_endpoint: string;
}

export interface UploadedImage {
  url: string;
  file_id: string;
}

export async function getUploadTokenRequest(): Promise<ImageUploadCredentials> {
  const res = await client.get<ApiOkEnvelope<ImageUploadCredentials>>('/admin/images/upload-token');
  return res.data.data;
}

/**
 * POST langsung ke CDN ImageKit - request POLOS, BUKAN axios `client`:
 * host berbeda, response bukan envelope sambasku, dan TANPA header
 * Authorization (otentikasinya justru signature dari token endpoint).
 * folder dikirim client sebagai param upload (bukan bagian signature).
 * Memakai XHR (bukan fetch) karena progress byte upload hanya bisa
 * dibaca dari `xhr.upload.onprogress`.
 */
export async function uploadToImageKit(
  file: File,
  creds: ImageUploadCredentials,
  onProgress?: (percent: number) => void,
): Promise<UploadedImage> {
  const form = new FormData();
  form.append('file', file);
  form.append('fileName', file.name);
  form.append('folder', '/words');
  form.append('publicKey', creds.public_key);
  form.append('token', creds.token);
  form.append('expire', String(creds.expire));
  form.append('signature', creds.signature);

  return new Promise<UploadedImage>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', creds.upload_endpoint);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(`Upload ke penyedia gagal (HTTP ${xhr.status})`));
        return;
      }
      const data = JSON.parse(xhr.responseText) as { url: string; fileId: string };
      resolve({ url: data.url, file_id: data.fileId });
    };
    xhr.onerror = () => reject(new Error('Upload ke penyedia gagal (jaringan)'));
    xhr.send(form);
  });
}
