import { describe, it, expect } from 'vitest';
import { getNextCursor } from '@/shared/utils/cursor';
import type { CursorMeta } from '@/shared/api/types';

describe('getNextCursor', () => {
  it('mengembalikan next_cursor ketika has_more', () => {
    const meta: CursorMeta = { limit: 20, next_cursor: '01HXYZABC', has_more: true };
    expect(getNextCursor(meta)).toBe('01HXYZABC');
  });

  it('mengembalikan undefined pada halaman terakhir (has_more false)', () => {
    const meta: CursorMeta = { limit: 20, next_cursor: null, has_more: false };
    expect(getNextCursor(meta)).toBeUndefined();
  });

  it('tidak mengembalikan next_cursor yang null saat has_more anomali', () => {
    const meta: CursorMeta = { limit: 20, next_cursor: null, has_more: true };
    expect(getNextCursor(meta)).toBeUndefined();
  });
});