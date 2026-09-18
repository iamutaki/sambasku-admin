import { useState } from 'react';
import { useNavigate, useParams } from '@tanstack/react-router';
import { CheckOutlined, CloseOutlined, EditOutlined, RollbackOutlined } from '@ant-design/icons';
import { Alert, App as AntdApp, Button, Card, Descriptions, Flex, Form, Input, Modal, Skeleton, Space, Tag, Typography } from 'antd';
import dayjs from 'dayjs';
import { PageHeader } from '@/shared/components/page-header';
import {
  CONTRIBUTION_STATUS_LABELS,
  ENTITY_TYPE_LABELS,
} from '../domain/contribution';
import type { ReviewDecision } from '../application/use-review-contribution';
import { useContributionDetail } from '../application/use-contribution-detail';
import { useReviewContribution } from '../application/use-review-contribution';
import { ContributionEntityView } from './contribution-entity-view';
import { CorrectContributionDrawer } from './correct-contribution-drawer';

const { Text } = Typography;

const STATUS_TAG_COLOR: Record<string, string> = {
  pending: 'orange',
  approved: 'green',
  rejected: 'red',
  corrected: 'blue',
};

/**
 * Halaman Detail Kontribusi - /contributions/:id. Dibuka dari tombol Review
 * di antrean (atau URL langsung, bisa di-bookmark). Menampilkan metadata
 * pengajuan + isi entity read-only + aksi keputusan (Tolak/Koreksi/Setujui)
 * selama masih `pending`, dan alasan verifikator sesudahnya.
 *
 * Akses: admin/root/reviewer (endpoint role verifikator) - kontributor
 * diarahkan kembali ke antrean.
 */
export function ContributionDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams({ from: '/console-layout/contributions/$id' });

  const detailQuery = useContributionDetail(id);
  const reviewMutation = useReviewContribution();
  const { message } = AntdApp.useApp();

  const [decision, setDecision] = useState<ReviewDecision | null>(null);
  const [comment, setComment] = useState('');
  const [correctOpen, setCorrectOpen] = useState(false);

  const detail = detailQuery.data;
  const isPending = detail?.contribution.status === 'pending';

  const closeDecision = () => {
    setDecision(null);
    setComment('');
  };

  const submitDecision = async () => {
    if (!decision || !detail) return;
    try {
      const result = await reviewMutation.mutateAsync({
        id: detail.contribution.id,
        decision,
        comment: comment.trim() || undefined,
      });
      const label = CONTRIBUTION_STATUS_LABELS[result.status] ?? result.status;
      message.success(decision === 'approve' ? `Kontribusi disetujui (${label}).` : `Kontribusi ditolak (${label}).`);
      closeDecision();
    } catch {
      // error global mutation sudah ditampilkan hook/status; modal tetap terbuka
    }
  };

  if (detailQuery.isPending) {
    return (
      <>
        <PageHeader title="Detail Kontribusi" subtitle="Memuat detail kontribusi…" />
        <Card>
          <Skeleton active paragraph={{ rows: 8 }} />
        </Card>
      </>
    );
  }

  if (detailQuery.isError || !detail) {
    return (
      <>
        <PageHeader title="Detail Kontribusi" subtitle="Gagal memuat detail kontribusi." />
        <Alert
          type="error"
          showIcon
          message="Tidak dapat membuka kontribusi ini"
          description={detailQuery.error?.message ?? 'Kontribusi tidak ditemukan atau akses ditolak.'}
          action={
            <Button onClick={() => navigate({ to: '/contributions' })} style={{ whiteSpace: 'nowrap' }}>
              Kembali ke Antrean
            </Button>
          }
        />
      </>
    );
  }

  const entityLabel = ENTITY_TYPE_LABELS[detail.contribution.entity_type] ?? detail.contribution.entity_type;
  const titlePrefix = detail.entityType === 'word' ? detail.word.lemma : detail.child.wordLemma ?? 'entri';

  return (
    <>
      <PageHeader
        title={`${entityLabel} — ${titlePrefix}`}
        subtitle={`Kontribusi oleh ${detail.contribution.contributor_username} · aksi ${detail.contribution.action}`}
        extra={
          <Space wrap>
            <Button icon={<RollbackOutlined />} onClick={() => navigate({ to: '/contributions' })}>
              Kembali ke Antrean
            </Button>
          </Space>
        }
      />

      <Space direction="vertical" size={20} style={{ width: '100%' }}>
        <Descriptions
          size="small"
          column={{ xs: 1, md: 2 }}
          bordered
          items={[
            {
              key: 'status',
              label: 'Status',
              children: <Tag color={STATUS_TAG_COLOR[detail.contribution.status]}>{CONTRIBUTION_STATUS_LABELS[detail.contribution.status]}</Tag>,
            },
            { key: 'submitted', label: 'Dikirim', children: dayjs(detail.contribution.created_at).format('DD MMM YYYY HH:mm') },
          ]}
        />

        <ContributionEntityView detail={detail} />

        {detail.review ? (
          <Card size="small" title="Keputusan Verifikator">
            <Space direction="vertical" size={4}>
              <Text>{detail.review.comment || 'Tanpa catatan.'}</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {dayjs(detail.review.created_at).format('DD MMM YYYY HH:mm')}
              </Text>
            </Space>
          </Card>
        ) : null}

        {isPending ? (
          <Flex justify="flex-end" wrap gap={8} style={{ paddingTop: 8 }}>
            <Button danger icon={<CloseOutlined />} onClick={() => setDecision('reject')}>
              Tolak
            </Button>
            <Button icon={<EditOutlined />} onClick={() => setCorrectOpen(true)}>
              Koreksi
            </Button>
            <Button type="primary" icon={<CheckOutlined />} onClick={() => setDecision('approve')} loading={reviewMutation.isPending}>
              Setujui
            </Button>
          </Flex>
        ) : null}
      </Space>

      <Modal
        title={decision === 'reject' ? 'Tolak Kontribusi' : 'Setujui Kontribusi'}
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
        <Form layout="vertical">
          <Form.Item
            label="Catatan untuk kontributor"
            required={decision === 'reject'}
            validateStatus={decision === 'reject' && !comment.trim() ? 'error' : undefined}
            help={decision === 'reject' && !comment.trim() ? 'Alasan penolakan wajib diisi.' : undefined}
          >
            <Input.TextArea
              rows={3}
              placeholder={decision === 'reject' ? 'Alasan penolakan (wajib)' : 'Catatan opsional'}
              value={comment}
              maxLength={2000}
              onChange={(e) => setComment(e.target.value)}
            />
          </Form.Item>
        </Form>
      </Modal>

      <CorrectContributionDrawer detail={detail} open={correctOpen} zIndex={1100} onCancel={() => setCorrectOpen(false)} />
    </>
  );
}