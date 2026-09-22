import type { WordDetailAudio } from '../domain/word-detail';

/**
 * Gabungkan audio level kata dengan audio yang menempel di tiap contoh.
 * API menaruh audio contoh di `examples[].audios` tanpa `example_id`.
 * Pemutar admin mencocokkan lewat `example_id`, jadi field itu diisi dari id contoh induk.
 */
export function mergeAudiosForExamples(
  wordAudios: WordDetailAudio[],
  examples: { id: string; audios?: WordDetailAudio[] }[],
): WordDetailAudio[] {
  const seen = new Set<string>();
  const out: WordDetailAudio[] = [];
  const push = (audio: WordDetailAudio) => {
    if (seen.has(audio.id)) return;
    seen.add(audio.id);
    out.push(audio);
  };
  for (const audio of wordAudios) push(audio);
  for (const example of examples) {
    for (const audio of example.audios ?? []) {
      push({ ...audio, example_id: audio.example_id ?? example.id });
    }
  }
  return out;
}
