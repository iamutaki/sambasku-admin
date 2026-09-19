import { theme } from 'antd';
import {
  ROLE_LABELS_SHORT,
  WORD_STATUS_LABELS,
  type DashboardStats,
} from '../../domain/dashboard-stats';

export interface StatCardsProps {
  stats: DashboardStats;
  onNavigateContributions?: () => void;
}

function formatMeta(parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' · ');
}

/**
 * Strip KPI satu baris - label + angka; detail di title tooltip.
 */
export function StatCards({ stats, onNavigateContributions }: StatCardsProps) {
  const { words, contributions, users, activity } = stats;
  const { token } = theme.useToken();
  const pending = contributions.byStatus.pending;
  const hasPending = pending > 0;

  const wordMeta = formatMeta([
    words.verified > 0 && `Terverifikasi ${words.verified}`,
    words.byStatus.published > 0 && `Published ${words.byStatus.published}`,
    words.byStatus.draft > 0 && `Draft ${words.byStatus.draft}`,
    words.byStatus.pending_review > 0 && `Review ${words.byStatus.pending_review}`,
  ]) || Object.entries(words.byStatus)
    .filter(([, n]) => n > 0)
    .map(([s, n]) => `${WORD_STATUS_LABELS[s as keyof typeof words.byStatus]} ${n}`)
    .join(' · ');

  const contribMeta = formatMeta([
    hasPending && `${pending} menunggu`,
    contributions.byStatus.approved > 0 && `Disetujui ${contributions.byStatus.approved}`,
    contributions.byStatus.rejected > 0 && `Ditolak ${contributions.byStatus.rejected}`,
  ]) || 'Belum ada data';

  const roleMeta = formatMeta(
    (Object.entries(users.byRole) as Array<[keyof typeof users.byRole, number]>)
      .filter(([, n]) => n > 0)
      .map(([role, n]) => `${ROLE_LABELS_SHORT[role]} ${n}`),
  ) || 'Tidak ada pengguna aktif';

  const items: Array<{
    key: string;
    label: string;
    value: number;
    meta: string;
    attention?: boolean;
    onClick?: () => void;
  }> = [
    {
      key: 'words',
      label: 'Kata',
      value: words.total,
      meta: wordMeta,
    },
    {
      key: 'contributions',
      label: 'Kontribusi',
      value: contributions.total,
      meta: contribMeta,
      attention: hasPending,
      onClick: onNavigateContributions,
    },
    {
      key: 'users',
      label: 'Pengguna',
      value: users.active,
      meta: roleMeta,
    },
    {
      key: 'activity',
      label: 'Mutasi 7h',
      value: activity.auditLogsLast7Days,
      meta: 'Entri audit log 7 hari terakhir',
    },
  ];

  return (
    <div className="dashboard__strip" role="list">
      {items.map((item, index) => {
        const clickable = Boolean(item.onClick);
        const className = [
          'dashboard__strip-item',
          clickable ? 'dashboard__strip-item--clickable' : '',
          item.attention ? 'dashboard__strip-item--attention' : '',
        ]
          .filter(Boolean)
          .join(' ');
        const style = item.attention
          ? { ['--strip-accent' as string]: token.colorWarning }
          : undefined;
        const body = (
          <>
            <span className="dashboard__strip-label">{item.label}</span>
            <span className="dashboard__strip-value">
              {item.value.toLocaleString('id-ID')}
            </span>
          </>
        );

        return (
          <div key={item.key} className="dashboard__strip-cell" role="listitem">
            {index > 0 ? (
              <span className="dashboard__strip-sep" aria-hidden>
                ·
              </span>
            ) : null}
            {clickable ? (
              <button
                type="button"
                className={className}
                style={style}
                title={item.meta}
                onClick={item.onClick}
              >
                {body}
              </button>
            ) : (
              <div className={className} style={style} title={item.meta}>
                {body}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
