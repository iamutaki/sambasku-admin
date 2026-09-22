import { useState, type ReactNode } from 'react';
import { Alert, Avatar, Descriptions, Flex, List, Modal, Spin, Tag, Typography } from 'antd';
import { usePublicActivity, usePublicProfile } from '@/shared/hooks/use-public-profile';
import { displayImageUrl } from '@/shared/utils/display-image-url';
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

function kindLabel(kind: string): string {
  switch (kind) {
    case 'contribution':
      return 'Kontribusi';
    case 'comment':
      return 'Komentar';
    case 'verification':
      return 'Verifikasi';
    default:
      return kind;
  }
}

/**
 * Modal reusable untuk info user (profil publik).
 * Tidak menampilkan User ID, email, atau nomor HP.
 */
export function UserInfoModal({ open, username, onClose }: UserInfoModalProps) {
  const query = usePublicProfile(username, open && !!username);
  const activity = usePublicActivity(username, open && !!username);

  return (
    <Modal
      title="Info pengguna"
      open={open}
      onCancel={onClose}
      footer={null}
      destroyOnHidden
      width={520}
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
        <Flex vertical gap={16}>
          <Flex align="center" gap={12}>
            <Avatar
              size={56}
              src={displayImageUrl(query.data.avatarUrl ?? undefined, { width: 112 })}
            >
              {query.data.username.slice(0, 2).toUpperCase()}
            </Avatar>
            <div>
              <Typography.Title level={5} style={{ margin: 0 }}>
                {query.data.username}
              </Typography.Title>
              <Typography.Text type="secondary">
                Bergabung {formatDateTime(query.data.joinedAt)}
              </Typography.Text>
            </div>
          </Flex>
          <Descriptions size="small" column={1} bordered>
            <Descriptions.Item label="Peran">
              <Tag>{roleLabel(query.data.role)}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Verifikator">
              {query.data.isVerifier ? <Tag color="cyan">Ya</Tag> : <Tag>Tidak</Tag>}
            </Descriptions.Item>
            <Descriptions.Item label="Kontribusi disetujui">
              {query.data.stats.contributionsApproved}
            </Descriptions.Item>
            <Descriptions.Item label="Verifikasi">
              {query.data.stats.verificationsDone}
            </Descriptions.Item>
            <Descriptions.Item label="Komentar tayang">
              {query.data.stats.commentsPublished}
            </Descriptions.Item>
          </Descriptions>
          <div>
            <Typography.Text strong>Aktivitas terbaru</Typography.Text>
            {activity.isPending ? (
              <Flex justify="center" style={{ padding: 16 }}>
                <Spin />
              </Flex>
            ) : activity.isError ? (
              <Alert type="warning" showIcon message={activity.error.message} style={{ marginTop: 8 }} />
            ) : (
              <List
                size="small"
                style={{ marginTop: 8 }}
                locale={{ emptyText: 'Belum ada aktivitas publik' }}
                dataSource={activity.data ?? []}
                renderItem={(item) => (
                  <List.Item>
                    <List.Item.Meta
                      title={item.summary}
                      description={`${kindLabel(item.kind)} · ${formatDateTime(item.occurredAt)}`}
                    />
                  </List.Item>
                )}
              />
            )}
          </div>
        </Flex>
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
