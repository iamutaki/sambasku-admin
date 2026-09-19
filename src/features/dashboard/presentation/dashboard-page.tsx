import { ReloadOutlined } from '@ant-design/icons';
import { useNavigate } from '@tanstack/react-router';
import { Alert, Button, Skeleton } from 'antd';
import { PageHeader } from '@/shared/components/page-header';
import { useAuth } from '@/shared/auth/use-auth';
import { ROLE_LABELS, type UserRole } from '@/features/auth/domain/user';
import { useDashboardStats } from '../application/use-dashboard-stats';
import { StatCards } from './components/stat-cards';

/**
 * Dashboard - strip KPI ringkas. Navigasi kerja lewat sider.
 */
export function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: stats, isPending, isError, isFetching, refetch } = useDashboardStats();

  const role = user?.role as UserRole | undefined;
  const roleLabel = role ? (ROLE_LABELS[role] ?? role) : null;
  const subtitle = [user?.username ? `Halo, ${user.username}` : null, roleLabel]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="dashboard">
      <PageHeader
        title="Dashboard"
        subtitle={subtitle || 'Ringkasan konsol admin.'}
        extra={
          <Button
            icon={<ReloadOutlined />}
            onClick={() => refetch()}
            loading={isFetching && !isPending}
          >
            Muat ulang
          </Button>
        }
      />

      {isError ? (
        <Alert
          type="error"
          showIcon
          message="Statistik gagal dimuat"
          description="Periksa koneksi lalu coba lagi."
          action={
            <Button size="small" onClick={() => refetch()}>
              Coba lagi
            </Button>
          }
        />
      ) : null}

      {isPending && !stats ? (
        <div className="dashboard__strip dashboard__strip--skeleton">
          <Skeleton.Input active size="small" style={{ width: 280 }} />
        </div>
      ) : null}

      {stats ? (
        <StatCards
          stats={stats}
          onNavigateContributions={() => navigate({ to: '/contributions' })}
        />
      ) : null}
    </div>
  );
}
