import { useQuery } from '@tanstack/react-query';
import type { WordOfDay } from '../domain/word-of-day';
import { getWordOfDayRequest, type WordOfDayWire } from '../infrastructure/word-of-day-api';

function firstSense(wire: WordOfDayWire): string {
  const meaning = wire.meanings[0];
  if (!meaning) return '';
  const definition = meaning.definition?.trim();
  if (definition) return definition;
  return meaning.translations?.[0]?.translation_text?.trim() ?? '';
}

function normalize(wire: WordOfDayWire): WordOfDay {
  return {
    id: wire.id,
    lemma: wire.lemma,
    date: wire.date,
    isNewThisWeek: wire.is_new_this_week,
    firstSense: firstSense(wire),
  };
}

/**
 * Kata hari ini (GET /api/v1/words/today). staleTime 1 jam: kata tidak
 * berubah dalam satu hari WIB. retry 0: gagal = kartu hilang (soft-fail).
 */
export function useWordOfDay(): ReturnType<typeof useQuery<WordOfDay | null>> {
  return useQuery({
    queryKey: ['word-of-day'],
    queryFn: async ({ signal }) => {
      const wire = await getWordOfDayRequest(signal);
      return wire ? normalize(wire) : null;
    },
    staleTime: 60 * 60 * 1000,
    retry: false,
  });
}
