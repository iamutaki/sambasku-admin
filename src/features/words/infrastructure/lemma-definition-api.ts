import { client } from '@/shared/api/client';
import type { ApiOkEnvelope } from '@/shared/api/types';
import type { LemmaDefinitionLookupResult } from '../domain/lemma-definition';

/**
 * GET /api/v1/lemma-definitions/lookup?lemma=
 * Prefill definisi dari KBBI (via backend kita - bukan hit raf555 langsung).
 */
export async function lookupLemmaDefinitionRequest(
  lemma: string,
  signal?: AbortSignal,
): Promise<LemmaDefinitionLookupResult> {
  const res = await client.get<ApiOkEnvelope<LemmaDefinitionLookupResult>>(
    '/lemma-definitions/lookup',
    { params: { lemma }, signal },
  );
  return res.data.data;
}
