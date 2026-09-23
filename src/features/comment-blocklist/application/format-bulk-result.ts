import type { BulkBlocklistResult } from '../domain/blocklist-word';

export function formatBulkResultMessage(result: BulkBlocklistResult): string {
  const parts: string[] = [];
  if (result.created_count > 0) parts.push(`${result.created_count} kata ditambahkan`);
  if (result.skipped_count > 0) parts.push(`${result.skipped_count} duplikat diabaikan`);
  if (result.invalid_count > 0) {
    parts.push(`${result.invalid_count} tidak valid (lebih dari 100 karakter)`);
  }
  return parts.join(', ') || 'Tidak ada kata yang ditambahkan';
}

export function bulkResultTone(result: BulkBlocklistResult): 'success' | 'info' | 'warning' {
  if (result.created_count > 0) return 'success';
  if (result.skipped_count > 0 && result.invalid_count === 0) return 'info';
  return 'warning';
}
