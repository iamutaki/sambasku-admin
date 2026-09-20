import { CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { Alert, App as AntdApp, Button, Divider, Flex, Skeleton, Space, Tag, Typography } from 'antd';
import { formatDateTime } from '@/shared/utils/format-datetime';
import { normalizeError } from '@/shared/api/error';
import {
  COMMENT_STATUS_LABELS,
  COMMENT_STATUS_TAG_COLOR,
  type AdminCommentItem,
} from '../domain/comment';
import { useReviewComment } from '../application/use-review-comment';
import { useWordComments } from '../application/use-word-comments';

const { Text, Paragraph } = Typography;

/**
 * Section "8. Komentar" di halaman detail kata - semua status sekaligus
 * (embed self-contained pola WordVoteCount). Komentar pending bisa
 * diputuskan INLINE (pola actions halaman antrean): approve/reject lewat
 * useReviewComment; invalidasi prefix ['comments'] otomatis menyegarkan
 * section ini DAN antrean global.
 */
export function WordComments({ wordId }: { wordId: string }) {
  const { message, modal } = AntdApp.useApp();
  const { items, hasMore, loadMore, isLoading, isFetchingNextPage, isError, refetch } =
    useWordComments(wordId);
  const reviewMutation = useReviewComment();

  const decide = (item: AdminCommentItem, decision: 'approve' | 'reject') => {
    modal.confirm({
      title: decision === 'approve' ? 'Terbitkan komentar ini?' : 'Tolak komentar ini?',
      content: item.body,
      okText: decision === 'approve' ? 'Terbitkan' : 'Tolak',
      okButtonProps: { danger: decision === 'reject' },
      cancelText: 'Batal',
      onOk: async () => {
        try {
          await reviewMutation.mutateAsync({ id: item.id, decision });
          message.success(decision === 'approve' ? 'Komentar diterbitkan' : 'Komentar ditolak');
        } catch (err) {
          message.error(normalizeError(err).message); // 409 race → refresh agar akurat
          refetch();
        }
      },
    });
  };

  if (isLoading) {
    return <Skeleton active paragraph={{ rows: 2 }} />;
  }

  if (isError) {
    return <Alert type="error" showIcon message="Komentar tidak dapat dimuat" />;
  }

  if (items.length === 0) {
    return <Text type="secondary">Belum ada komentar</Text>;
  }

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      {items.map((cm) => {
        const busy = reviewMutation.isPending && reviewMutation.variables?.id === cm.id;
        return (
          <div key={cm.id}>
            <Flex justify="space-between" align="center" wrap gap={8}>
              <Space size={8} wrap>
                <Text strong>{cm.username ?? 'pengguna terhapus'}</Text>
                <Text type="secondary">{formatDateTime(cm.created_at)}</Text>
                <Tag color={COMMENT_STATUS_TAG_COLOR[cm.status]}>{COMMENT_STATUS_LABELS[cm.status]}</Tag>
              </Space>
              {cm.status === 'pending_review' ? (
                <Space size={4}>
                  <Button
                    size="small"
                    danger
                    icon={<CloseOutlined />}
                    loading={busy}
                    disabled={reviewMutation.isPending && !busy}
                    onClick={() => decide(cm, 'reject')}
                  >
                    Tolak
                  </Button>
                  <Button
                    size="small"
                    type="primary"
                    icon={<CheckOutlined />}
                    loading={busy}
                    disabled={reviewMutation.isPending && !busy}
                    onClick={() => decide(cm, 'approve')}
                  >
                    Terbitkan
                  </Button>
                </Space>
              ) : null}
            </Flex>
            <Paragraph style={{ marginTop: 4, marginBottom: 0 }} ellipsis={{ rows: 3, expandable: true, symbol: 'selengkapnya' }}>
              {cm.body}
            </Paragraph>
            <Divider style={{ margin: '12px 0 0' }} />
          </div>
        );
      })}

      {hasMore ? (
        <Flex justify="center">
          <Button loading={isFetchingNextPage} onClick={() => loadMore()}>
            Muat lagi
          </Button>
        </Flex>
      ) : (
        <Text type="secondary" style={{ display: 'block', textAlign: 'center' }}>
          {items.length} komentar dimuat
        </Text>
      )}
    </Space>
  );
}
