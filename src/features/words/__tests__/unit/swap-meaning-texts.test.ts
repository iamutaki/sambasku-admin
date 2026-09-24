import { describe, expect, it } from 'vitest';
import { swapMeaningTexts } from '../../application/swap-meaning-texts';

describe('swapMeaningTexts', () => {
  it('memindahkan definisi nyata ke terjemahan bila terjemahan placeholder', () => {
    expect(swapMeaningTexts({ definition: 'makan', translationText: '-' })).toEqual({
      definition: '-',
      translationText: 'makan',
      isHaveDefinition: false,
      isHaveTranslation: true,
    });
  });

  it('menukar kedua teks bila keduanya nyata', () => {
    expect(
      swapMeaningTexts({
        definition: 'aktivitas memasukkan makanan',
        translationText: 'makan',
      }),
    ).toEqual({
      definition: 'makan',
      translationText: 'aktivitas memasukkan makanan',
      isHaveDefinition: true,
      isHaveTranslation: true,
    });
  });
});
