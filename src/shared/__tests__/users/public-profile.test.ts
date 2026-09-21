import { describe, expect, it } from 'vitest';
import { normalizePublicProfile } from '@/shared/users/public-profile';

describe('normalizePublicProfile', () => {
  it('memetakan wire snake_case ke profil tanpa id', () => {
    const profile = normalizePublicProfile({
      username: 'budi',
      role: 'reviewer',
      is_verifier: true,
      joined_at: '2026-08-01T00:00:00.000Z',
      stats: { contributions_approved: 12, verifications_done: 34 },
    });

    expect(profile).toEqual({
      username: 'budi',
      role: 'reviewer',
      isVerifier: true,
      joinedAt: '2026-08-01T00:00:00.000Z',
      stats: { contributionsApproved: 12, verificationsDone: 34 },
    });
    expect(profile).not.toHaveProperty('id');
    expect(profile).not.toHaveProperty('user_id');
  });
});
