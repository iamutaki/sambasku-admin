import { describe, expect, it } from 'vitest';
import { adjacentPendingId, nextPendingId } from '@/features/contributions/application/next-pending-id';

describe('nextPendingId', () => {
  it('mengambil item setelah decided', () => {
    expect(nextPendingId(['a', 'b', 'c'], 'a')).toBe('b');
    expect(nextPendingId(['a', 'b', 'c'], 'b')).toBe('c');
  });

  it('null bila decided adalah item terakhir', () => {
    expect(nextPendingId(['a', 'b', 'c'], 'c')).toBeNull();
    expect(nextPendingId(['only'], 'only')).toBeNull();
  });

  it('fallback ke item pertama bila decided tidak ada di list', () => {
    expect(nextPendingId(['b', 'c'], 'a')).toBe('b');
    expect(nextPendingId([], 'a')).toBeNull();
  });
});

describe('adjacentPendingId', () => {
  it('maju dan mundur dalam batas', () => {
    expect(adjacentPendingId(['a', 'b', 'c'], 'a', 1)).toBe('b');
    expect(adjacentPendingId(['a', 'b', 'c'], 'b', -1)).toBe('a');
    expect(adjacentPendingId(['a', 'b', 'c'], 'a', -1)).toBe('a');
    expect(adjacentPendingId(['a', 'b', 'c'], 'c', 1)).toBe('c');
  });

  it('tanpa seleksi: j = pertama, k = terakhir', () => {
    expect(adjacentPendingId(['a', 'b'], undefined, 1)).toBe('a');
    expect(adjacentPendingId(['a', 'b'], undefined, -1)).toBe('b');
  });
});
