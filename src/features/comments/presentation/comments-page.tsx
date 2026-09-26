import { useMemo, useState } from 'react';
import { createColumnHelper, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { EyeOutlined, StopOutlined, ReloadOutlined } from '@ant-design/icons';
import { Alert, App as AntdApp, Button, Flex, Tabs, Tag, Tooltip, Typography } from 'antd';
import { formatDateTime } from '@/shared/utils/format-datetime';
import { useNavigate } from '@tanstack/react-router';
import { DataTable } from '@/shared/components/data-table';
import { PageHeader } from '@/shared/components/page-header';
import { normalizeError } from '@/shared/api/error';
import { useAuth } from '@/shared/auth/use-auth';
import { useCommentList } from '../application/use-comment-list';
import { useTakedownComment } from '../application/use-takedown-comment';
import { useUncensorComment } from '../application/use-uncensor-comment';
import {
  COMMENT_STATUS_LABELS,
  COMMENT_STATUSES,
  COMMENT_STATUS_TAG_COLOR,
  type AdminCommentItem,
  type CommentStatus,
} from '../domain/comment';

const columnHelper = createColumnHelper<AdminCommentItem>();

export function CommentsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { message, modal } = AntdApp.useApp();
  const [status, setStatus] = useState<CommentStatus>('published');

  const { items, hasMore, loadMore, isLoading, isFetching, isFetchingNextPage, isError, error, refetch } =
    useCommentList({
      status,
      enabled: user?.role === 'reviewer' || user?.role === 'admin' || user?.role === 'root',
    });

  const takedownMutation = useTakedownComment();
  const uncensorMutation = useUncensorComment();

  const confirmTakedown = (item: AdminCommentItem) => {
    modal.confirm({
      title: 'Takedown komentar ini?',
      content: `"${item.body}" - ${item.username ?? 'pengguna terhapus'}`,
      okText: 'Takedown',
      okButtonProps: { danger: true },
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

  const confirmUncensor = (item: AdminCommentItem) => {
    modal.confirm({
      title: 'Pulihkan teks asli?',
      content: item.body_original ?? '',
      okText: 'Pulihkan',
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

  const columns = useMemo(
    () => [
      columnHelper.accessor('body', {
        header: 'Komentar',
        size: 420,
        cell: (info) => {
          const row = info.row.original;
          return (
            <div>
              <Typography.Paragraph ellipsis={{ rows: 2, expandable: true, symbol: 'Lihat' }} style={{ marginBottom: 0 }}>
                {info.getValue()}
              </Typography.Paragraph>
              {row.is_censored && row.body_original ? (
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  Asli: {row.body_original}
                </Typography.Text>
              ) : null}
            </div>
          );
        },
      }),
      columnHelper.accessor('username', {
        header: 'Penulis',
        size: 160,
        meta: { responsive: ['md'] },
        cell: (info) => {
          const username = info.getValue();
          return username ? (
            <Typography.Text strong>{username}</Typography.Text>
          ) : (
            <Typography.Text type="secondary" italic>
              Pengguna terhapus
            </Typography.Text>
          );
        },
      }),
      columnHelper.accessor('word_id', {
        header: 'Kata',
        size: 160,
        cell: (info) => {
          const wordId = info.getValue();
          const lemma = info.row.original.word_lemma;
          return (
            <Typography.Link onClick={() => navigate({ to: '/words/$id', params: { id: wordId } })}>
              {lemma ?? wordId}
            </Typography.Link>
          );
        },
      }),
      columnHelper.accessor('status', {
        header: 'Status',
        size: 180,
        cell: (info) => (
          <Flex gap={4} wrap>
            <Tag color={COMMENT_STATUS_TAG_COLOR[info.getValue()]}>{COMMENT_STATUS_LABELS[info.getValue()]}</Tag>
            {info.row.original.is_censored ? <Tag color="gold">Disensor</Tag> : null}
          </Flex>
        ),
      }),
      columnHelper.accessor('created_at', {
        header: 'Dikirim',
        size: 160,
        meta: { responsive: ['lg'] },
        cell: (info) => formatDateTime(info.getValue()),
      }),
      columnHelper.display({
        id: 'reviewed_at',
        header: 'Dimoderasi',
        size: 160,
        meta: { responsive: ['xl'] },
        cell: ({ row }) =>
          row.original.reviewed_at ? (
            formatDateTime(row.original.reviewed_at)
          ) : (
            <Typography.Text type="secondary">-</Typography.Text>
          ),
      }),
      columnHelper.display({
        id: 'actions',
        header: 'Aksi',
        size: 120,
        meta: { fixed: 'right' },
        cell: ({ row }) => {
          const item = row.original;
          const busyTd = takedownMutation.isPending && takedownMutation.variables === item.id;
          const busyUc = uncensorMutation.isPending && uncensorMutation.variables === item.id;
          return (
            <Flex gap={0}>
              {item.is_censored ? (
                <Tooltip title="Pulihkan teks asli">
                  <Button
                    type="link"
                    icon={<EyeOutlined />}
                    loading={busyUc}
                    onClick={() => confirmUncensor(item)}
                  />
                </Tooltip>
              ) : null}
              {item.status === 'published' ? (
                <Tooltip title="Takedown">
                  <Button
                    type="link"
                    danger
                    icon={<StopOutlined />}
                    loading={busyTd}
                    onClick={() => confirmTakedown(item)}
                  />
                </Tooltip>
              ) : null}
              {!item.is_censored && item.status !== 'published' ? (
                <Typography.Text type="secondary">-</Typography.Text>
              ) : null}
            </Flex>
          );
        },
      }),
    ],
    [
      navigate,
      takedownMutation.isPending,
      takedownMutation.variables,
      uncensorMutation.isPending,
      uncensorMutation.variables,
    ],
  );

  const table = useReactTable({
    data: items,
    columns,
    getRowId: (row) => String(row.id),
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
  });

  return (
    <>
      <PageHeader
        title="Moderasi Komentar"
        subtitle="Komentar tayang langsung saat dikirim. Admin dapat men-takedown yang melanggar."
        extra={
          <Button icon={<ReloadOutlined />} onClick={() => refetch()}>
            Muat ulang
          </Button>
        }
      />
      <Tabs
        activeKey={status}
        onChange={(key) => setStatus(key as CommentStatus)}
        items={COMMENT_STATUSES.map((s) => ({ key: s, label: COMMENT_STATUS_LABELS[s] }))}
      />

      {isError ? (
        <Alert type="error" showIcon style={{ marginBottom: 16 }} message="Gagal memuat data" description={error?.message} />
      ) : null}

      <DataTable table={table} rowKey={(record) => String(record.id)} loading={isLoading || (isFetching && !items.length)} />

      <Flex justify="center" align="center" gap={16} style={{ marginTop: 16 }}>
        <Typography.Text type="secondary">{items.length} komentar dimuat</Typography.Text>
        {hasMore ? (
          <Button onClick={() => loadMore()} loading={isFetchingNextPage}>
            Muat lagi
          </Button>
        ) : null}
      </Flex>
    </>
  );
}
