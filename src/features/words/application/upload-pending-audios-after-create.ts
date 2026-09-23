import { getAdminWordDetailRequest } from '../infrastructure/word-api';
import { uploadPronunciationAudioRequest } from '../infrastructure/pronunciation-audio-api';
import type { PendingPronunciationAudio } from '../presentation/word-form-blocks';

export interface PendingExampleAudioDraft {
  meaningIndex: number;
  exampleIndex: number;
  sourceSentence: string;
  audio: PendingPronunciationAudio;
}

export interface UploadPendingAudiosResult {
  lemmaOk: boolean;
  exampleOk: number;
  exampleFail: number;
  errors: string[];
}

/**
 * Sequence setelah create kata:
 * 1) upload audio lemma (tanpa example_id)
 * 2) GET detail → cocokkan contoh (kalimat / urutan) → upload per example_id
 *
 * Create response tidak mengembalikan example_id; GET detail menutup celah itu.
 */
export async function uploadPendingAudiosAfterCreate(input: {
  wordId: string;
  lemmaAudio: PendingPronunciationAudio | null;
  exampleAudios: PendingExampleAudioDraft[];
}): Promise<UploadPendingAudiosResult> {
  const errors: string[] = [];
  let lemmaOk = false;
  let exampleOk = 0;
  let exampleFail = 0;

  if (input.lemmaAudio) {
    try {
      await uploadPronunciationAudioRequest(input.wordId, input.lemmaAudio.file, {
        ...(input.lemmaAudio.dialectId ? { dialect_id: input.lemmaAudio.dialectId } : {}),
        ...(input.lemmaAudio.speakerName
          ? { speaker_name: input.lemmaAudio.speakerName }
          : {}),
        ...(input.lemmaAudio.durationMs > 0
          ? { duration_ms: input.lemmaAudio.durationMs }
          : {}),
      });
      lemmaOk = true;
      if (input.lemmaAudio.previewUrl) URL.revokeObjectURL(input.lemmaAudio.previewUrl);
    } catch (err) {
      errors.push(
        err instanceof Error ? `Audio lemma: ${err.message}` : 'Audio lemma gagal diunggah',
      );
    }
  }

  if (input.exampleAudios.length === 0) {
    return { lemmaOk, exampleOk, exampleFail, errors };
  }

  let detail;
  try {
    detail = await getAdminWordDetailRequest(input.wordId);
  } catch (err) {
    errors.push(
      err instanceof Error
        ? `Gagal ambil detail untuk audio contoh: ${err.message}`
        : 'Gagal ambil detail untuk audio contoh',
    );
    return {
      lemmaOk,
      exampleOk,
      exampleFail: input.exampleAudios.length,
      errors,
    };
  }

  for (const draft of input.exampleAudios) {
    const meaning = detail.meanings[draft.meaningIndex];
    const sentence = draft.sourceSentence.trim();
    const example =
      meaning?.examples.find((e) => e.source_sentence.trim() === sentence) ??
      meaning?.examples[draft.exampleIndex] ??
      null;

    if (!example) {
      exampleFail += 1;
      errors.push(
        `Audio contoh tidak cocok ke ID server (makna ${draft.meaningIndex + 1}, contoh ${draft.exampleIndex + 1})`,
      );
      continue;
    }

    try {
      await uploadPronunciationAudioRequest(input.wordId, draft.audio.file, {
        example_id: example.id,
        ...(draft.audio.dialectId ? { dialect_id: draft.audio.dialectId } : {}),
        ...(draft.audio.speakerName ? { speaker_name: draft.audio.speakerName } : {}),
        ...(draft.audio.durationMs > 0 ? { duration_ms: draft.audio.durationMs } : {}),
      });
      exampleOk += 1;
      if (draft.audio.previewUrl) URL.revokeObjectURL(draft.audio.previewUrl);
    } catch (err) {
      exampleFail += 1;
      errors.push(
        err instanceof Error
          ? `Audio contoh “${sentence.slice(0, 40)}…”: ${err.message}`
          : 'Audio contoh gagal diunggah',
      );
    }
  }

  return { lemmaOk, exampleOk, exampleFail, errors };
}
