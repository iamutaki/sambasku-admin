import { useMemo, useState } from 'react';
import { createColumnHelper, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { ReloadOutlined, ToolOutlined } from '@ant-design/icons';
import { Alert, Button, Flex, Select, Tag, Tooltip, Typography } from 'antd';
import dayjs from 'dayjs';
import { useNavigate } from '@tanstack/react-router';
import { DataTable } from '@/shared/components/data-table';
import { PageHeader } from '@/shared/components/page-header';
import { useContributionList } from '../application/use-contribution-list';
import {
  CONTRIBUTION_STATUS_LABELS,
  CONTRIBUTION_STATUSES,
  ENTITY_TYPES,
  ENTITY_TYPE_LABELS,
  type ContributionListItem,
  type ContributionStatus,
  type EntityType,
} from '../domain/contribution';
import { useAuth } from '@/shared/auth/use-auth';

const columnHelper = createColumnHelper<ContributionListItem>();

const STATUS_TAG_COLOR: Record<ContributionStatus, string> = {
  pending: 'orange',
  approved: 'green',
  rejected: 'red',
  corrected: 'blue',
};

export function ContributionsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState<ContributionStatus | undefined>('pending');
  const [entityType, setEntityType] = useState<EntityType | undefined>();

  const { items, hasMore, loadMore, isLoading, isFetching, isFetchingNextPage, isError, error, refetch } =
    useContributionList({ status, entityType, enabled: user?.role === 'reviewer' || user?.role === 'admin' || user?.role === 'root' });

  const columns = useMemo(
    () => [
      columnHelper.accessor('contributor_username', {
        header: 'Kontributor',
        size: 180,
        cell: (info) => <Typography.Text strong>{info.getValue()}</Typography.Text>,
      }),
      columnHelper.accessor('entity_type', {
        header: 'Jenis Konten',
        size: 150,
        meta: { responsive: ['md'] },
        cell: (info) => ENTITY_TYPE_LABELS[info.getValue()] ?? info.getValue(),
      }),
      columnHelper.accessor('action', {
        header: 'Aksi',
        size: 100,
        meta: { responsive: ['lg'] },
      }),
      columnHelper.accessor('status', {
        header: 'Status',
        size: 130,
        cell: (info) => <Tag color={STATUS_TAG_COLOR[info.getValue()]}>{CONTRIBUTION_STATUS_LABELS[info.getValue()]}</Tag>,
      }),
      columnHelper.accessor('created_at', {
        header: 'Dikirim',
        size: 200,
        cell: (info) => dayjs(info.getValue()).format('DD MMM YYYY HH:mm'),
      }),
      columnHelper.display({
        id: 'actions',
        header: 'Aksi',
        size: 80,
        meta: { fixed: 'right' },
        cell: (info) => (
          <Tooltip title="Detail">
            <Button
              type="link"
              icon={<ToolOutlined />}
              onClick={() =>
                navigate({ to: '/contributions/$id', params: { id: info.row.original.id } })
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

  return (
    <>
      <PageHeader
        title="Antrean Review"
        subtitle="Kontribusi yang menunggu keputusan verifikator (approve / reject / correct)."
        extra={
          <Button icon={<ReloadOutlined />} onClick={() => refetch()}>
            Muat ulang
          </Button>
        }
      />
      <Flex wrap gap={12} style={{ marginBottom: 16 }}>
        <Select
          allowClear
          placeholder="Status"
          style={{ width: 180 }}
          options={CONTRIBUTION_STATUSES.map((s) => ({ value: s, label: CONTRIBUTION_STATUS_LABELS[s] }))}
          value={status}
          onChange={setStatus}
        />
        <Select
          allowClear
          placeholder="Jenis konten"
          style={{ width: 200 }}
          options={ENTITY_TYPES.map((t) => ({ value: t, label: ENTITY_TYPE_LABELS[t] }))}
          value={entityType}
          onChange={setEntityType}
        />
      </Flex>

      {isError ? <Alert type="error" showIcon style={{ marginBottom: 16 }} message="Gagal memuat data" description={error?.message} /> : null}

      <DataTable table={table} rowKey={(record) => String(record.id)} loading={isLoading || (isFetching && !items.length)} />

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