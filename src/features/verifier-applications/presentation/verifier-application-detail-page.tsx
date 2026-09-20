import { useState } from 'react';
import { useNavigate, useParams } from '@tanstack/react-router';
import { CheckOutlined, CloseOutlined, RollbackOutlined } from '@ant-design/icons';
import {
  Alert,
  App as AntdApp,
  Button,
  Card,
  Descriptions,
  Flex,
  Form,
  Input,
  Modal,
  Result,
  Skeleton,
  Space,
  Tag,
  Typography,
} from 'antd';
import { formatDateTime } from '@/shared/utils/format-datetime';
import { PageHeader } from '@/shared/components/page-header';
import { useAuth } from '@/shared/auth/use-auth';
import { useVerifierApplicationDetail } from '../application/use-verifier-application-detail';
import {
  useReviewVerifierApplication,
  type VerifierApplicationDecision,
} from '../application/use-review-verifier-application';
import {
  SOCIAL_PLATFORM_LABELS,
  VERIFIER_APPLICATION_STATUS_LABELS,
} from '../domain/verifier-application';

const { Text } = Typography;

const STATUS_TAG_COLOR: Record<string, string> = {
  pending: 'orange',
  approved: 'green',
  rejected: 'red',
};

export function VerifierApplicationDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams({ from: '/console-layout/verifier-applications/$id' });
  const { user } = useAuth();
  const canManage = user?.role === 'admin' || user?.role === 'root';
  const detailQuery = useVerifierApplicationDetail(id);
  const reviewMutation = useReviewVerifierApplication();
  const { message } = AntdApp.useApp();

  const [decision, setDecision] = useState<VerifierApplicationDecision | null>(null);
  const [comment, setComment] = useState('');

  const detail = detailQuery.data;
  const isPending = detail?.status === 'pending';

  const closeDecision = () => {
    setDecision(null);
    setComment('');
  };

  const submitDecision = async () => {
    if (!decision || !detail) return;
    if (decision === 'reject' && !comment.trim()) return;
    try {
      await reviewMutation.mutateAsync({
        id: detail.id,
        decision,
        comment: comment.trim() || undefined,
      });
      message.success(
        decision === 'approve' ? 'Pengajuan disetujui. Role pemohon menjadi reviewer.' : 'Pengajuan ditolak.',
      );
      closeDecision();
    } catch {
      // error mutation
    }
  };

  if (!canManage) {
    return <Alert type="warning" showIcon message="Hanya admin dan root yang dapat meninjau pengajuan verifikator." />;
  }

  if (detailQuery.isPending) {
    return <Skeleton active paragraph={{ rows: 8 }} />;
  }

  if (detailQuery.isError || !detail) {
    return (
      <Result
        status="404"
        title="Pengajuan tidak ditemukan"
        extra={
          <Button onClick={() => navigate({ to: '/verifier-applications' })}>Kembali ke antrean</Button>
        }
      />
    );
  }

  return (
    <>
      <PageHeader
        title="Review pengajuan"
        subtitle={detail.username ?? detail.user_id}
        extra={
          <Button icon={<RollbackOutlined />} onClick={() => navigate({ to: '/verifier-applications' })}>
            Kembali
          </Button>
        }
      />

      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Descriptions bordered size="small" column={1}>
          <Descriptions.Item label="Status">
            <Tag color={STATUS_TAG_COLOR[detail.status]}>
              {VERIFIER_APPLICATION_STATUS_LABELS[detail.status]}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Username">{detail.username ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="User ID">
            <Typography.Text copyable>{detail.user_id}</Typography.Text>
          </Descriptions.Item>
          <Descriptions.Item label="Nomor HP">{detail.phone}</Descriptions.Item>
          <Descriptions.Item label="Alamat">
            <Text style={{ whiteSpace: 'pre-wrap' }}>{detail.address}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="Media sosial">
            <Space direction="vertical" size={4}>
              {detail.social_links.map((link) => (
                <Typography.Link key={`${link.platform}-${link.url}`} href={link.url} target="_blank">
                  {SOCIAL_PLATFORM_LABELS[link.platform] ?? link.platform}: {link.url}
                </Typography.Link>
              ))}
            </Space>
          </Descriptions.Item>
          <Descriptions.Item label="Diajukan">{formatDateTime(detail.created_at)}</Descriptions.Item>
          {detail.reviewed_at ? (
            <Descriptions.Item label="Direview">{formatDateTime(detail.reviewed_at)}</Descriptions.Item>
          ) : null}
        </Descriptions>

        {detail.status === 'rejected' && detail.admin_comment ? (
          <Card size="small" title="Catatan penolakan">
            <Text>{detail.admin_comment}</Text>
          </Card>
        ) : null}

        {isPending ? (
          <Flex justify="flex-end" wrap gap={8}>
            <Button danger icon={<CloseOutlined />} onClick={() => setDecision('reject')}>
              Tolak
            </Button>
            <Button type="primary" icon={<CheckOutlined />} onClick={() => setDecision('approve')} loading={reviewMutation.isPending}>
              Setujui
            </Button>
          </Flex>
        ) : null}
      </Space>

      <Modal
        title={decision === 'reject' ? 'Tolak pengajuan' : 'Setujui pengajuan'}
        open={decision !== null}
        onCancel={closeDecision}
        okText={decision === 'reject' ? 'Tolak' : 'Setujui'}
        okButtonProps={{
          danger: decision === 'reject',
          loading: reviewMutation.isPending,
          disabled: decision === 'reject' && !comment.trim(),
        }}
        onOk={submitDecision}
      >
        {decision === 'approve' ? (
          <Text>Pemohon akan menjadi reviewer. Sesi lama mereka harus login ulang.</Text>
        ) : (
          <Form layout="vertical">
            <Form.Item
              label="Alasan penolakan"
              required
              validateStatus={!comment.trim() ? 'error' : undefined}
              help={!comment.trim() ? 'Alasan penolakan wajib diisi.' : undefined}
            >
              <Input.TextArea
                rows={3}
                placeholder="Alasan penolakan (wajib)"
                value={comment}
                maxLength={2000}
                onChange={(e) => setComment(e.target.value)}
              />
            </Form.Item>
          </Form>
        )}
      </Modal>
    </>
  );
}
