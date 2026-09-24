import { useQuery } from '@tanstack/react-query';
import { getTranslationHelpDetailRequest } from '../infrastructure/translation-help-api';
import type { TranslationHelpDetail } from '../domain/translation-help';

export function useTranslationHelpDetail(id: string | undefined) {
  return useQuery<TranslationHelpDetail, Error>({
    queryKey: ['translation-helps', 'detail', id],
    queryFn: ({ signal }) => getTranslationHelpDetailRequest(id!, signal),
    enabled: !!id,
    staleTime: 30_000,
  });
}
