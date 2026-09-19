import { client } from '@/shared/api/client';
import type { ApiOkEnvelope } from '@/shared/api/types';

/**
 * Bentuk wire (snake_case) dari GET /api/v1/admin/dashboard/stats -
 * dinormalisasi di aplikasi layer (dashboard-mappers) ke view model.
 */
export interface DashboardStatsWire {
  words: {
    total: number;
    verified: number;
    deleted: number;
    by_status: Record<string, number>;
  };
  contributions: {
    total: number;
    by_status: Record<string, number>;
  };
  users: {
    active: number;
    by_role: Record<string, number>;
  };
  activity: {
    audit_logs_last_7_days: number;
  };
}

export async function getDashboardStatsRequest(signal?: AbortSignal): Promise<DashboardStatsWire> {
  const res = await client.get<ApiOkEnvelope<DashboardStatsWire>>('/admin/dashboard/stats', { signal });
  return res.data.data;
}