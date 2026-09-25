import { describe, expect, it } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import type { InfiniteData } from '@tanstack/react-query';
import type { CursorPage } from '@/shared/api/types';
import type { ContributionListItem } from '@/features/contributions/domain/contribution';
import { dropContributionFromListCaches } from '@/features/contributions/application/drop-contribution-from-cache';

function item(id: string): ContributionListItem {
  return {
    id,
    user_id: 'u1',
    contributor_username: 'budi',
    entity_type: 'word',
    entity_id: 'e1',
    action: 'create',
    status: 'pending',
    created_at: '2026-09-23T00:00:00.000Z',
    word_lemma: id,
  };
}

describe('dropContributionFromListCaches', () => {
  it('menghapus id dari cache list tanpa menyentuh detail', () => {
    const client = new QueryClient();
    const listKey = ['contributions', { status: 'pending', entityType: undefined }] as const;
    const detailKey = ['contributions', 'detail', 'a'] as const;

    const listData: InfiniteData<CursorPage<ContributionListItem>> = {
      pages: [
        {
          data: [item('a'), item('b')],
          meta: { limit: 20, next_cursor: null, has_more: false },
        },
      ],
      pageParams: [undefined],
    };

    client.setQueryData(listKey, listData);
    client.setQueryData(detailKey, { keep: true });

    dropContributionFromListCaches(client, 'a');

    const next = client.getQueryData<InfiniteData<CursorPage<ContributionListItem>>>(listKey);
    expect(next?.pages[0]?.data.map((row) => row.id)).toEqual(['b']);
    expect(client.getQueryData(detailKey)).toEqual({ keep: true });
  });
});
