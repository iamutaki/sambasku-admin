import { EyeOutlined, StopOutlined } from '@ant-design/icons';
import { Alert, App as AntdApp, Button, Divider, Flex, Skeleton, Space, Tag, Typography } from 'antd';
import { formatDateTime } from '@/shared/utils/format-datetime';
import { normalizeError } from '@/shared/api/error';
import {
  COMMENT_STATUS_LABELS,
  COMMENT_STATUS_TAG_COLOR,
  type AdminCommentItem,
} from '../domain/comment';
import { useTakedownComment } from '../application/use-takedown-comment';
import { useUncensorComment } from '../application/use-uncensor-comment';
import { useWordComments } from '../application/use-word-comments';

const { Text, Paragraph } = Typography;

/** Section komentar di detail kata - marking status + takedown/uncensor. */
export function WordComments({ wordId }: { wordId: string }) {
  const { message, modal } = AntdApp.useApp();
  const { items, hasMore, loadMore, isLoading, isFetchingNextPage, isError, refetch } =
    useWordComments(wordId);
  const takedownMutation = useTakedownComment();
  const uncensorMutation = useUncensorComment();

  const decide = (item: AdminCommentItem) => {
    modal.confirm({
      title: 'Takedown komentar ini?',
      content: item.body,
      okText: 'Takedown',
      okButtonProps: { danger: true },
      cancelText: 'Batal',
      onOk: async () => {
        try {
          await takedownMutation.mutateAsync(item.id);
          message.success('Komentar di-takedown');
        } catch (err) {
          message.error(normalizeError(err).message);
          refetch();
        }
      },
    });
  };

  const restore = (item: AdminCommentItem) => {
    modal.confirm({
      title: 'Pulihkan teks asli?',
      content: item.body_original ?? '',
      okText: 'Pulihkan',
      cancelText: 'Batal',
      onOk: async () => {
        try {
          await uncensorMutation.mutateAsync(item.id);
          message.success('Teks asli dipulihkan');
        } catch (err) {
          message.error(normalizeError(err).message);
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
        const busyTd = takedownMutation.isPending && takedownMutation.variables === cm.id;
        const busyUc = uncensorMutation.isPending && uncensorMutation.variables === cm.id;
        const marked =
          cm.status === 'taken_down' || cm.status === 'deleted_by_author'
            ? {
                background:
                  cm.status === 'taken_down' ? 'rgba(255,77,79,0.06)' : 'rgba(0,0,0,0.03)',
                borderLeft: `3px solid ${cm.status === 'taken_down' ? '#ff4d4f' : '#bfbfbf'}`,
                padding: '8px 12px',
                borderRadius: 4,
              }
            : cm.is_censored
              ? {
                  background: 'rgba(250,173,20,0.06)',
                  borderLeft: '3px solid #faad14',
                  padding: '8px 12px',
                  borderRadius: 4,
                }
              : undefined;
        return (
          <div key={cm.id} style={marked}>
            <Flex justify="space-between" align="center" wrap gap={8}>
              <Space size={8} wrap>
                <Text strong>{cm.username ?? 'pengguna terhapus'}</Text>
                <Text type="secondary">{formatDateTime(cm.created_at)}</Text>
                <Tag color={COMMENT_STATUS_TAG_COLOR[cm.status]}>{COMMENT_STATUS_LABELS[cm.status]}</Tag>
                {cm.is_censored ? <Tag color="gold">Disensor</Tag> : null}
              </Space>
              <Space size={4}>
                {cm.is_censored ? (
                  <Button
                    size="small"
                    icon={<EyeOutlined />}
                    loading={busyUc}
                    disabled={uncensorMutation.isPending && !busyUc}
                    onClick={() => restore(cm)}
                  >
                    Pulihkan teks
                  </Button>
                ) : null}
                {cm.status === 'published' ? (
                  <Button
                    size="small"
                    danger
                    icon={<StopOutlined />}
                    loading={busyTd}
                    disabled={takedownMutation.isPending && !busyTd}
                    onClick={() => decide(cm)}
                  >
                    Takedown
                  </Button>
                ) : null}
              </Space>
            </Flex>
            <Paragraph ellipsis={{ rows: 3, expandable: true, symbol: 'selengkapnya' }} style={{ marginBottom: 0, marginTop: 4 }}>
              {cm.body}
            </Paragraph>
            {cm.is_censored && cm.body_original ? (
              <Paragraph type="secondary" style={{ marginBottom: 0, marginTop: 4, fontSize: 12 }}>
                Asli: {cm.body_original}
              </Paragraph>
            ) : null}
            <Divider style={{ margin: '8px 0 0' }} />
          </div>
        );
      })}
      {hasMore ? (
        <Button onClick={() => loadMore()} loading={isFetchingNextPage} size="small">
          Muat lagi
        </Button>
      ) : null}
    </Space>
  );
}
