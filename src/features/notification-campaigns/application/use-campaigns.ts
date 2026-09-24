import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  cancelCampaignRequest,
  createCampaignRequest,
  createTemplateRequest,
  deleteTemplateRequest,
  estimateAudienceRequest,
  getCampaignRequest,
  listCampaignsRequest,
  listTemplatesRequest,
  retryCampaignRequest,
  sendCampaignRequest,
  updateTemplateRequest,
} from '../infrastructure/campaign-api';
import type { CampaignAudienceType, CampaignStatus, DeepLinkKind } from '../domain/campaign';

export function useTemplateList(enabled = true) {
  return useQuery({
    queryKey: ['notification-templates'],
    queryFn: ({ signal }) => listTemplatesRequest({ limit: 100 }, signal),
    enabled,
  });
}

export function useCreateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createTemplateRequest,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notification-templates'] }),
  });
}

export function useUpdateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...body
    }: {
      id: string;
      name?: string;
      title?: string;
      body?: string;
      deep_link_kind?: DeepLinkKind;
      deep_link_value?: string | null;
    }) => updateTemplateRequest(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notification-templates'] }),
  });
}

export function useDeleteTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteTemplateRequest,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notification-templates'] }),
  });
}

export function useCampaignList(status?: CampaignStatus, enabled = true) {
  return useInfiniteQuery({
    queryKey: ['notification-campaigns', status ?? 'all'],
    queryFn: ({ pageParam, signal }) =>
      listCampaignsRequest({ limit: 20, cursor: pageParam, status }, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => (last.meta.has_more ? last.meta.next_cursor ?? undefined : undefined),
    enabled,
  });
}

export function useCampaignDetail(id: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ['notification-campaign', id],
    queryFn: ({ signal }) => getCampaignRequest(id!, signal),
    enabled: Boolean(id) && enabled,
    refetchInterval: (q) => {
      const status = q.state.data?.status;
      return status === 'sending' || status === 'scheduled' ? 4000 : false;
    },
  });
}

export function useCreateCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createCampaignRequest,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notification-campaigns'] }),
  });
}

export function useSendCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: sendCampaignRequest,
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['notification-campaigns'] });
      qc.invalidateQueries({ queryKey: ['notification-campaign', data.id] });
    },
  });
}

export function useCancelCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: cancelCampaignRequest,
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['notification-campaigns'] });
      qc.invalidateQueries({ queryKey: ['notification-campaign', data.id] });
    },
  });
}

export function useRetryCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: retryCampaignRequest,
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['notification-campaigns'] });
      qc.invalidateQueries({ queryKey: ['notification-campaign', data.id] });
    },
  });
}

export function useEstimateAudience() {
  return useMutation({
    mutationFn: (body: { audience_type: CampaignAudienceType; user_ids?: string[] }) =>
      estimateAudienceRequest(body),
  });
}
