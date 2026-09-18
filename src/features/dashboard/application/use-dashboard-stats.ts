import { useQuery } from '@tanstack/react-query';
import { normalizeDashboardStats } from './dashboard-mappers';
import type { DashboardStats } from '../domain/dashboard-stats';
import { getDashboardStatsRequest } from '../infrastructure/dashboard-api';

/**
 * Statistik dashboard (GET /api/v1/admin/dashboard/stats). staleTime agak
 * lama - angka agregat jarang berubah per menit; refresh manual lewat
 * tombol di halaman kalau perlu.
 */
export function useDashboardStats(): ReturnType<typeof useQuery<DashboardStats>> {
  return useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: async ({ signal }) => normalizeDashboardStats(await getDashboardStatsRequest(signal)),
    staleTime: 60_000,
  });
}