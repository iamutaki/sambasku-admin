import { client } from '@/shared/api/client';
import type { ApiOkEnvelope } from '@/shared/api/types';

interface WordOfDayMeaningWire {
  definition: string | null;
  translations?: Array<{ translation_text: string }>;
}

/** Subset GET /api/v1/words/today yang dipakai kartu dashboard. */
export interface WordOfDayWire {
  id: string;
  lemma: string;
  date: string;
  is_new_this_week: boolean;
  meanings: WordOfDayMeaningWire[];
}

export async function getWordOfDayRequest(
  signal?: AbortSignal,
): Promise<WordOfDayWire | null> {
  const res = await client.get<ApiOkEnvelope<WordOfDayWire | null>>('/words/today', {
    signal,
  });
  return res.data.data;
}
