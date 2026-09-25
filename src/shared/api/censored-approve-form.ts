import { client } from '@/shared/api/client';
import type { ApiOkEnvelope } from '@/shared/api/types';

const multipartTransform = [
  (data: unknown, headers?: Record<string, unknown>) => {
    if (data instanceof FormData && headers) {
      delete headers['Content-Type'];
    }
    return data;
  },
];

export interface ImageDecisionWire {
  image_id?: string;
  key?: string;
  decision: 'approve' | 'reject';
}

/**
 * Bangun FormData approve: comment + image_decisions + file_<id> sensor.
 * Dipakai kontribusi kata (`image_id`) dan usul perubahan (`key`).
 */
export function buildCensoredApproveFormData(opts: {
  comment?: string;
  imageDecisions?: ImageDecisionWire[];
  /** Blob sensor per image id / key (hanya yang ditayangkan). */
  censoredByImageId?: Record<string, Blob>;
}): FormData {
  const form = new FormData();
  if (opts.comment?.trim()) form.append('comment', opts.comment.trim());
  if (opts.imageDecisions?.length) {
    form.append('image_decisions', JSON.stringify(opts.imageDecisions));
  }
  for (const [imageId, blob] of Object.entries(opts.censoredByImageId ?? {})) {
    if (blob && blob.size > 0) {
      form.append(`file_${imageId}`, blob, `censored_${imageId}.jpg`);
    }
  }
  return form;
}

export async function postMultipartApprove<T>(
  path: string,
  form: FormData,
): Promise<T> {
  const res = await client.post<ApiOkEnvelope<T>>(path, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    transformRequest: multipartTransform,
  });
  return res.data.data;
}
