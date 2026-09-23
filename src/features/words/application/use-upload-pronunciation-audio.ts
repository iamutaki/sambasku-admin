import { useMutation } from '@tanstack/react-query';
import { ApiError } from '@/shared/api/error';
import {
  type UploadPronunciationAudioFields,
  uploadPronunciationAudioRequest,
} from '../infrastructure/pronunciation-audio-api';

export function useUploadPronunciationAudio(wordId: string) {
  return useMutation({
    mutationFn: (input: { file: File; fields?: UploadPronunciationAudioFields }) =>
      uploadPronunciationAudioRequest(wordId, input.file, input.fields ?? {}),
    retry: (_, err) => !(err instanceof ApiError && err.status === 503),
  });
}
