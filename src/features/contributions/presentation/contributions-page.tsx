import { useMemo, useState } from 'react';
import { createColumnHelper, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { ReloadOutlined, ToolOutlined } from '@ant-design/icons';
import { Alert, Button, Flex, Select, Tabs, Tag, Tooltip, Typography } from 'antd';
import { formatDateTime } from '@/shared/utils/format-datetime';
import { useNavigate } from '@tanstack/react-router';
import { DataTable } from '@/shared/components/data-table';
import { PageHeader } from '@/shared/components/page-header';
import { useContributionList } from '../application/use-contribution-list';
import {
  CONTRIBUTION_STATUS_LABELS,
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

/** Tabs antrean review (default: Menunggu). */
type StatusTab = ContributionStatus | 'all';

const STATUS_TABS: { key: StatusTab; label: string; status?: ContributionStatus }[] = [
  { key: 'pending', label: CONTRIBUTION_STATUS_LABELS.pending, status: 'pending' },
  { key: 'approved', label: CONTRIBUTION_STATUS_LABELS.approved, status: 'approved' },
  { key: 'rejected', label: CONTRIBUTION_STATUS_LABELS.rejected, status: 'rejected' },
  { key: 'corrected', label: CONTRIBUTION_STATUS_LABELS.corrected, status: 'corrected' },
  { key: 'all', label: 'Semua' },
];

export function ContributionsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [statusTab, setStatusTab] = useState<StatusTab>('pending');
  const [entityType, setEntityType] = useState<EntityType | undefined>();
  const status = STATUS_TABS.find((t) => t.key === statusTab)?.status;

  const { items, hasMore, loadMore, isLoading, isFetching, isFetchingNextPage, isError, error, refetch } =
    useContributionList({ status, entityType, enabled: user?.role === 'reviewer' || user?.role === 'admin' || user?.role === 'root' });

  const columns = useMemo(
    () => [
      columnHelper.accessor('word_lemma', {
        header: 'Kata',
        size: 180,
        cell: (info) => {
          const lemma = info.getValue();
          return lemma ? (
            <Typography.Text strong>{lemma}</Typography.Text>
          ) : (
            <Typography.Text type="secondary">—</Typography.Text>
          );
        },
      }),
      columnHelper.accessor('contributor_username', {
        header: 'Kontributor',
        size: 160,
        cell: (info) => <Typography.Text>{info.getValue()}</Typography.Text>,
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
      columnHelper.display({
        id: 'search_miss',
        header: 'Sumber',
        size: 160,
        meta: { responsive: ['md'] },
        cell: (info) => {
          const term = info.row.original.search_miss_term;
          if (!info.row.original.search_miss_id || !term) return '-';
          return <Tag color="purple">Pencarian: {term}</Tag>;
        },
      }),
      columnHelper.accessor('created_at', {
        header: 'Dikirim',
        size: 200,
        cell: (info) => formatDateTime(info.getValue()),
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
      <Tabs
        activeKey={statusTab}
        onChange={(key) => setStatusTab(key as StatusTab)}
        items={STATUS_TABS.map((t) => ({ key: t.key, label: t.label }))}
        style={{ marginBottom: 8 }}
      />
      <Flex wrap gap={12} style={{ marginBottom: 16 }}>
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