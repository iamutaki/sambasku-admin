import { describe, expect, it } from 'vitest';
import { verifierReviewerCardTitle } from '../../domain/verifier-application';

describe('verifierReviewerCardTitle', () => {
  it('approved → Disetujui oleh', () => {
    expect(verifierReviewerCardTitle('approved')).toBe('Disetujui oleh');
  });

  it('rejected → Ditolak oleh', () => {
    expect(verifierReviewerCardTitle('rejected')).toBe('Ditolak oleh');
  });

  it('pending → Direview oleh', () => {
    expect(verifierReviewerCardTitle('pending')).toBe('Direview oleh');
  });
});
