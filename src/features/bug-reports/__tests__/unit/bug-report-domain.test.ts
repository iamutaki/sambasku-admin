import { describe, it, expect } from 'vitest';
import { BUG_REPORT_STATUS_LABELS, platformLabel } from '../../domain/bug-report';

describe('bug-report domain', () => {
  it('label status bahasa Indonesia', () => {
    expect(BUG_REPORT_STATUS_LABELS.open).toBe('Terbuka');
    expect(BUG_REPORT_STATUS_LABELS.resolved).toBe('Selesai');
    expect(BUG_REPORT_STATUS_LABELS.rejected).toBe('Ditolak');
  });

  it('platform + versi, kosong jadi strip', () => {
    expect(platformLabel({ platform: 'android', app_version: '0.1.0' })).toBe('android 0.1.0');
    expect(platformLabel({ platform: null, app_version: null })).toBe('-');
  });
});
