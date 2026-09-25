import { describe, expect, it } from 'vitest';
import { publicAudioUrlCandidates, resolvePublicAudioUrl } from '@/shared/utils/public-audio-url';

describe('resolvePublicAudioUrl', () => {
  it('rewrite legacy iamutaki repo ke sambasku/audios', () => {
    expect(
      resolvePublicAudioUrl(
        'https://cdn.jsdelivr.net/gh/iamutaki/sambasku-pronunciation@main/assets/audio/umum/x.wav',
      ),
    ).toBe('https://cdn.jsdelivr.net/gh/sambasku/audios@main/assets/audio/umum/x.wav');
  });

  it('rewrite staging-audios coem ke sambasku/audios', () => {
    expect(
      resolvePublicAudioUrl(
        'https://cdn.jsdelivr.net/gh/coem/staging-audios@main/assets/audio/umum/x.wav',
      ),
    ).toBe('https://cdn.jsdelivr.net/gh/sambasku/audios@main/assets/audio/umum/x.wav');
  });

  it('biarkan URL yang sudah benar', () => {
    const url = 'https://cdn.jsdelivr.net/gh/sambasku/audios@main/assets/audio/umum/x.wav';
    expect(resolvePublicAudioUrl(url)).toBe(url);
  });

  it('kosong → string kosong', () => {
    expect(resolvePublicAudioUrl(null)).toBe('');
    expect(resolvePublicAudioUrl('  ')).toBe('');
  });
});

describe('publicAudioUrlCandidates', () => {
  it('urutkan rewrite dulu, lalu asli bila beda', () => {
    expect(
      publicAudioUrlCandidates(
        'https://cdn.jsdelivr.net/gh/iamutaki/sambasku-pronunciation@main/a.wav',
      ),
    ).toEqual([
      'https://cdn.jsdelivr.net/gh/sambasku/audios@main/a.wav',
      'https://cdn.jsdelivr.net/gh/iamutaki/sambasku-pronunciation@main/a.wav',
    ]);
  });
});
