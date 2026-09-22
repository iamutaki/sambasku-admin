import { describe, expect, it } from 'vitest';
import {
  COMMENT_STATUSES,
  COMMENT_STATUS_LABELS,
  COMMENT_STATUS_TAG_COLOR,
} from '@/features/comments/domain/comment';

describe('COMMENT_STATUS_*', () => {
  it('memiliki label untuk setiap status post-moderation', () => {
    expect(COMMENT_STATUSES).toEqual(['published', 'taken_down', 'deleted_by_author']);
    for (const status of COMMENT_STATUSES) {
      expect(COMMENT_STATUS_LABELS[status]).toBeTruthy();
    }
  });

  it('menyediakan warna tag antd untuk setiap status', () => {
    for (const status of COMMENT_STATUSES) {
      expect(COMMENT_STATUS_TAG_COLOR[status]).toBeTruthy();
    }
  });

  it('label & warna hanya untuk status yang valid', () => {
    expect(Object.keys(COMMENT_STATUS_LABELS).sort()).toEqual([...COMMENT_STATUSES].sort());
    expect(Object.keys(COMMENT_STATUS_TAG_COLOR).sort()).toEqual([...COMMENT_STATUSES].sort());
  });
});
