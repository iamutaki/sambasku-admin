import { describe, expect, it } from 'vitest';
import { mergeAudiosForExamples } from '@/features/words/application/example-audios';
import type { WordDetailAudio } from '@/features/words/domain/word-detail';

function audio(partial: Partial<WordDetailAudio> & Pick<WordDetailAudio, 'id'>): WordDetailAudio {
  return {
    url: `https://cdn.example/${partial.id}.wav`,
    dialect_id: null,
    speaker_name: null,
    duration_ms: null,
    is_primary: false,
    mime_type: 'audio/wav',
    ...partial,
  };
}

describe('mergeAudiosForExamples', () => {
  it('menempelkan example_id dari contoh induk bila API tidak mengirimnya', () => {
    const merged = mergeAudiosForExamples(
      [audio({ id: 'lemma' })],
      [{ id: 'ex1', audios: [audio({ id: 'take1', speaker_name: 'siti' })] }],
    );

    expect(merged.find((a) => a.id === 'lemma')?.example_id).toBeUndefined();
    expect(merged.find((a) => a.id === 'take1')).toMatchObject({
      example_id: 'ex1',
      speaker_name: 'siti',
    });
  });

  it('tidak menduplikasi audio yang sudah ada di daftar lemma', () => {
    const take = audio({ id: 'take1', example_id: 'ex1' });
    const merged = mergeAudiosForExamples([take], [{ id: 'ex1', audios: [take] }]);
    expect(merged).toHaveLength(1);
  });
});
