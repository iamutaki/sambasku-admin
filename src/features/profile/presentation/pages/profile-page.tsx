import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { Avatar, Card, Col, Menu, Row, Space, Tag, Typography } from 'antd';
import { PageHeader } from '@/shared/components/page-header';
import { useAuth } from '@/shared/auth/use-auth';
import { ROLE_LABELS } from '@/features/auth/domain/user';
import { ChangePasswordForm } from '../components/change-password-form';

/**
 * Halaman Profil - identitas akun (username + role dari sesi) + menu
 * section di kiri, konten section di kanan (settings-style). Semua role
 * login boleh akses. Email tidak tersedia di sesi web (klaim JWT hanya
 * sub/role/username) - menyusul via /auth/me kalau dibutuhkan.
 */
export function ProfilePage() {
  const { user } = useAuth();

  return (
    <>
      <PageHeader
        title="Profil"
        subtitle="Informasi akun dan pengaturan keamanan sesi Anda."
      />

      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Card>
              <Space direction="vertical" size={12} align="center" style={{ width: '100%' }}>
                <Avatar size={72} icon={<UserOutlined />} />
                <Typography.Text strong style={{ fontSize: 16 }}>
                  {user?.username ?? '-'}
                </Typography.Text>
                <Tag color="blue">{user ? (ROLE_LABELS[user.role as keyof typeof ROLE_LABELS] ?? user.role) : '-'}</Tag>
              </Space>
            </Card>

            <Card styles={{ body: { padding: 0 } }}>
              <Menu
                mode="vertical"
                selectedKeys={['ubah-password']}
                items={[{ key: 'ubah-password', icon: <LockOutlined />, label: 'Ubah Password' }]}
              />
            </Card>
          </Space>
        </Col>

        <Col xs={24} md={16}>
          <Card title="Ubah Password">
            <Typography.Paragraph type="secondary" style={{ marginBottom: 24 }}>
              Setelah password diganti, semua sesi (termasuk yang ini) diakhiri dan Anda
              diminta login ulang dengan password baru.
            </Typography.Paragraph>
            <ChangePasswordForm />
          </Card>
        </Col>
      </Row>
    </>
  );
}
