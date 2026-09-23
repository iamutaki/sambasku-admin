import { describe, expect, it } from 'vitest';
import { formatDateTime, formatDateTimeSeconds, formatDate } from '@/shared/utils/format-datetime';

describe('formatDateTime', () => {
  it('format baku Indonesia tanpa detik', () => {
    // Tanpa Z = waktu lokal mesin; bentuk string tetap deterministik.
    expect(formatDateTime('2026-11-17T21:00:00')).toBe('17 Nov 2026 21:00');
  });

  it('bulan singkat locale id', () => {
    expect(formatDateTime('2026-05-01T09:05:00')).toBe('1 Mei 2026 09:05');
    expect(formatDateTime('2026-08-02T00:00:00')).toBe('2 Agu 2026 00:00');
    expect(formatDateTime('2026-10-03T12:30:00')).toBe('3 Okt 2026 12:30');
    expect(formatDateTime('2026-12-04T23:59:00')).toBe('4 Des 2026 23:59');
  });

  it('null/invalid → strip', () => {
    expect(formatDateTime(null)).toBe('-');
    expect(formatDateTime('bukan-tanggal')).toBe('-');
  });
});

describe('formatDateTimeSeconds', () => {
  it('menyertakan detik', () => {
    expect(formatDateTimeSeconds('2026-11-17T21:00:05')).toBe('17 Nov 2026 21:00:05');
  });
});

describe('formatDate', () => {
  it('YYYY-MM-DD tanpa geser zona', () => {
    expect(formatDate('2026-09-21')).toBe('21 Sep 2026');
    expect(formatDate('2026-08-02')).toBe('2 Agu 2026');
  });

  it('null/invalid → strip', () => {
    expect(formatDate(null)).toBe('-');
    expect(formatDate('bukan-tanggal')).toBe('-');
  });
});
