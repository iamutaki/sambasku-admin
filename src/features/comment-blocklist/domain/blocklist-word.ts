export interface BlocklistWordItem {
  id: string;
  word: string;
  created_by: string | null;
  created_at: string;
}

export interface BulkBlocklistResult {
  created_count: number;
  skipped_count: number;
  invalid_count: number;
}
