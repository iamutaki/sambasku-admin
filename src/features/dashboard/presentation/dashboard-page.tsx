import { useNavigate } from '@tanstack/react-router';
import { AuditOutlined, FallOutlined, RiseOutlined, TranslationOutlined } from '@ant-design/icons';
import { Card, Col, Flex, Row, Tag, Typography } from 'antd';
import { PageHeader } from '@/shared/components/page-header';
import { useAuth } from '@/shared/auth/use-auth';
import { ROLE_LABELS, type UserRole } from '@/features/auth/domain/user';

const ROLE_HINT: Partial<Record<UserRole, string>> = {
  root: 'Akses penuh termasuk audit log.',
  admin: 'Akses penuh termasuk audit log.',
  reviewer: 'Memverifikasi antrean kontribusi.',
  editor: 'Menyunting dan menerbitkan konten.',
  contributor: 'Mengirim kontribusi.',
};

/**
 * Dashboard - halaman pertama setelah login. Menampilkan identitas sesi dan
 * pintu cepat ke fitur konsol yang relevan dengan role. Statistik agregat
 * (jumlah kata, antrean, dst) menyusul sebagai fitur terpisah (belum ada
 * endpoint agregasi di API).
 */
export function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

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

      <Card style={{ marginTop: 16 }}>
        <Flex align="center" gap={12}>
          <FallOutlined style={{ fontSize: 24, color: '#bfbfbf' }} />
          <div>
            <Typography.Text strong>Statistik agregat</Typography.Text>
            <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
              Grafik jumlah kata, kontribusi, dan aktivitas verifikasi menyusul di fitur berikutnya.
              Antrean review & audit log hanya untuk role tertentu.
            </Typography.Paragraph>
          </div>
        </Flex>
      </Card>
    </>
  );
}