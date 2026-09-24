import { useCallback, useEffect, useState } from 'react';
import { CheckOutlined, CloseOutlined, EditOutlined } from '@ant-design/icons';
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
  Space,
  Spin,
  Tag,
  Typography,
} from 'antd';
import { formatDateTime } from '@/shared/utils/format-datetime';
import {
  CONTRIBUTION_STATUS_LABELS,
  ENTITY_TYPE_LABELS,
} from '../domain/contribution';
import { nextPendingId } from '../application/next-pending-id';
import { useContributionDetail } from '../application/use-contribution-detail';
import { useReviewContribution } from '../application/use-review-contribution';
import { ContributionEntityView } from './contribution-entity-view';
import { CorrectContributionDrawer } from './correct-contribution-drawer';
import { useSetCanContribute } from '@/features/users/application/use-update-user-role';

const { Text } = Typography;

const STATUS_TAG_COLOR: Record<string, string> = {
  pending: 'orange',
  approved: 'green',
  rejected: 'red',
  corrected: 'blue',
};

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  if (target.closest('.ant-drawer, .ant-modal')) return true;
  return false;
}

export interface ContributionReviewPanelProps {
  id: string;
  /** Urutan ID antrean saat ini (sebelum drop) untuk hitung advance. */
  queueIds: string[];
  /** Dipanggil setelah usulan ditutup; `nextId` null = antrean habis. */
  onDecided: (nextId: string | null) => void;
}

/**
 * Panel tinjau kanan (master-detail): metadata + entity + aksi sticky.
 * Approve inline (catatan opsional); tolak lewat modal; koreksi drawer.
 */
