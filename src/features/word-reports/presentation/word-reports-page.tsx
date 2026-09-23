import { useMemo, useState } from 'react';
import { createColumnHelper, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { ReloadOutlined } from '@ant-design/icons';
import { Alert, Button, Flex, Tabs, Tag, Typography } from 'antd';
import { useNavigate } from '@tanstack/react-router';
import { formatDateTime } from '@/shared/utils/format-datetime';
import { DataTable } from '@/shared/components/data-table';
import { PageHeader } from '@/shared/components/page-header';
import { UserInfoLink } from '@/shared/components/user-info-modal';
import { useWordReportList } from '../application/use-word-report-list';
import {
  TAKEDOWN_REASON_LABELS,
  WORD_REPORT_RESOLUTION_LABELS,
  WORD_REPORT_STATUS_LABELS,
  type WordReportListItem,
  type WordReportStatus,
} from '../domain/word-report';

const columnHelper = createColumnHelper<WordReportListItem>();

type StatusTab = WordReportStatus | 'all';

const STATUS_TABS: { key: StatusTab; label: string; status?: WordReportStatus }[] = [
  { key: 'open', label: 'Terbuka', status: 'open' },
  { key: 'resolved', label: 'Ditutup', status: 'resolved' },
  { key: 'all', label: 'Semua' },
];

export function WordReportsPage() {
  const navigate = useNavigate();
  const [statusTab, setStatusTab] = useState<StatusTab>('open');
  const status = STATUS_TABS.find((t) => t.key === statusTab)?.status;
  const { items, hasMore, loadMore, isLoading, isFetching, isFetchingNextPage, isError, error, refetch } =
    useWordReportList({ status });

  const columns = useMemo(
    () => [
      columnHelper.accessor('lemma', {
        header: 'Entri',
        size: 180,
        cell: (info) => (
          <Button
            type="link"
            style={{ padding: 0, height: 'auto' }}
            onClick={() => navigate({ to: '/word-reports/$id', params: { id: info.row.original.id } })}
          >
            {info.getValue() || '—'}
          </Button>
        ),
      }),
      columnHelper.accessor('reason_code', {
        header: 'Alasan',
        size: 200,
        cell: (info) => (
          <div>
            <div>{TAKEDOWN_REASON_LABELS[info.getValue()]}</div>
            {info.row.original.note ? (
              <Typography.Paragraph type="secondary" ellipsis={{ rows: 2 }} style={{ margin: 0 }}>
                {info.row.original.note}
              </Typography.Paragraph>
            ) : null}
          </div>
        ),
      }),
      columnHelper.accessor('username', {
        header: 'Pelapor',
        size: 140,
        cell: (info) => {
          const name = info.getValue();
          return name ? <UserInfoLink username={name} /> : <Typography.Text type="secondary">—</Typography.Text>;
        },
      }),
      columnHelper.accessor('created_at', {
        header: 'Waktu',
        size: 160,
        cell: (info) => formatDateTime(info.getValue()),
      }),
      columnHelper.accessor('status', {
        header: 'Status',
        size: 140,
        cell: (info) => {
          const resolution = info.row.original.resolution;
          return (
            <Tag color={info.getValue() === 'open' ? 'orange' : 'default'}>
              {resolution ? WORD_REPORT_RESOLUTION_LABELS[resolution] : WORD_REPORT_STATUS_LABELS[info.getValue()]}
            </Tag>
          );
        },
      }),
    ],
    [navigate],
  );

  const table = useReactTable({
    data: items,
    columns,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
  });

  return (
    <>
      <PageHeader
        title="Laporan Entri"
        subtitle="Laporan dari pengguna. Entri tetap tayang sampai kamu memutuskan."
        extra={
          <Button icon={<ReloadOutlined />} onClick={() => refetch()}>
            Muat ulang
          </Button>
        }
      />
      <Tabs
        activeKey={statusTab}
        onChange={(key) => setStatusTab(key as StatusTab)}
        items={STATUS_TABS.map((t) => ({ key: t.key, label: t.label }))}
        style={{ marginBottom: 16 }}
      />
      {isError ? (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message="Gagal memuat data"
          description={error?.message}
        />
      ) : null}
      <DataTable table={table} rowKey={(record) => record.id} loading={isLoading || (isFetching && !items.length)} />
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
