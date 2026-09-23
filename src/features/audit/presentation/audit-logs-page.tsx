import { useMemo, useState } from 'react';
import { createColumnHelper, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { FilterOutlined, ReloadOutlined } from '@ant-design/icons';
import { Alert, Button, DatePicker, Flex, Input, Result, Select, Tag, Typography } from 'antd';
import type { Dayjs } from 'dayjs';
import { formatDateTimeSeconds } from '@/shared/utils/format-datetime';
import { DataTable } from '@/shared/components/data-table';
import { PageHeader } from '@/shared/components/page-header';
import { useAuth } from '@/shared/auth/use-auth';
import { useAuditLogList } from '../application/use-audit-log-list';
import { AUDIT_ACTIONS, AUDIT_ACTION_TAG_COLOR, type AuditLogListItem } from '../domain/audit-log';
import { AuditChangesCell } from './audit-changes-cell';

const columnHelper = createColumnHelper<AuditLogListItem>();

/** ULID dipersingkat untuk tampilan (tetap unik sampai prefix 8 char). */
function shortUlid(id: string | null): string {
  if (!id) return '-';
  return id.slice(0, 8) + '…';
}

interface AuditFilters {
  from?: string;
  to?: string;
  userName?: string;
  action?: string;
}

/**
 * Halaman Audit Log (role: admin & root) - jejak mutasi data secara
 * kronologis terbaru dulu (id DESC). Filter: rentang tanggal, username
 * pelaku (partial), aksi. `new_data`/`old_data` diringkas jadi daftar
 * field yang berubah (`AuditChangesCell`); klik baris untuk JSON rapi.
 */
export function AuditLogsPage() {
  const { user } = useAuth();
  const canAudit = user?.role === 'admin' || user?.role === 'root';

  // Draft = nilai di form; applied = filter yang memicu fetch (queryKey).
  // Ubah filter = key baru = list baru dari halaman 1 (use-cursor-list).
  const [draftRange, setDraftRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const [draftUserName, setDraftUserName] = useState('');
  const [draftAction, setDraftAction] = useState<string | undefined>(undefined);
  const [filters, setFilters] = useState<AuditFilters>({});

  const { items, hasMore, loadMore, isLoading, isFetching, isFetchingNextPage, isError, error, refetch } =
    useAuditLogList({ filters, enabled: canAudit });

  const hasActiveFilter = Boolean(filters.from || filters.to || filters.userName || filters.action);

  const applyFilters = () => {
    const [from, to] = draftRange ?? [null, null];
    setFilters({
      from: from ? from.startOf('day').toISOString() : undefined,
      to: to ? to.endOf('day').toISOString() : undefined,
      userName: draftUserName.trim() || undefined,
      action: draftAction,
    });
  };

  const resetFilters = () => {
    setDraftRange(null);
    setDraftUserName('');
    setDraftAction(undefined);
    setFilters({});
  };

  const columns = useMemo(
    () => [
      columnHelper.accessor('created_at', {
        header: 'Waktu',
        size: 180,
        cell: (info) => formatDateTimeSeconds(info.getValue()),
      }),
      columnHelper.accessor('action', {
        header: 'Aksi',
        size: 160,
        cell: (info) => <Tag color={AUDIT_ACTION_TAG_COLOR[info.getValue()] ?? 'default'}>{info.getValue()}</Tag>,
      }),
      columnHelper.accessor('entity_type', {
        header: 'Entitas',
        size: 120,
        cell: (info) => <Typography.Text code>{info.getValue()}</Typography.Text>,
      }),
      columnHelper.accessor('entity_id', {
        header: 'ID Entitas',
        size: 120,
        meta: { responsive: ['lg'] },
        cell: (info) => <Typography.Text type="secondary">{shortUlid(info.getValue())}</Typography.Text>,
      }),
      columnHelper.accessor('user_name', {
        header: 'Pelaku',
        size: 140,
        meta: { responsive: ['lg'] },
        cell: (info) => {
          const name = info.getValue();
          return name ? (
            <Typography.Text strong>{name}</Typography.Text>
          ) : (
            <Typography.Text type="secondary">{shortUlid(info.row.original.user_id)}</Typography.Text>
          );
        },
      }),
      columnHelper.display({
        id: 'changes',
        header: 'Perubahan',
        cell: (info) => <AuditChangesCell oldData={info.row.original.old_data} newData={info.row.original.new_data} />,
      }),
    ],
    [],
  );

  const table = useReactTable({
    data: items,
    columns,
    getRowId: (row) => String(row.id),
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
  });

  if (!canAudit) {
    return (
      <Result
        status="403"
        title="Akses ditolak"
        subTitle="Halaman audit log hanya untuk role admin dan root."
        extra={
          <Button icon={<ReloadOutlined />} onClick={() => refetch()}>
            Muat ulang
          </Button>
        }
      />
    );
  }

  return (
    <>
      <PageHeader
        title="Audit Log"
        subtitle="Jejak mutasi data (create / update / delete / approve / reject / …) - hanya admin & root."
        extra={
          <Button icon={<ReloadOutlined />} onClick={() => refetch()}>
            Muat ulang
          </Button>
        }
      />

      <Flex wrap gap={12} align="center" style={{ marginBottom: 16 }}>
        <DatePicker.RangePicker
          value={draftRange}
          onChange={(range) => setDraftRange(range as [Dayjs | null, Dayjs | null] | null)}
          style={{ width: 280 }}
          placeholder={['Tanggal awal', 'Tanggal akhir']}
        />
        <Input.Search
          placeholder="Username pelaku…"
          value={draftUserName}
          onChange={(e) => setDraftUserName(e.target.value)}
          onSearch={() => applyFilters()}
          allowClear
          style={{ width: 210 }}
        />
        <Select
          placeholder="Semua aksi"
          value={draftAction}
          onChange={setDraftAction}
          allowClear
          options={AUDIT_ACTIONS.map((a) => ({ value: a, label: a }))}
          style={{ width: 190 }}
        />
        <Button type="primary" icon={<FilterOutlined />} onClick={applyFilters}>
          Terapkan
        </Button>
        <Button onClick={resetFilters} disabled={!hasActiveFilter} danger>
          Reset
        </Button>
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