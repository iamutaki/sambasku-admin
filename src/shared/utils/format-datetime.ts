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

/** Tanggal kalender YYYY-MM-DD tanpa geser zona. Contoh: `21 Sep 2026` */
export function formatDate(value: string | null | undefined): string {
  if (value == null || value === '') return '-';
  const parts = value.split('-');
  if (parts.length === 3) {
    const year = Number(parts[0]);
    const month = Number(parts[1]);
    const day = Number(parts[2]);
    if (
      Number.isInteger(year) &&
      year >= 1000 &&
      Number.isInteger(month) &&
      month >= 1 &&
      month <= 12 &&
      Number.isInteger(day) &&
      day >= 1 &&
      day <= 31 &&
      parts[0].length === 4 &&
      parts[1].length === 2 &&
      parts[2].length === 2
    ) {
      return `${day} ${MONTHS_ID[month - 1]} ${year}`;
    }
  }
  const d = dayjs(value);
  if (!d.isValid()) return '-';
  return `${d.date()} ${MONTHS_ID[d.month()]} ${d.year()}`;
}
