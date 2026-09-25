import { useMemo } from 'react';
import { createColumnHelper, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { ReloadOutlined } from '@ant-design/icons';
import { Alert, Button, Flex, Tag, Typography } from 'antd';
import { useNavigate } from '@tanstack/react-router';
import { formatDateTime } from '@/shared/utils/format-datetime';
import { DataTable } from '@/shared/components/data-table';
import { PageHeader } from '@/shared/components/page-header';
import { useImportSessionList } from '../application/use-import-sessions';
import type { WordImportSession, WordImportSessionStatus } from '../infrastructure/word-api';

const columnHelper = createColumnHelper<WordImportSession>();

const STATUS_LABEL: Record<WordImportSessionStatus, string> = {
  running: 'Berjalan',
  completed: 'Selesai',
  cancelled: 'Dibatalkan',
  failed: 'Gagal',
};

const STATUS_COLOR: Record<WordImportSessionStatus, string> = {
  running: 'processing',
  completed: 'success',
  cancelled: 'warning',
  failed: 'error',
};

export function ImportHistoryPage() {
  const navigate = useNavigate();
  const { items, hasMore, loadMore, isLoading, isFetching, isFetchingNextPage, isError, error, refetch } =
    useImportSessionList();

  const columns = useMemo(
    () => [
      columnHelper.accessor('finished_at', {
        header: 'Waktu',
        size: 170,
        cell: (info) => formatDateTime(info.getValue() ?? info.row.original.created_at),
      }),
      columnHelper.accessor('source_label', {
        header: 'Sumber',
        size: 200,
        cell: (info) => (
          <Button
            type="link"
            style={{ padding: 0, height: 'auto' }}
            onClick={() =>
              navigate({ to: '/words/import-history/$id', params: { id: info.row.original.id } })
            }
          >
            {info.getValue() || 'Tanpa label'}
          </Button>
        ),
      }),
      columnHelper.accessor('triggered_by_username', {
        header: 'Pemicu',
        size: 140,
        cell: (info) => info.getValue() || '—',
      }),
      columnHelper.accessor('status', {
        header: 'Status',
        size: 110,
        cell: (info) => (
          <Tag color={STATUS_COLOR[info.getValue()]}>{STATUS_LABEL[info.getValue()]}</Tag>
        ),
      }),
      columnHelper.display({
        id: 'summary',
        header: 'Ringkasan',
        size: 280,
        cell: (info) => {
          const row = info.row.original;
          return (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {row.created_count} baru · {row.duplicates_count} duplikat · {row.meanings_added_count}{' '}
              makna · {row.total} total
            </Typography.Text>
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
        title="Riwayat impor"
        subtitle="Sesi impor massal (CSV / lembar) — atribusi data ke Importir Data CSV."
        extra={
          <Flex gap={8}>
            <Button icon={<ReloadOutlined />} onClick={() => refetch()}>
              Muat ulang
            </Button>
            <Button onClick={() => navigate({ to: '/words' })}>Kembali ke Kata</Button>
          </Flex>
        }
      />
      {isError ? (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message="Gagal memuat riwayat impor"
          description={error?.message}
        />
      ) : null}
      <DataTable
        table={table}
        rowKey={(record) => record.id}
        loading={isLoading || (isFetching && !items.length)}
      />
      <Flex justify="center" align="center" gap={16} style={{ marginTop: 16 }}>
        <Typography.Text type="secondary">{items.length} sesi dimuat</Typography.Text>
        {hasMore ? (
          <Button onClick={() => void loadMore()} loading={isFetchingNextPage}>
            Muat lagi
          </Button>
        ) : null}
      </Flex>
    </>
  );
}
