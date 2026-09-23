import { describe, expect, it } from 'vitest';
import { normalizePublicProfile } from '@/shared/users/public-profile';

describe('normalizePublicProfile', () => {
  it('memetakan wire snake_case ke profil tanpa id', () => {
    const profile = normalizePublicProfile({
      username: 'budi',
      role: 'reviewer',
      is_verifier: true,
      joined_at: '2026-08-01T00:00:00.000Z',
      avatar_url: null,
      stats: {
        contributions_approved: 12,
        verifications_done: 34,
        comments_published: 5,
      },
    });

    expect(profile).toEqual({
      username: 'budi',
      role: 'reviewer',
      isVerifier: true,
      joinedAt: '2026-08-01T00:00:00.000Z',
      avatarUrl: null,
      stats: {
        contributionsApproved: 12,
        verificationsDone: 34,
        commentsPublished: 5,
      },
    });
    expect(profile).not.toHaveProperty('id');
    expect(profile).not.toHaveProperty('user_id');
  });

  it('comments_published hilang → default 0', () => {
    const profile = normalizePublicProfile({
      username: 'ani',
      role: 'contributor',
      is_verifier: false,
      joined_at: '2026-08-01T00:00:00.000Z',
      avatar_url: 'https://cdn.example/ani.jpg',
      stats: {
        contributions_approved: 1,
        verifications_done: 0,
        // backend lama / wire parsial
        comments_published: undefined as unknown as number,
      },
    });

    expect(profile.avatarUrl).toBe('https://cdn.example/ani.jpg');
    expect(profile.stats.commentsPublished).toBe(0);
  });
});
