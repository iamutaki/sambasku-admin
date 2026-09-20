import { useMemo, useState } from 'react';
import { createColumnHelper, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { ReloadOutlined, ToolOutlined } from '@ant-design/icons';
import { Alert, Button, Flex, Tabs, Tag, Tooltip, Typography } from 'antd';
import { formatDateTime } from '@/shared/utils/format-datetime';
import { useNavigate } from '@tanstack/react-router';
import { DataTable } from '@/shared/components/data-table';
import { PageHeader } from '@/shared/components/page-header';
import { useAuth } from '@/shared/auth/use-auth';
import { useWordSuggestionList } from '../application/use-word-suggestion-list';
import {
  SUGGESTION_STATUS_LABELS,
  type SuggestionListItem,
  type SuggestionStatus,
} from '../domain/word-suggestion';

const columnHelper = createColumnHelper<SuggestionListItem>();

const STATUS_TAG_COLOR: Record<SuggestionStatus, string> = {
  pending: 'orange',
  approved: 'green',
  rejected: 'red',
  corrected: 'blue',
};

type StatusTab = SuggestionStatus | 'all';

const STATUS_TABS: { key: StatusTab; label: string; status?: SuggestionStatus }[] = [
  { key: 'pending', label: SUGGESTION_STATUS_LABELS.pending, status: 'pending' },
  { key: 'approved', label: SUGGESTION_STATUS_LABELS.approved, status: 'approved' },
  { key: 'rejected', label: SUGGESTION_STATUS_LABELS.rejected, status: 'rejected' },
  { key: 'corrected', label: SUGGESTION_STATUS_LABELS.corrected, status: 'corrected' },
  { key: 'all', label: 'Semua' },
];

export function WordSuggestionsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [statusTab, setStatusTab] = useState<StatusTab>('pending');
  const status = STATUS_TABS.find((t) => t.key === statusTab)?.status;
  const canModerate =
    user?.role === 'reviewer' || user?.role === 'admin' || user?.role === 'root';

  const { items, hasMore, loadMore, isLoading, isFetching, isFetchingNextPage, isError, error, refetch } =
    useWordSuggestionList({ status, enabled: canModerate });

  const columns = useMemo(
    () => [
      columnHelper.accessor('contributor_username', {
        header: 'Kontributor',
        size: 160,
        cell: (info) => <Typography.Text strong>{info.getValue() ?? '-'}</Typography.Text>,
      }),
      columnHelper.accessor('word_lemma', {
        header: 'Kata',
        size: 140,
      }),
      columnHelper.accessor('reason', {
        header: 'Alasan',
        size: 240,
        cell: (info) => (
          <Typography.Text ellipsis={{ tooltip: info.getValue() }}>{info.getValue()}</Typography.Text>
        ),
      }),
      columnHelper.display({
        id: 'summary',
        header: 'Ringkasan',
        size: 200,
        cell: (info) => {
          const s = info.row.original.summary_changes;
          const parts: string[] = [];
          if (s.lemma) parts.push('lemma');
          if (s.notes) parts.push('catatan');
          if (s.meanings_count) parts.push(`makna×${s.meanings_count}`);
          if (s.categories_added || s.categories_removed) {
            parts.push(`kat±${s.categories_added + s.categories_removed}`);
          }
          if (s.relations_count) parts.push(`relasi×${s.relations_count}`);
          if (s.variants_count) parts.push(`varian×${s.variants_count}`);
          if (s.images_count) parts.push(`gambar×${s.images_count}`);
          return <Typography.Text type="secondary">{parts.join(', ') || '-'}</Typography.Text>;
        },
      }),
      columnHelper.accessor('status', {
        header: 'Status',
        size: 110,
        cell: (info) => (
          <Tag color={STATUS_TAG_COLOR[info.getValue()]}>
            {SUGGESTION_STATUS_LABELS[info.getValue()]}
          </Tag>
        ),
      }),
      columnHelper.accessor('created_at', {
        header: 'Diajukan',
        size: 140,
        cell: (info) => formatDateTime(info.getValue()),
      }),
      columnHelper.display({
        id: 'actions',
        header: 'Aksi',
        size: 72,
        meta: { fixed: 'right' },
        cell: (info) => (
          <Tooltip title="Review">
            <Button
              type="link"
              icon={<ToolOutlined />}
              onClick={() =>
                void navigate({
                  to: '/word-suggestions/$id',
                  params: { id: info.row.original.id },
                })
              }
            />
          </Tooltip>
        ),
      }),
    ],
    [navigate],
  );

  const table = useReactTable({
    data: items,
    columns,
    getRowId: (row) => String(row.id),
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
  });

  if (!canModerate) {
    return (
      <Alert type="warning" showIcon message="Hanya reviewer/admin yang bisa membuka antrean ini." />
    );
  }

  return (
    <>
      <PageHeader
        title="Usul Perubahan"
        subtitle="Usulan perbaikan kata tayang dari komunitas (approve / reject)."
        extra={
          <Button icon={<ReloadOutlined />} onClick={() => void refetch()} loading={isFetching}>
            Muat ulang
          </Button>
        }
      />
      <Tabs
        activeKey={statusTab}
        onChange={(k) => setStatusTab(k as StatusTab)}
        items={STATUS_TABS.map((t) => ({ key: t.key, label: t.label }))}
        style={{ marginBottom: 8 }}
      />
      {isError ? (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message="Gagal memuat data"
          description={error instanceof Error ? error.message : undefined}
        />
      ) : null}
      <DataTable
        table={table}
        rowKey={(record) => String(record.id)}
        loading={isLoading || (isFetching && !items.length)}
      />
      <Flex justify="center" align="center" gap={16} style={{ marginTop: 16 }}>
        <Typography.Text type="secondary">{items.length} entri dimuat</Typography.Text>
        {hasMore ? (
          <Button onClick={() => loadMore()} loading={isFetchingNextPage}>
            Muat lagi
          </Button>
        ) : null}
      </Flex>
    </>
  );
}
