import { useMemo, useState } from 'react';
import { createColumnHelper, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { ReloadOutlined, SearchOutlined, ToolOutlined } from '@ant-design/icons';
import { Alert, App as AntdApp, Button, Col, Flex, Input, Popconfirm, Row, Select, Tag, Tooltip, Typography } from 'antd';
import dayjs from 'dayjs';
import { DataTable } from '@/shared/components/data-table';
import { PageHeader } from '@/shared/components/page-header';
import { useAuth } from '@/shared/auth/use-auth';
import { normalizeError } from '@/shared/api/error';
import { useDebouncedValue } from '@/shared/hooks/use-debounced-value';
import { useSearchMissList } from '../application/use-search-miss-list';
import { useDismissSearchMiss } from '../application/use-dismiss-search-miss';
import {
  DIRECTION_LABELS,
  DIRECTION_TAG_COLOR,
  type SearchMissDirection,
  type SearchMissListItem,
} from '../domain/search-miss';

const columnHelper = createColumnHelper<SearchMissListItem>();

const directionOptions: { value: SearchMissDirection; label: string }[] = [
  { value: 'lemma', label: DIRECTION_LABELS.lemma },
  { value: 'translation', label: DIRECTION_LABELS.translation },
];

const fulfilledOptions = [
  { value: true, label: 'Sudah Terpenuhi' },
  { value: false, label: 'Belum Terpenuhi' },
];

/**
 * Search Miss Panel - daftar pencarian user yang 0 hasil (peluang
 * prioritas kontribusi). Semua role login boleh lihat; aksi Dismiss
 * (soft-delete) hanya untuk root/admin/reviewer.
 */
export function SearchMissesPage() {
  const { message } = AntdApp.useApp();
  const { user } = useAuth();
  const canDismiss = user?.role === 'root' || user?.role === 'admin' || user?.role === 'reviewer';

  const [searchInput, setSearchInput] = useState('');
  const [direction, setDirection] = useState<SearchMissDirection | undefined>();
  const [fulfilled, setFulfilled] = useState<boolean | undefined>();
  const q = useDebouncedValue(searchInput, 300);

  const { items, hasMore, loadMore, isLoading, isFetching, isFetchingNextPage, isError, error, refetch } =
    useSearchMissList({ q, direction, fulfilled });

  const dismissSearchMiss = useDismissSearchMiss();

  const onDismiss = async (id: string, term: string) => {
    try {
      await dismissSearchMiss.mutateAsync(id, {
        onSuccess: () => message.success(`Search miss "${term}" di-dismiss`),
        onError: (err) => message.warning(normalizeError(err).message || 'Gagal dismiss search miss'),
      });
    } catch {
      // Handled di atas.
    }
  };

  const columns = useMemo(
    () => [
      columnHelper.accessor('term', {
        header: 'Kata Dicari',
        size: 240,
        meta: { fixed: 'left' },
        cell: (info) => <Typography.Text strong>{info.getValue()}</Typography.Text>,
      }),
      columnHelper.accessor('direction', {
        header: 'Arah',
        size: 140,
        cell: (info) => (
          <Tag color={DIRECTION_TAG_COLOR[info.getValue()]}>{DIRECTION_LABELS[info.getValue()]}</Tag>
        ),
      }),
      columnHelper.accessor('searchCount', {
        header: 'Jumlah Cari',
        size: 130,
        cell: (info) => (
          <Typography.Text strong type={info.getValue() >= 10 ? 'warning' : undefined}>
            {info.getValue()}×
          </Typography.Text>
        ),
      }),
      columnHelper.accessor('fulfilled', {
        header: 'Terpenuhi',
        size: 160,
        cell: (info) =>
          info.getValue() ? (
            <Tag color="green">Sudah Terpenuhi</Tag>
          ) : (
            <Tag color="orange">Belum</Tag>
          ),
      }),
      columnHelper.accessor('createdAt', {
        header: 'Dibuat',
        size: 180,
        meta: { responsive: ['md'] },
        cell: (info) => dayjs(info.getValue()).format('DD MMM YYYY HH:mm'),
      }),
      columnHelper.display({
        id: 'actions',
        header: 'Aksi',
        size: 120,
        meta: { fixed: 'right' },
        cell: (info) =>
          canDismiss ? (
            <Popconfirm
              title="Dismiss search miss ini?"
              description="Aksi tidak bisa dibatalkan. Search miss akan hilang dari daftar."
              okText="Dismiss"
              okButtonProps={{ danger: true }}
              cancelText="Batal"
              onConfirm={() => onDismiss(info.row.original.id, info.row.original.term)}
            >
              <Tooltip title="Dismiss">
                <Button
                  type="link"
                  danger
                  icon={<ToolOutlined />}
                  loading={
                    dismissSearchMiss.isPending &&
                    dismissSearchMiss.variables === info.row.original.id
                  }
                />
              </Tooltip>
            </Popconfirm>
          ) : null,
      }),
    ],
    [canDismiss, onDismiss, dismissSearchMiss.isPending, dismissSearchMiss.variables],
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
        title="Search Miss"
        subtitle="Pencarian pengguna yang tidak ketemu hasil (0 result) — peluang prioritas untuk kontribusi kata."
      />

      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={8}>
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="Cari lemma yang dicari…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </Col>
        <Col xs={24} md={6}>
          <Select
            allowClear
            style={{ width: '100%' }}
            placeholder="Arah terjemah"
            options={directionOptions}
            value={direction}
            onChange={setDirection}
          />
        </Col>
        <Col xs={24} md={6}>
          <Select
            allowClear
            style={{ width: '100%' }}
            placeholder="Status terpenuhi"
            options={fulfilledOptions}
            value={fulfilled}
            onChange={setFulfilled}
          />
        </Col>
        <Col xs={24} md={4}>
          <Flex justify="flex-end" wrap>
            <Button icon={<ReloadOutlined />} onClick={() => refetch()} block={!true}>
              Muat ulang
            </Button>
          </Flex>
        </Col>
      </Row>

      {isError ? (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message="Gagal memuat data"
          description={error ? normalizeError(error).message : undefined}
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
