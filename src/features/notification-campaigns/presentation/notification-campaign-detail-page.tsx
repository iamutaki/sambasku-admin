import { useParams } from '@tanstack/react-router';
import {
  App as AntdApp,
  Button,
  Descriptions,
  Popconfirm,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import { PageHeader } from '@/shared/components/page-header';
import { formatDateTime } from '@/shared/utils/format-datetime';
import { normalizeError } from '@/shared/api/error';
import { useAuth } from '@/shared/auth/use-auth';
import {
  AUDIENCE_LABELS,
  CAMPAIGN_STATUS_COLORS,
  CAMPAIGN_STATUS_LABELS,
  DEEP_LINK_KIND_LABELS,
  isSendAtInFuture,
} from '../domain/campaign';
import {
  useCampaignDetail,
  useCancelCampaign,
  useRetryCampaign,
  useSendCampaign,
} from '../application/use-campaigns';

export function NotificationCampaignDetailPage() {
  const { id } = useParams({ from: '/console-layout/notification-campaigns/$id' });
  const { user } = useAuth();
  const canManage = user?.role === 'admin' || user?.role === 'root';
  const { message } = AntdApp.useApp();
  const { data, isLoading, isError, error, refetch } = useCampaignDetail(id, canManage);
  const sendMutation = useSendCampaign();
  const cancelMutation = useCancelCampaign();
  const retryMutation = useRetryCampaign();

  if (!canManage) {
    return <Typography.Text type="secondary">Akses ditolak.</Typography.Text>;
  }
  if (isLoading) return <Typography.Text>Memuat…</Typography.Text>;
  if (isError || !data) {
    return <Typography.Text type="danger">{normalizeError(error).message}</Typography.Text>;
  }

  const canSend = data.status === 'draft' || data.status === 'scheduled';
  const scheduled = isSendAtInFuture(data.sendAt);
  const canCancel = data.status === 'draft' || data.status === 'scheduled';
  const canRetry =
    data.audienceType === 'selected' &&
    (data.status === 'completed' || data.status === 'failed') &&
    (data.recipientCounts?.failed ?? 0) + (data.recipientCounts?.skipped_no_token ?? 0) > 0;

  return (
    <>
      <PageHeader
        title={data.title}
        extra={
          <Space>
            <Button onClick={() => refetch()}>Muat ulang</Button>
            {canCancel ? (
              <Popconfirm
                title="Batalkan campaign ini?"
                onConfirm={async () => {
                  try {
                    await cancelMutation.mutateAsync(data.id);
                    message.success('Campaign dibatalkan');
                  } catch (err) {
                    message.warning(normalizeError(err).message);
                  }
                }}
              >
                <Button danger loading={cancelMutation.isPending}>
                  Batalkan
                </Button>
              </Popconfirm>
            ) : null}
            {canRetry ? (
              <Button
                loading={retryMutation.isPending}
                onClick={async () => {
                  try {
                    await retryMutation.mutateAsync(data.id);
                    message.success('Retry dimulai');
                  } catch (err) {
                    message.warning(normalizeError(err).message);
                  }
                }}
              >
                Retry gagal
              </Button>
            ) : null}
            {canSend ? (
              <Popconfirm
                title={
                  scheduled
                    ? `Jadwalkan kirim ke ${formatDateTime(data.sendAt)}?`
                    : `Kirim ke ${AUDIENCE_LABELS[data.audienceType]} (${data.targetedUsers} user)?`
                }
                onConfirm={async () => {
                  try {
                    const result = await sendMutation.mutateAsync(data.id);
                    message.success(
                      result.status === 'scheduled'
                        ? 'Campaign dijadwalkan'
                        : 'Pengiriman dimulai',
                    );
                  } catch (err) {
                    message.warning(normalizeError(err).message);
                  }
                }}
              >
                <Button type="primary" loading={sendMutation.isPending}>
                  {scheduled ? 'Jadwalkan' : 'Kirim sekarang'}
                </Button>
              </Popconfirm>
            ) : null}
          </Space>
        }
      />
      <Descriptions bordered size="small" column={1} style={{ marginBottom: 16 }}>
        <Descriptions.Item label="Status">
          <Tag color={CAMPAIGN_STATUS_COLORS[data.status]}>
            {CAMPAIGN_STATUS_LABELS[data.status]}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="Isi">{data.body}</Descriptions.Item>
        <Descriptions.Item label="Audience">
          {AUDIENCE_LABELS[data.audienceType]}
        </Descriptions.Item>
        <Descriptions.Item label="Deep link">
          {DEEP_LINK_KIND_LABELS[data.deepLinkKind]}
          {data.deepLinkValue ? ` · ${data.deepLinkValue}` : ''}
        </Descriptions.Item>
        <Descriptions.Item label="Jadwal">
          {data.sendAt ? formatDateTime(data.sendAt) : '—'}
        </Descriptions.Item>
        <Descriptions.Item label="Target user">{data.targetedUsers}</Descriptions.Item>
        <Descriptions.Item label="Push sukses / gagal">
          {data.pushSuccess} / {data.pushFailed}
        </Descriptions.Item>
        <Descriptions.Item label="Inbox tertulis">{data.inboxWritten}</Descriptions.Item>
        <Descriptions.Item label="Topic terkirim">
          {data.topicSent ? 'Ya' : 'Belum'}
        </Descriptions.Item>
        {data.lastError ? (
          <Descriptions.Item label="Error terakhir">
            <Typography.Text type="danger">{data.lastError}</Typography.Text>
          </Descriptions.Item>
        ) : null}
        {data.recipientCounts ? (
          <Descriptions.Item label="Penerima">
            pending {data.recipientCounts.pending} · sent {data.recipientCounts.sent} · failed{' '}
            {data.recipientCounts.failed} · no token {data.recipientCounts.skipped_no_token}
          </Descriptions.Item>
        ) : null}
      </Descriptions>
      {data.failures.length > 0 ? (
        <>
          <Typography.Title level={5}>Sample gagal</Typography.Title>
          <Table
            rowKey="id"
            size="small"
            pagination={false}
            dataSource={data.failures}
            columns={[
              { title: 'User ID', dataIndex: 'userId' },
              { title: 'Status', dataIndex: 'status' },
              { title: 'Error', dataIndex: 'error' },
            ]}
          />
        </>
      ) : null}
    </>
  );
}
