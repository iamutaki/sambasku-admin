import { useNavigate } from '@tanstack/react-router';
import { Card, Flex, Skeleton, Spin, Typography } from 'antd';
import { PageHeader } from '@/shared/components/page-header';
import { useAuth } from '@/shared/auth/use-auth';
import type { UserRole } from '@/features/auth/domain/user';
import { useDashboardStats } from '../application/use-dashboard-stats';
import { WelcomeCard } from './components/welcome-card';
import { StatCards } from './components/stat-cards';
import { QuickActionsRow, type QuickActionTarget } from './components/quick-actions-row';

/**
 * Dashboard - halaman pertama setelah login. Menampilkan statistik agregat
 * (kata, kontribusi, pengguna, aktivitas) dari GET /admin/dashboard/stats
 * plus pintu cepat ke fitur konsol yang relevan.
 *
 * Komposisi halaman (dari komponen terpisah):
 *   PageHeader → WelcomeCard → (StatCards | Error | Skeleton Loading) → QuickActionsRow
 * Seluruh blok konten dibungkus Spin + Skeleton agar loading state seragam
 * (tidak separuh-separuh setengah tampil, setengah loading).
 */
export function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: stats, isPending, isError, refetch } = useDashboardStats();

  const role = user?.role as UserRole | undefined;

  const handleQuickNavigate = (to: QuickActionTarget) => navigate({ to });

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Ringkasan dan pintu cepat konsol admin." />

      <Spin spinning={isPending}>
        <WelcomeCard username={user?.username} role={role} />

        {isError ? (
          <Card style={{ marginBottom: 16 }}>
            <Flex align="center" justify="space-between" gap={12}>
              <Typography.Text type="secondary">
                Statistik gagal dimuat. Periksa koneksi lalu coba lagi.
              </Typography.Text>
              <Typography.Link onClick={() => refetch()}>Muat ulang</Typography.Link>
            </Flex>
          </Card>
        ) : stats ? (
          <StatCards
            stats={stats}
            onNavigateContributions={() => navigate({ to: '/contributions' })}
          />
        ) : isPending ? (
          <Card style={{ marginBottom: 16 }}>
            <Skeleton active paragraph={{ rows: 4 }} title />
          </Card>
        ) : null}

        {isPending ? (
          <Card>
            <Skeleton active paragraph={{ rows: 3 }} title={false} />
          </Card>
        ) : (
          <QuickActionsRow onNavigate={handleQuickNavigate} />
        )}
      </Spin>
    </>
  );
}
