import { describe, expect, it } from 'vitest';
import { buildTargetsQuery, MAX_VOTE_TARGETS } from '@/features/votes/domain/vote';
import { toVoteCountMap } from '@/features/votes/application/use-vote-counts';
import type { VoteCountsItem } from '@/features/votes/domain/vote';

describe('buildTargetsQuery', () => {
  it('menggabung target dalam format "type:id" dipisah koma', () => {
    expect(buildTargetsQuery(['word:01A', 'comment:01B'])).toBe('word:01A,comment:01B');
  });

  it('menghapus duplikat target', () => {
    expect(buildTargetsQuery(['word:01A', 'word:01A', 'word:01B'])).toBe('word:01A,word:01B');
  });

  it('dipangkas ke MAX_VOTE_TARGETS (validasi backend seperti targetsQuerySchema)', () => {
    const many = Array.from({ length: MAX_VOTE_TARGETS + 10 }, (_, i) => `word:${i}`);
    const query = buildTargetsQuery(many);
    expect(query.split(',').length).toBe(MAX_VOTE_TARGETS);
  });

  it('target kosong → query kosong (hook disabled sebelumnya, defense-in-depth)', () => {
    expect(buildTargetsQuery([])).toBe('');
  });
});

describe('toVoteCountMap', () => {
  it('memetakan item counts ke key "type:id"', () => {
    const items: VoteCountsItem[] = [
      { target_type: 'word', target_id: '01A', upvotes: 4, downvotes: 1 },
      { target_type: 'comment', target_id: '01B', upvotes: 2, downvotes: 0 },
    ];
    expect(toVoteCountMap(items)).toEqual({
      'word:01A': { upvotes: 4, downvotes: 1 },
      'comment:01B': { upvotes: 2, downvotes: 0 },
    });
  });

  it('target tanpa vote (0/0) ikut dipetakan apa adanya', () => {
    const map = toVoteCountMap([{ target_type: 'word', target_id: '01A', upvotes: 0, downvotes: 0 }]);
    expect(map['word:01A']).toEqual({ upvotes: 0, downvotes: 0 });
  });
});