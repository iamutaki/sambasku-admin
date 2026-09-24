import { useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { App as AntdApp, Button, Space, Table, Tag, Typography } from 'antd';
import { PageHeader } from '@/shared/components/page-header';
import { formatDateTime } from '@/shared/utils/format-datetime';
import { normalizeError } from '@/shared/api/error';
import { useAuth } from '@/shared/auth/use-auth';
import {
  AUDIENCE_LABELS,
  CAMPAIGN_STATUS_COLORS,
  CAMPAIGN_STATUS_LABELS,
  type NotificationCampaign,
} from '../domain/campaign';
import { useCampaignList } from '../application/use-campaigns';
import { CreateCampaignDrawer } from './create-campaign-drawer';

export function NotificationCampaignsPage() {
  const { user } = useAuth();
  const canManage = user?.role === 'admin' || user?.role === 'root';
  const navigate = useNavigate();
  const { message } = AntdApp.useApp();
  const [createOpen, setCreateOpen] = useState(false);
  const list = useCampaignList(undefined, canManage);

  const items = useMemo(
    () => list.data?.pages.flatMap((p) => p.data) ?? [],
    [list.data],
  );

  if (!canManage) {
    return (
      <Typography.Text type="secondary">
        Hanya admin/root yang dapat mengelola campaign.
      </Typography.Text>
    );
  }

  return (
    <>
      <PageHeader
        title="Notification campaign"
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => list.refetch()}>
              Muat ulang
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
              Campaign baru
            </Button>
          </Space>
        }
      />
      {list.isError ? (
        <Typography.Text type="danger">{normalizeError(list.error).message}</Typography.Text>
      ) : null}
      <Table
        rowKey="id"
        loading={list.isLoading}
        dataSource={items}
        pagination={false}
        onRow={(row) => ({
          onClick: () => navigate({ to: '/notification-campaigns/$id', params: { id: row.id } }),
          style: { cursor: 'pointer' },
        })}
        columns={[
          { title: 'Judul', dataIndex: 'title', key: 'title' },
          {
            title: 'Audience',
            key: 'audience',
            render: (_: unknown, row: NotificationCampaign) => AUDIENCE_LABELS[row.audienceType],
          },
          {
            title: 'Status',
            key: 'status',
            render: (_: unknown, row: NotificationCampaign) => (
              <Tag color={CAMPAIGN_STATUS_COLORS[row.status]}>
                {CAMPAIGN_STATUS_LABELS[row.status]}
              </Tag>
            ),
          },
          {
            title: 'Target',
            dataIndex: 'targetedUsers',
            key: 'targeted',
            width: 90,
          },
          {
            title: 'Push OK / gagal',
            key: 'push',
            render: (_: unknown, row: NotificationCampaign) =>
              `${row.pushSuccess} / ${row.pushFailed}`,
          },
          {
            title: 'Dibuat',
            key: 'created',
            render: (_: unknown, row: NotificationCampaign) => formatDateTime(row.createdAt),
          },
        ]}
      />
      {list.hasNextPage ? (
        <Button
          style={{ marginTop: 12 }}
          loading={list.isFetchingNextPage}
          onClick={() => list.fetchNextPage()}
        >
          Muat lebih
        </Button>
      ) : null}
      <CreateCampaignDrawer
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(id) => {
          setCreateOpen(false);
          message.success('Draft campaign dibuat');
          navigate({ to: '/notification-campaigns/$id', params: { id } });
        }}
      />
    </>
  );
}
