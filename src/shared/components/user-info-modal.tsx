import { useState, type ReactNode } from 'react';
import { Alert, Descriptions, Flex, Modal, Spin, Tag, Typography } from 'antd';
import { usePublicProfile } from '@/shared/hooks/use-public-profile';
import { formatDateTime } from '@/shared/utils/format-datetime';

const ROLE_LABELS: Record<string, string> = {
  root: 'Root',
  admin: 'Admin',
  reviewer: 'Reviewer',
  editor: 'Editor',
  contributor: 'Kontributor',
};

export interface UserInfoModalProps {
  open: boolean;
  username: string | null;
  onClose: () => void;
}

function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role;
}

/**
 * Modal reusable untuk info user (profil publik).
 * Tidak menampilkan User ID, email, atau nomor HP.
 */
export function UserInfoModal({ open, username, onClose }: UserInfoModalProps) {
  const query = usePublicProfile(username, open && !!username);

  return (
    <Modal
      title="Info pengguna"
      open={open}
      onCancel={onClose}
      footer={null}
      destroyOnHidden
    >
      {!username ? (
        <Typography.Text type="secondary">Pengguna tidak tersedia.</Typography.Text>
      ) : query.isPending ? (
        <Flex
          vertical
          align="center"
          justify="center"
          gap={8}
          role="status"
          aria-live="polite"
          aria-label="Memuat profil"
          style={{ minHeight: 180, padding: '28px 0' }}
        >
          <Spin size="large" />
          <Typography.Text type="secondary">Memuat profil…</Typography.Text>
        </Flex>
      ) : query.isError ? (
        <Alert
          type="error"
          showIcon
          message="Tidak dapat memuat profil"
          description={query.error.message}
        />
      ) : query.data ? (
        <Descriptions size="small" column={1} bordered>
          <Descriptions.Item label="Username">{query.data.username}</Descriptions.Item>
          <Descriptions.Item label="Peran">
            <Tag>{roleLabel(query.data.role)}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Verifikator">
            {query.data.isVerifier ? <Tag color="cyan">Ya</Tag> : <Tag>Tidak</Tag>}
          </Descriptions.Item>
          <Descriptions.Item label="Bergabung">
            {formatDateTime(query.data.joinedAt)}
          </Descriptions.Item>
          <Descriptions.Item label="Kontribusi disetujui">
            {query.data.stats.contributionsApproved}
          </Descriptions.Item>
          <Descriptions.Item label="Verifikasi dilakukan">
            {query.data.stats.verificationsDone}
          </Descriptions.Item>
        </Descriptions>
      ) : null}
    </Modal>
  );
}

export interface UserInfoLinkProps {
  username: string | null | undefined;
  fallback?: ReactNode;
}

/**
 * Username yang bisa diklik untuk membuka `UserInfoModal`.
 * Tanpa username: teks fallback, bukan tautan.
 */
export function UserInfoLink({ username, fallback = 'Pengguna terhapus' }: UserInfoLinkProps) {
  const [open, setOpen] = useState(false);

  if (!username) {
    return <Typography.Text type="secondary">{fallback}</Typography.Text>;
  }

  return (
    <>
      <Typography.Link onClick={() => setOpen(true)}>{username}</Typography.Link>
      <UserInfoModal username={username} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
