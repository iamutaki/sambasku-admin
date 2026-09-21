export interface PublicProfile {
  username: string;
  role: string;
  isVerifier: boolean;
  joinedAt: string;
  stats: {
    contributionsApproved: number;
    verificationsDone: number;
  };
}

export interface PublicProfileWire {
  username: string;
  role: string;
  is_verifier: boolean;
  joined_at: string;
  stats: {
    contributions_approved: number;
    verifications_done: number;
  };
}

/** Wire GET /users/:username → model UI. Tidak menyalin id / email / phone. */
export function normalizePublicProfile(data: PublicProfileWire): PublicProfile {
  return {
    username: data.username,
    role: data.role,
    isVerifier: data.is_verifier,
    joinedAt: data.joined_at,
    stats: {
      contributionsApproved: data.stats.contributions_approved,
      verificationsDone: data.stats.verifications_done,
    },
  };
}
