/**
 * Jumlah vote per target - contract GET /api/v1/votes/counts
 * (08-api-upvote-downvote.md). Selalu dihitung on-read oleh backend;
 * admin hanya membacanya (read-only, tanpa tombol vote).
 */

export const MAX_VOTE_TARGETS = 50;

/** Slebar mentah item dari GET /votes/counts (snake_case apa adanya). */
export interface VoteCountsItem {
  target_type: string;
  target_id: string;
  upvotes: number;
  downvotes: number;
}

/**
 * Susun `targets` untuk query GET /votes/counts?targets=... (format
 * "type:id" dipisah koma). Dedupe + cap MAX_VOTE_TARGETS (validasi backend).
 */
export function buildTargetsQuery(targets: string[]): string {
  return [...new Set(targets)].slice(0, MAX_VOTE_TARGETS).join(',');
}