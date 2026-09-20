import dayjs from 'dayjs';

/** Bulan singkat Indonesia (sama dengan mobile `format_datetime.dart`). */
const MONTHS_ID = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agu',
  'Sep',
  'Okt',
  'Nov',
  'Des',
] as const;

function formatParts(
  value: string | number | Date | null | undefined,
  withSeconds: boolean,
): string {
  if (value == null || value === '') return '-';
  const d = dayjs(value);
  if (!d.isValid()) return '-';
  const time = withSeconds ? d.format('HH:mm:ss') : d.format('HH:mm');
  return `${d.date()} ${MONTHS_ID[d.month()]} ${d.year()} ${time}`;
}

/**
 * Format tanggal-waktu UI Indonesia.
 * Contoh: `17 Nov 2026 21:00`
 *
 * Pola baku admin (lihat docs/admin/admin-base-stack.md).
 */
export function formatDateTime(
  value: string | number | Date | null | undefined,
): string {
  return formatParts(value, false);
}

/** Sama seperti formatDateTime + detik (audit log). Contoh: `17 Nov 2026 21:00:05` */
export function formatDateTimeSeconds(
  value: string | number | Date | null | undefined,
): string {
  return formatParts(value, true);
}
