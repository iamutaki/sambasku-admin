import { useNavigate } from '@tanstack/react-router';
import {
  AuditOutlined,
  ClockCircleOutlined,
  RiseOutlined,
  TeamOutlined,
  TranslationOutlined,
} from '@ant-design/icons';
import { Card, Col, Divider, Flex, Row, Spin, Statistic, Tag, Typography } from 'antd';
import { PageHeader } from '@/shared/components/page-header';
import { useAuth } from '@/shared/auth/use-auth';
import { ROLE_LABELS, type UserRole } from '@/features/auth/domain/user';
import {
  CONTRIBUTION_STATUS_LABELS,
  ROLE_LABELS_SHORT,
  WORD_STATUS_LABELS,
  type DashboardStats,
} from '../domain/dashboard-stats';
import { useDashboardStats } from '../application/use-dashboard-stats';

const ROLE_HINT: Partial<Record<UserRole, string>> = {
  root: 'Akses penuh termasuk audit log.',
  admin: 'Akses penuh termasuk audit log.',
  reviewer: 'Memverifikasi antrean kontribusi.',
  editor: 'Menyunting dan menerbitkan konten.',
  contributor: 'Mengirim kontribusi.',
};

const WORD_STATUS_TAG_COLOR: Record<keyof DashboardStats['words']['byStatus'], string> = {
  published: 'green',
  pending_review: 'orange',
  draft: 'default',
  rejected: 'red',
};

const CONTRIBUTION_STATUS_TAG_COLOR: Record<keyof DashboardStats['contributions']['byStatus'], string> = {
  pending: 'orange',
  approved: 'green',
  rejected: 'red',
  corrected: 'gold',
};

/**
 * Dashboard - halaman pertama setelah login. Menampilkan statistik agregat
 * (kata, kontribusi, pengguna, aktivitas) dari GET /admin/dashboard/stats
 * plus pintu cepat ke fitur konsol yang relevan dengan role.
 */
export function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: stats, isPending, isError, refetch } = useDashboardStats();

  const role = user?.role as UserRole | undefined;

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Ringkasan dan pintu cepat konsol admin." />

      <Card style={{ marginBottom: 16 }}>
        <Flex vertical gap={4}>
          <Typography.Title level={4} style={{ margin: 0 }}>
            Selamat datang, {user?.username ?? 'Pengguna'} 👋
          </Typography.Title>
          <Typography.Text type="secondary">
            Anda masuk sebagai{' '}
            <Tag color="blue">{role ? (ROLE_LABELS[role] ?? role) : 'Pengguna'}</Tag>
            {role ? <span> - {ROLE_HINT[role] ?? 'Jelajahi menu di samping.'}</span> : null}
          </Typography.Text>
        </Flex>
      </Card>

      <Spin spinning={isPending}>
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
          <StatCards stats={stats} navigate={navigate} />
        ) : null}
      </Spin>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          <Card hoverable onClick={() => navigate({ to: '/words' })}>
            <Flex align="center" gap={12}>
              <TranslationOutlined style={{ fontSize: 28, color: '#1677ff' }} />
              <div>
                <Typography.Text strong>Kelola Kata</Typography.Text>
                <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
                  List, cari, dan kelola entri kosakata.
                </Typography.Paragraph>
              </div>
            </Flex>
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card hoverable onClick={() => navigate({ to: '/contributions' })}>
            <Flex align="center" gap={12}>
              <RiseOutlined style={{ fontSize: 28, color: '#fa8c16' }} />
              <div>
                <Typography.Text strong>Antrean Review</Typography.Text>
                <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
                  Kontribusi yang menunggu verifikasi.
                </Typography.Paragraph>
              </div>
            </Flex>
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card hoverable onClick={() => navigate({ to: '/audit-logs' })}>
            <Flex align="center" gap={12}>
              <AuditOutlined style={{ fontSize: 28, color: '#722ed1' }} />
              <div>
                <Typography.Text strong>Audit Log</Typography.Text>
                <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
                  Jejak mutasi data (admin & root).
                </Typography.Paragraph>
              </div>
            </Flex>
          </Card>
        </Col>
      </Row>
    </>
  );
}

type Nav = ReturnType<typeof useNavigate>;

function StatCards({ stats, navigate }: { stats: DashboardStats; navigate: Nav }) {
  const { words, contributions, users, activity } = stats;

  return (
    <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
      <Col xs={24} sm={12} xl={6}>
        <Card>
          <Statistic
            title="Total Kata"
            value={words.total}
            prefix={<TranslationOutlined style={{ color: '#1677ff' }} />}
          />
          <Divider style={{ margin: '12px 0' }} />
          <Flex wrap gap={4}>
            {Object.entries(words.byStatus).map(([status, count]) => (
              <Tag key={status} color={WORD_STATUS_TAG_COLOR[status as keyof DashboardStats['words']['byStatus']]}>
                {WORD_STATUS_LABELS[status as keyof DashboardStats['words']['byStatus']]}: {count}
              </Tag>
            ))}
          </Flex>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Terverifikasi {words.verified} · Terhapus {words.deleted}
          </Typography.Text>
        </Card>
      </Col>

      <Col xs={24} sm={12} xl={6}>
        <Card hoverable onClick={() => navigate({ to: '/contributions' })}>
          <Statistic
            title="Antrean Kontribusi"
            value={contributions.byStatus.pending}
            suffix="menunggu review"
            prefix={<RiseOutlined style={{ color: '#fa8c16' }} />}
          />
          <Divider style={{ margin: '12px 0' }} />
          <Flex wrap gap={4}>
            {Object.entries(contributions.byStatus).map(([status, count]) => (
              <Tag key={status} color={CONTRIBUTION_STATUS_TAG_COLOR[status as keyof DashboardStats['contributions']['byStatus']]}>
                {CONTRIBUTION_STATUS_LABELS[status as keyof DashboardStats['contributions']['byStatus']]}: {count}
              </Tag>
            ))}
          </Flex>
        </Card>
      </Col>

      <Col xs={24} sm={12} xl={6}>
        <Card>
          <Statistic title="Pengguna Aktif" value={users.active} prefix={<TeamOutlined style={{ color: '#52c41a' }} />} />
          <Divider style={{ margin: '12px 0' }} />
          <Flex wrap gap={4}>
            {Object.entries(users.byRole).map(([roleKey, count]) => (
              <Tag key={roleKey}>{ROLE_LABELS_SHORT[roleKey as keyof DashboardStats['users']['byRole']]}: {count}</Tag>
            ))}
          </Flex>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Distribusi role pengguna aktif.
          </Typography.Text>
        </Card>
      </Col>

      <Col xs={24} sm={12} xl={6}>
        <Card>
          <Statistic
            title="Aktivitas Mutasi (7 Hari)"
            value={activity.auditLogsLast7Days}
            prefix={<ClockCircleOutlined style={{ color: '#722ed1' }} />}
          />
          <Divider style={{ margin: '12px 0' }} />
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Perubahan data terekam di audit log.
          </Typography.Text>
        </Card>
      </Col>
    </Row>
  );
}