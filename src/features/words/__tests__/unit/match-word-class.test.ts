import { describe, it, expect } from 'vitest';
import { matchWordClassId } from '../../application/match-word-class';
import type { WordClassOption } from '../../domain/create-word';

const classes: WordClassOption[] = [
  { id: '01V', code: 'v', name: 'Verba', alias: 'Kata Kerja', parent_id: null },
  { id: '01N', code: 'n', name: 'Nomina', alias: 'Kata Benda', parent_id: null },
  { id: '01A', code: 'adj', name: 'Adjektiva', alias: 'Kata Sifat', parent_id: null },
];

describe('matchWordClassId', () => {
  it('match by code', () => {
    expect(matchWordClassId(classes, 'v', null)).toBe('01V');
    expect(matchWordClassId(classes, 'N', 'ignored')).toBe('01N');
  });

  it('KBBI code a → adj', () => {
    expect(matchWordClassId(classes, 'a', null)).toBe('01A');
  });

  it('fallback by label name', () => {
    expect(matchWordClassId(classes, null, 'Nomina')).toBe('01N');
  });

  it('no match → undefined', () => {
    expect(matchWordClassId(classes, 'xyz', 'Unknown')).toBeUndefined();
  });
});
