export interface PublicProfile {
  username: string;
  role: string;
  isVerifier: boolean;
  joinedAt: string;
  avatarUrl: string | null;
  stats: {
    contributionsApproved: number;
    verificationsDone: number;
    commentsPublished: number;
  };
}

export interface PublicProfileWire {
  username: string;
  role: string;
  is_verifier: boolean;
  joined_at: string;
  avatar_url: string | null;
  stats: {
    contributions_approved: number;
    verifications_done: number;
    comments_published: number;
  };
}

export interface PublicActivityItem {
  kind: 'contribution' | 'comment' | 'verification';
  occurredAt: string;
  wordId: string | null;
  lemma: string | null;
  summary: string;
}

export interface PublicActivityWire {
  items: Array<{
    kind: 'contribution' | 'comment' | 'verification';
    occurred_at: string;
    word_id: string | null;
    lemma: string | null;
    summary: string;
  }>;
}

/** Wire GET /users/:username → model UI. Tidak menyalin id / email / phone. */
export function normalizePublicProfile(data: PublicProfileWire): PublicProfile {
  return {
    username: data.username,
    role: data.role,
    isVerifier: data.is_verifier,
    joinedAt: data.joined_at,
    avatarUrl: data.avatar_url,
    stats: {
      contributionsApproved: data.stats.contributions_approved,
      verificationsDone: data.stats.verifications_done,
      commentsPublished: data.stats.comments_published ?? 0,
    },
  };
}

export function normalizePublicActivity(data: PublicActivityWire): PublicActivityItem[] {
  return data.items.map((item) => ({
    kind: item.kind,
    occurredAt: item.occurred_at,
    wordId: item.word_id,
    lemma: item.lemma,
    summary: item.summary,
  }));
}
