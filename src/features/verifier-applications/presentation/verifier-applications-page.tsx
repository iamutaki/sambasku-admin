import { useMemo, useState } from 'react';
import { createColumnHelper, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { ReloadOutlined, ToolOutlined } from '@ant-design/icons';
import { Alert, Button, Flex, Tabs, Tag, Tooltip, Typography } from 'antd';
import { formatDateTime } from '@/shared/utils/format-datetime';
import { useNavigate } from '@tanstack/react-router';
import { DataTable } from '@/shared/components/data-table';
import { PageHeader } from '@/shared/components/page-header';
import { UserInfoLink } from '@/shared/components/user-info-modal';
import { useAuth } from '@/shared/auth/use-auth';
import { useVerifierApplicationList } from '../application/use-verifier-application-list';
import {
  VERIFIER_APPLICATION_STATUS_LABELS,
  type VerifierApplicationListItem,
  type VerifierApplicationStatus,
} from '../domain/verifier-application';

const columnHelper = createColumnHelper<VerifierApplicationListItem>();

const STATUS_TAG_COLOR: Record<VerifierApplicationStatus, string> = {
  pending: 'orange',
  approved: 'green',
  rejected: 'red',
};

type StatusTab = VerifierApplicationStatus | 'all';

const STATUS_TABS: { key: StatusTab; label: string; status?: VerifierApplicationStatus }[] = [
  { key: 'pending', label: VERIFIER_APPLICATION_STATUS_LABELS.pending, status: 'pending' },
  { key: 'approved', label: VERIFIER_APPLICATION_STATUS_LABELS.approved, status: 'approved' },
  { key: 'rejected', label: VERIFIER_APPLICATION_STATUS_LABELS.rejected, status: 'rejected' },
  { key: 'all', label: 'Semua' },
];

export function VerifierApplicationsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const canManage = user?.role === 'admin' || user?.role === 'root';
  const [statusTab, setStatusTab] = useState<StatusTab>('pending');
  const status = STATUS_TABS.find((t) => t.key === statusTab)?.status;

  const { items, hasMore, loadMore, isLoading, isFetching, isFetchingNextPage, isError, error, refetch } =
    useVerifierApplicationList({ status, enabled: canManage });

  const columns = useMemo(
    () => [
      columnHelper.accessor('username', {
        header: 'Username',
        size: 180,
        cell: (info) => <UserInfoLink username={info.getValue()} />,
      }),
      columnHelper.accessor('phone', {
        header: 'HP',
        size: 160,
      }),
      columnHelper.accessor('status', {
        header: 'Status',
        size: 130,
        cell: (info) => (
          <Tag color={STATUS_TAG_COLOR[info.getValue()]}>
            {VERIFIER_APPLICATION_STATUS_LABELS[info.getValue()]}
          </Tag>
        ),
      }),
      columnHelper.accessor('created_at', {
        header: 'Diajukan',
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
                navigate({ to: '/verifier-applications/$id', params: { id: info.row.original.id } })
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

  if (!canManage) {
    return <Alert type="warning" showIcon message="Hanya admin dan root yang dapat meninjau pengajuan verifikator." />;
  }

  return (
    <>
      <PageHeader
        title="Pengajuan verifikator"
        subtitle="Antrean kontributor yang mengajukan jadi verifikator."
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
        <Alert type="error" showIcon style={{ marginBottom: 16 }} message="Gagal memuat data" description={error?.message} />
      ) : null}
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
