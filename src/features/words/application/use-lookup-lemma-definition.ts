import { useMutation } from '@tanstack/react-query';
import { lookupLemmaDefinitionRequest } from '../infrastructure/lemma-definition-api';
import type { LemmaDefinitionLookupResult } from '../domain/lemma-definition';

/** Lookup lemma KBBI on-demand; trigger dari debounce keystroke di modal. */
export function useLookupLemmaDefinition() {
  return useMutation({
    mutationFn: (lemma: string): Promise<LemmaDefinitionLookupResult> =>
      lookupLemmaDefinitionRequest(lemma),
  });
}
