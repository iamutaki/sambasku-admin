export type AdminVoteTargetType =
  | 'word'
  | 'meaning'
  | 'example'
  | 'pronunciation'
  | 'word_image'
  | 'comment';

export interface AdminVoteListItem {
  id: string;
  voterId: string;
  voterUsername: string;
  voterEmail: string;
  targetType: AdminVoteTargetType;
  targetId: string;
  /** Body komentar / lemma / dll — dari API target_preview */
  targetPreview: string | null;
  value: 1 | -1;
  createdAt: string;
  updatedAt: string | null;
}

export interface AdminTopTargetItem {
  targetType: AdminVoteTargetType;
  targetId: string;
  targetPreview: string | null;
  upvotes: number;
  downvotes: number;
  net: number;
}

export const TARGET_TYPE_LABELS: Record<AdminVoteTargetType, string> = {
  word: 'Kata',
  meaning: 'Terjemahan',
  example: 'Contoh',
  pronunciation: 'Pelafalan',
  word_image: 'Gambar Kata',
  comment: 'Komentar',
};

export const TARGET_TYPE_TAG_COLOR: Record<AdminVoteTargetType, string> = {
  word: 'blue',
  meaning: 'purple',
  example: 'geekblue',
  pronunciation: 'orange',
  word_image: 'cyan',
  comment: 'green',
};

export const VALUE_LABELS: Record<1 | -1, string> = {
  1: 'Upvote',
  [-1]: 'Downvote',
};

export const TARGET_TYPE_OPTIONS: { value: AdminVoteTargetType; label: string }[] = (
  Object.keys(TARGET_TYPE_LABELS) as AdminVoteTargetType[]
).map((value) => ({ value, label: TARGET_TYPE_LABELS[value] }));

export const VALUE_OPTIONS: { value: 1 | -1; label: string }[] = [
  { value: 1, label: '↑ Upvote' },
  { value: -1, label: '↓ Downvote' },
];
