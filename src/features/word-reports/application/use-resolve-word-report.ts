import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  dismissWordReportRequest,
  markWordReportCorrectedRequest,
  takedownFromReportRequest,
} from '../infrastructure/word-report-api';
import type { TakedownReasonCode } from '@/features/words/domain/word';

function useInvalidateReports() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ['word-reports'] });
    queryClient.invalidateQueries({ queryKey: ['words'] });
  };
}

export function useDismissWordReport() {
  const invalidate = useInvalidateReports();
  return useMutation({
    mutationFn: (input: { id: string; note?: string }) => dismissWordReportRequest(input.id, input.note),
    onSuccess: invalidate,
  });
}

export function useMarkWordReportCorrected() {
  const invalidate = useInvalidateReports();
  return useMutation({
    mutationFn: (input: { id: string; note?: string }) => markWordReportCorrectedRequest(input.id, input.note),
    onSuccess: invalidate,
  });
}

export function useTakedownFromReport() {
  const invalidate = useInvalidateReports();
  return useMutation({
    mutationFn: (input: { id: string; reason_code: TakedownReasonCode; note?: string }) =>
      takedownFromReportRequest(input.id, { reason_code: input.reason_code, note: input.note }),
    onSuccess: invalidate,
  });
}