export function ContributionReviewPanel({ id, queueIds, onDecided }: ContributionReviewPanelProps) {
  const detailQuery = useContributionDetail(id);
  const reviewMutation = useReviewContribution();
  const pauseContribution = useSetCanContribute();
  const { message } = AntdApp.useApp();

  const [approveComment, setApproveComment] = useState('');
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectComment, setRejectComment] = useState('');
  const [correctOpen, setCorrectOpen] = useState(false);

  const detail = detailQuery.data;
  const isPending = detail?.contribution.status === 'pending';

  useEffect(() => {
    setApproveComment('');
    setRejectOpen(false);
    setRejectComment('');
    setCorrectOpen(false);
  }, [id]);

  const finishDecision = useCallback(() => {
    onDecided(nextPendingId(queueIds, id));
  }, [id, onDecided, queueIds]);

  const approve = useCallback(async () => {
    if (!detail || !isPending || reviewMutation.isPending) return;
    try {
      const result = await reviewMutation.mutateAsync({
        id: detail.contribution.id,
        decision: 'approve',
        comment: approveComment.trim() || undefined,
      });
      const label = CONTRIBUTION_STATUS_LABELS[result.status] ?? result.status;
      if (result.merged_into_word_id) {
        message.success(
          `Kontribusi disetujui - makna digabung ke kata yang sudah tayang (${label}).`,
        );
      } else {
        message.success(`Kontribusi disetujui (${label}).`);
      }
      finishDecision();
    } catch {
      // error ditampilkan hook/status
    }
  }, [approveComment, detail, finishDecision, isPending, message, reviewMutation]);

  const submitReject = async () => {
    if (!detail || !rejectComment.trim()) return;
    try {
      const result = await reviewMutation.mutateAsync({
        id: detail.contribution.id,
        decision: 'reject',
        comment: rejectComment.trim(),
      });
      const label = CONTRIBUTION_STATUS_LABELS[result.status] ?? result.status;
      message.success(`Kontribusi ditolak (${label}).`);
      setRejectOpen(false);
      setRejectComment('');
      finishDecision();
    } catch {
      // modal tetap terbuka
    }
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;
      if (event.key === 'a' || event.key === 'A') {
        if (!isPending || correctOpen || rejectOpen) return;
        event.preventDefault();
        void approve();
      }
      if (event.key === 'r' || event.key === 'R') {
        if (!isPending || correctOpen || rejectOpen) return;
        event.preventDefault();
        setRejectOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [approve, correctOpen, isPending, rejectOpen]);

  if (detailQuery.isPending) {
    return (
      <Flex align="center" justify="center" style={{ minHeight: 240 }}>
        <Spin tip="Memuat detail…" />
      </Flex>
    );
  }

  if (detailQuery.isError || !detail) {
    return (
      <Alert
        type="error"
        showIcon
        message="Tidak dapat membuka kontribusi ini"
        description={detailQuery.error?.message ?? 'Kontribusi tidak ditemukan atau akses ditolak.'}
      />
    );
  }

  const entityLabel = ENTITY_TYPE_LABELS[detail.contribution.entity_type] ?? detail.contribution.entity_type;
  const titlePrefix = detail.entityType === 'word' ? detail.word.lemma : detail.child.wordLemma ?? 'entri';

  return (
    <Flex vertical style={{ height: '100%', minHeight: 0 }}>
      <Flex justify="space-between" align="flex-start" wrap gap={8} style={{ marginBottom: 12 }}>
        <div>
          <Text strong style={{ fontSize: 16 }}>
            {entityLabel} - {titlePrefix}
          </Text>
          <div>
            <Text type="secondary">
              oleh {detail.contribution.contributor_username} · aksi {detail.contribution.action}
            </Text>
          </div>
        </div>
        {detail.contribution.contributor_username !== 'anonim' ? (
          <Button
            danger
            size="small"
            loading={pauseContribution.isPending}
            onClick={() =>
              pauseContribution.mutate({
                id: detail.contribution.user_id,
                canContribute: false,
                username: detail.contribution.contributor_username,
              })
            }
          >
            Hentikan kontribusi
          </Button>
        ) : null}
      </Flex>

      <div style={{ flex: 1, overflow: 'auto', paddingBottom: isPending ? 8 : 0 }}>
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          {isPending && detail.entityType === 'word' ? (
            <Alert
              type="info"
              showIcon
              message="Satu kata tayang per bahasa"
              description="Jika kata dengan ejaan sama sudah tayang, Setujui akan menggabungkan makna ke entri itu (bukan membuat entri kedua)."
            />
          ) : null}
          <Descriptions
            size="small"
            column={1}
            bordered
            items={[
              {
                key: 'status',
                label: 'Status',
                children: (
                  <Tag color={STATUS_TAG_COLOR[detail.contribution.status]}>
                    {CONTRIBUTION_STATUS_LABELS[detail.contribution.status]}
                  </Tag>
                ),
              },
              {
                key: 'submitted',
                label: 'Dikirim',
                children: formatDateTime(detail.contribution.created_at),
              },
              ...(detail.contribution.search_miss_id
                ? [
                    {
                      key: 'search_miss',
                      label: 'Pencarian',
                      children: (
                        <Tag color="purple">
                          {detail.contribution.search_miss_term ?? detail.contribution.search_miss_id}
                          {detail.contribution.search_miss_direction
                            ? ` (${detail.contribution.search_miss_direction === 'translation' ? 'Indonesia → Sambas' : 'Sambas → Indonesia'})`
                            : ''}
                        </Tag>
                      ),
                    },
                  ]
                : []),
            ]}
          />

          <ContributionEntityView detail={detail} />

          {detail.review ? (
            <Card size="small" title="Keputusan Verifikator">
              <Space direction="vertical" size={4}>
                <Text>{detail.review.comment || 'Tanpa catatan.'}</Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {formatDateTime(detail.review.created_at)}
                </Text>
              </Space>
            </Card>
          ) : null}
        </Space>
      </div>

      {isPending ? (
        <div
          style={{
            borderTop: '1px solid rgba(0,0,0,0.06)',
            paddingTop: 12,
            marginTop: 8,
            background: 'var(--ant-color-bg-container, #fff)',
          }}
        >
          <Form layout="vertical" style={{ marginBottom: 8 }}>
            <Form.Item label="Catatan (opsional, untuk Setujui)" style={{ marginBottom: 8 }}>
              <Input.TextArea
                rows={2}
                placeholder="Catatan opsional untuk kontributor"
                value={approveComment}
                maxLength={2000}
                onChange={(e) => setApproveComment(e.target.value)}
              />
            </Form.Item>
          </Form>
          <Flex justify="flex-end" wrap gap={8}>
            <Button danger icon={<CloseOutlined />} onClick={() => setRejectOpen(true)}>
              Tolak
            </Button>
            <Button icon={<EditOutlined />} onClick={() => setCorrectOpen(true)}>
              Koreksi
            </Button>
            <Button
              type="primary"
              icon={<CheckOutlined />}
              loading={reviewMutation.isPending}
              onClick={() => void approve()}
            >
              Setujui
            </Button>
          </Flex>
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
            Pintasan: A setujui · R tolak · J/K pindah antrean
          </Text>
        </div>
      ) : null}

      <Modal
        title="Tolak Kontribusi"
        open={rejectOpen}
        onCancel={() => {
          setRejectOpen(false);
          setRejectComment('');
        }}
        okText="Tolak"
        okButtonProps={{
          danger: true,
          loading: reviewMutation.isPending,
          disabled: !rejectComment.trim(),
        }}
        onOk={() => void submitReject()}
      >
        <Form layout="vertical">
          <Form.Item
            label="Alasan penolakan"
            required
            validateStatus={!rejectComment.trim() ? 'error' : undefined}
            help={!rejectComment.trim() ? 'Alasan penolakan wajib diisi.' : undefined}
          >
            <Input.TextArea
              rows={3}
              placeholder="Alasan penolakan (wajib)"
              value={rejectComment}
              maxLength={2000}
              onChange={(e) => setRejectComment(e.target.value)}
              autoFocus
            />
          </Form.Item>
        </Form>
      </Modal>

      <CorrectContributionDrawer
        detail={detail}
        open={correctOpen}
        zIndex={1100}
        onCancel={() => setCorrectOpen(false)}
        onApplied={(result) => {
          if (result.status === 'pending') return;
          finishDecision();
        }}
      />
    </Flex>
  );
}
