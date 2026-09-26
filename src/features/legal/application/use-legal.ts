import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  archiveLegalDocumentRequest,
  createLegalDraftRequest,
  getLegalSettingsRequest,
  listLegalDocumentsRequest,
  patchLegalSettingsRequest,
  publishLegalDocumentRequest,
  updateLegalDraftRequest,
} from '../infrastructure/legal-api';
import type { LegalDocumentType } from '../domain/legal';

const docsKey = (type: LegalDocumentType) => ['admin-legal-docs', type] as const;
const settingsKey = ['admin-legal-settings'] as const;

export function useLegalDocuments(type: LegalDocumentType, enabled: boolean) {
  return useQuery({
    queryKey: docsKey(type),
    queryFn: ({ signal }) => listLegalDocumentsRequest({ type, limit: 50 }, signal),
    enabled,
  });
}

export function useLegalSettings(enabled: boolean) {
  return useQuery({
    queryKey: settingsKey,
    queryFn: ({ signal }) => getLegalSettingsRequest(signal),
    enabled,
  });
}

export function useLegalMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['admin-legal-docs'] });
    void qc.invalidateQueries({ queryKey: settingsKey });
  };

  return {
    createDraft: useMutation({
      mutationFn: createLegalDraftRequest,
      onSuccess: invalidate,
    }),
    updateDraft: useMutation({
      mutationFn: ({ id, ...body }: { id: string; title?: string; body_markdown?: string }) =>
        updateLegalDraftRequest(id, body),
      onSuccess: invalidate,
    }),
    publish: useMutation({
      mutationFn: publishLegalDocumentRequest,
      onSuccess: invalidate,
    }),
    archive: useMutation({
      mutationFn: archiveLegalDocumentRequest,
      onSuccess: invalidate,
    }),
    patchSettings: useMutation({
      mutationFn: patchLegalSettingsRequest,
      onSuccess: invalidate,
    }),
  };
}
