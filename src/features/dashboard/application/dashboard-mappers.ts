import type { DashboardStats } from '../domain/dashboard-stats';
import type { DashboardStatsWire } from '../infrastructure/dashboard-api';

export function normalizeDashboardStats(wire: DashboardStatsWire): DashboardStats {
  return {
    words: {
      total: wire.words.total,
      verified: wire.words.verified,
      deleted: wire.words.deleted,
      byStatus: wire.words.by_status as DashboardStats['words']['byStatus'],
    },
    contributions: {
      total: wire.contributions.total,
      byStatus: wire.contributions.by_status as DashboardStats['contributions']['byStatus'],
    },
    users: {
      active: wire.users.active,
      byRole: wire.users.by_role as DashboardStats['users']['byRole'],
    },
    activity: {
      auditLogsLast7Days: wire.activity.audit_logs_last_7_days,
    },
  };
}