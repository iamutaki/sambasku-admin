export type SearchMissDirection = 'lemma' | 'translation';
export type SearchMissStatusKey = 'pending' | 'fulfilled' | 'dismissed';

export interface SearchMissListItem {
  id: string;
  term: string;
  direction: SearchMissDirection;
  searchCount: number;
  fulfilled: boolean;
  isVisible: boolean;
  createdAt: string;
}

export const DIRECTION_LABELS: Record<SearchMissDirection, string> = {
  lemma: 'Lemma (Kata)',
  translation: 'Terjemahan',
};

export const DIRECTION_TAG_COLOR: Record<SearchMissDirection, string> = {
  lemma: 'blue',
  translation: 'purple',
};
