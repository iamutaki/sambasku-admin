import { describe, expect, it, vi } from 'vitest';
import {
  PHOTO_UPLOAD_MAX_HEIGHT,
  PHOTO_UPLOAD_MAX_WIDTH,
  PHOTO_UPLOAD_QUALITY,
  compressImageForUpload,
} from '../compress-image';

describe('compress-image constants', () => {
  it('selaras spek mobile 720 / 0.8', () => {
    expect(PHOTO_UPLOAD_MAX_WIDTH).toBe(720);
    expect(PHOTO_UPLOAD_MAX_HEIGHT).toBe(720);
    expect(PHOTO_UPLOAD_QUALITY).toBe(0.8);
  });
});

describe('compressImageForUpload', () => {
  it('non-image dikembalikan apa adanya', async () => {
    const file = new File(['hello'], 'a.txt', { type: 'text/plain' });
    const out = await compressImageForUpload(file);
    expect(out).toBe(file);
  });

  it('gagal decode → file asli', async () => {
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn().mockRejectedValue(new Error('bad')),
    );
    const file = new File([new Uint8Array([1, 2, 3])], 'a.png', {
      type: 'image/png',
    });
    const out = await compressImageForUpload(file);
    expect(out).toBe(file);
    vi.unstubAllGlobals();
  });
});
