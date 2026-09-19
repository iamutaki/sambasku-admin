import { useMemo, useState } from 'react';
import { createColumnHelper, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { CheckOutlined, CloseOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons';
import { Alert, App as AntdApp, Button, Flex, Popconfirm, Tabs, Tag, Tooltip, Typography } from 'antd';
import dayjs from 'dayjs';
import { useNavigate } from '@tanstack/react-router';
import { DataTable } from '@/shared/components/data-table';
import { PageHeader } from '@/shared/components/page-header';
import { normalizeError } from '@/shared/api/error';
import { useAuth } from '@/shared/auth/use-auth';
import { useCommentList } from '../application/use-comment-list';
import { useReviewComment, type ReviewCommentDecision } from '../application/use-review-comment';
import { useDeleteComment } from '../application/use-delete-comment';
import {
  COMMENT_STATUS_LABELS,
  COMMENT_STATUSES,
  COMMENT_STATUS_TAG_COLOR,
  type AdminCommentItem,
  type CommentStatus,
} from '../domain/comment';

const columnHelper = createColumnHelper<AdminCommentItem>();

/**
 * Moderasi komentar (docs/api/09-api-comment.md #4-6): antrean
 * pending_review → approve (terbit) / reject (tolak). List per status,
 * cursor pagination, keputusan inline (modal konfirmasi).
 */
export function CommentsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { message, modal } = AntdApp.useApp();
  const [status, setStatus] = useState<CommentStatus>('pending_review');

  const { items, hasMore, loadMore, isLoading, isFetching, isFetchingNextPage, isError, error, refetch } =
    useCommentList({
      status,
      enabled: user?.role === 'reviewer' || user?.role === 'admin' || user?.role === 'root',
    });

  const reviewMutation = useReviewComment();
  const deleteComment = useDeleteComment();
  const canDelete = user?.role === 'root' || user?.role === 'admin' || user?.role === 'reviewer';

  const confirmReview = (item: AdminCommentItem, decision: ReviewCommentDecision) => {
    modal.confirm({
      title: decision === 'approve' ? 'Terbitkan komentar?' : 'Tolak komentar?',
      content: `"${item.body}" - ${item.username ?? 'pengguna terhapus'}`,
      okText: decision === 'approve' ? 'Terbitkan' : 'Tolak',
      okButtonProps: decision === 'reject' ? { danger: true } : undefined,
      onOk: async () => {
        try {
          await reviewMutation.mutateAsync({ id: item.id, decision });
          message.success(decision === 'approve' ? 'Komentar diterbitkan' : 'Komentar ditolak');
        } catch (err) {
          // 409 COMMENT_ALREADY_REVIEWED (race dua moderator) → sinkronkan list
          message.error(normalizeError(err).message);
          refetch();
        }
      },
    });
  };

  const onDeleteComment = async (item: AdminCommentItem) => {
    try {
      await deleteComment.mutateAsync(item.id, {
        onSuccess: () => message.success('Komentar dihapus'),
        onError: (err) => message.warning(normalizeError(err).message || 'Gagal menghapus komentar'),
      });
    } catch {
      // Handled.
    }
  };

  const columns = useMemo(
    () => [
      columnHelper.accessor('body', {
        header: 'Komentar',
        size: 420,
        cell: (info) => (
          <Typography.Paragraph ellipsis={{ rows: 2, expandable: true, symbol: 'Lihat' }} style={{ marginBottom: 0 }}>
            {info.getValue()}
          </Typography.Paragraph>
        ),
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
        size: 130,
        cell: (info) => (
          <Tag color={COMMENT_STATUS_TAG_COLOR[info.getValue()]}>{COMMENT_STATUS_LABELS[info.getValue()]}</Tag>
        ),
      }),
      columnHelper.accessor('created_at', {
        header: 'Dikirim',
        size: 160,
        meta: { responsive: ['lg'] },
        cell: (info) => dayjs(info.getValue()).format('DD MMM YYYY HH:mm'),
      }),
      columnHelper.display({
        id: 'reviewed_at',
        header: 'Direview',
        size: 160,
        meta: { responsive: ['xl'] },
        cell: ({ row }) =>
          row.original.reviewed_at ? (
            dayjs(row.original.reviewed_at).format('DD MMM YYYY HH:mm')
          ) : (
            <Typography.Text type="secondary">Belum</Typography.Text>
          ),
      }),
      columnHelper.display({
        id: 'actions',
        header: 'Aksi',
        size: 140,
        meta: { fixed: 'right' },
        cell: ({ row }) => {
          const item = row.original;
          const reviewBusy = reviewMutation.isPending && reviewMutation.variables?.id === item.id;
          const deleteBusy = deleteComment.isPending && deleteComment.variables === item.id;
          return (
            <Flex gap={0} wrap={false} align="center">
              {item.status === 'pending_review' ? (
                <>
                  <Tooltip title="Terbitkan">
                    <Button
                      type="link"
                      icon={<CheckOutlined />}
                      loading={reviewBusy}
                      onClick={() => confirmReview(item, 'approve')}
                    />
                  </Tooltip>
                  <Tooltip title="Tolak">
                    <Button
                      type="link"
                      danger
                      icon={<CloseOutlined />}
                      loading={reviewBusy}
                      onClick={() => confirmReview(item, 'reject')}
                    />
                  </Tooltip>
                </>
              ) : null}
              {canDelete ? (
                <Popconfirm
                  title="Hapus komentar ini?"
                  description="Aksi tidak bisa dibatalkan."
                  okText="Hapus"
                  okButtonProps={{ danger: true }}
                  cancelText="Batal"
                  onConfirm={() => onDeleteComment(item)}
                >
                  <Tooltip title="Hapus">
                    <Button
                      type="link"
                      danger
                      icon={<DeleteOutlined />}
                      loading={deleteBusy}
                    />
                  </Tooltip>
                </Popconfirm>
              ) : null}
              {item.status !== 'pending_review' && !canDelete ? (
                <Typography.Text type="secondary">-</Typography.Text>
              ) : null}
            </Flex>
          );
        },
      }),
    ],
    [navigate, reviewMutation.isPending, reviewMutation.variables?.id, confirmReview, canDelete, deleteComment.isPending, deleteComment.variables, onDeleteComment],
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
        subtitle="Komentar masuk berstatus Menunggu sampai di-approve (satu-satunya jalur ke published)."
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

      {isError ? <Alert type="error" showIcon style={{ marginBottom: 16 }} message="Gagal memuat data" description={error?.message} /> : null}

      <DataTable
        table={table}
        rowKey={(record) => String(record.id)}
        loading={isLoading || (isFetching && !items.length)}
      />

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