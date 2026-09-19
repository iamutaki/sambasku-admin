import { Card, Flex, Tag, Typography } from 'antd';
import { ROLE_LABELS, type UserRole } from '@/features/auth/domain/user';

const ROLE_HINT: Partial<Record<UserRole, string>> = {
  root: 'Akses penuh termasuk audit log.',
  admin: 'Akses penuh termasuk audit log.',
  reviewer: 'Memverifikasi antrean kontribusi.',
  editor: 'Menyunting dan menerbitkan konten.',
  contributor: 'Mengirim kontribusi.',
};

export interface WelcomeCardProps {
  username?: string | null;
  role?: UserRole | null;
}

/**
 * Kartu sapaan selamat datang di atas dashboard.
 * Menampilkan username, role, dan hint singkat sesuai wewenang.
 */
export function WelcomeCard({ username, role }: WelcomeCardProps) {
  return (
    <Card style={{ marginBottom: 16 }}>
      <Flex vertical gap={4}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          Selamat datang, {username ?? 'Pengguna'} 👋
        </Typography.Title>
        <Typography.Text type="secondary">
          Anda masuk sebagai{' '}
          <Tag color="blue">{role ? (ROLE_LABELS[role] ?? role) : 'Pengguna'}</Tag>
          {role ? <span> - {ROLE_HINT[role] ?? 'Jelajahi menu di samping.'}</span> : null}
        </Typography.Text>
      </Flex>
    </Card>
  );
}
