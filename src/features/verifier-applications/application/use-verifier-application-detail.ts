import { useQuery } from '@tanstack/react-query';
import { getVerifierApplicationDetailRequest } from '../infrastructure/verifier-application-api';
import type { VerifierApplicationDetail } from '../domain/verifier-application';

export function useVerifierApplicationDetail(id: string | undefined) {
  return useQuery<VerifierApplicationDetail, Error>({
    queryKey: ['verifier-applications', 'detail', id],
    queryFn: ({ signal }) => getVerifierApplicationDetailRequest(id!, signal),
    enabled: !!id,
    staleTime: 30_000,
  });
}
