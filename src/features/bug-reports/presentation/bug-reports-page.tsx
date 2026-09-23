import { useMemo, useState } from 'react';
import { createColumnHelper, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { CheckOutlined, CloseOutlined, ReloadOutlined } from '@ant-design/icons';
import { Alert, App as AntdApp, Button, Flex, Image, Input, Modal, Space, Tabs, Tag, Tooltip, Typography } from 'antd';
import { formatDateTime } from '@/shared/utils/format-datetime';
import { DataTable } from '@/shared/components/data-table';
import { PageHeader } from '@/shared/components/page-header';
import { UserInfoLink } from '@/shared/components/user-info-modal';
import { useAuth } from '@/shared/auth/use-auth';
import { normalizeError } from '@/shared/api/error';
import { useBugReportList } from '../application/use-bug-report-list';
import { useResolveBugReport } from '../application/use-resolve-bug-report';
import {
  BUG_REPORT_STATUS_LABELS,
  BUG_REPORT_STATUS_TAG_COLOR,
  platformLabel,
  type BugReportListItem,
  type BugReportStatus,
} from '../domain/bug-report';

const columnHelper = createColumnHelper<BugReportListItem>();

type StatusTab = BugReportStatus | 'all';

const STATUS_TABS: { key: StatusTab; label: string; status?: BugReportStatus }[] = [
  { key: 'open', label: BUG_REPORT_STATUS_LABELS.open, status: 'open' },
  { key: 'resolved', label: BUG_REPORT_STATUS_LABELS.resolved, status: 'resolved' },
  { key: 'rejected', label: BUG_REPORT_STATUS_LABELS.rejected, status: 'rejected' },
  { key: 'all', label: 'Semua' },
];

export function BugReportsPage() {
  const { user } = useAuth();
  const canManage = user?.role === 'admin' || user?.role === 'root';
  const { message } = AntdApp.useApp();
  const [statusTab, setStatusTab] = useState<StatusTab>('open');
  const status = STATUS_TABS.find((t) => t.key === statusTab)?.status;
  const [decision, setDecision] = useState<{
    item: BugReportListItem;
    status: Exclude<BugReportStatus, 'open'>;
  } | null>(null);
  const [note, setNote] = useState('');

  const { items, hasMore, loadMore, isLoading, isFetching, isFetchingNextPage, isError, error, refetch } =
    useBugReportList({ status, enabled: canManage });
  const resolveMutation = useResolveBugReport();

  const closeDecision = () => {
    setDecision(null);
    setNote('');
  };

  const submitDecision = async () => {
    if (!decision) return;
    try {
      await resolveMutation.mutateAsync({
        id: decision.item.id,
        status: decision.status,
        note: note.trim() || undefined,
      });
      message.success(decision.status === 'resolved' ? 'Laporan diselesaikan' : 'Laporan ditolak');
      closeDecision();
    } catch (err) {
      message.warning(normalizeError(err).message || 'Gagal memperbarui laporan');
    }
  };

  const columns = useMemo(
    () => [
      columnHelper.accessor('description', {
        header: 'Keterangan',
        size: 280,
        cell: (info) => (
          <Typography.Paragraph ellipsis={{ rows: 2 }} style={{ margin: 0 }}>
            {info.getValue()}
          </Typography.Paragraph>
        ),
      }),
      columnHelper.accessor('status', {
        header: 'Status',
        size: 110,
        cell: (info) => (
          <Tag color={BUG_REPORT_STATUS_TAG_COLOR[info.getValue()]}>
            {BUG_REPORT_STATUS_LABELS[info.getValue()]}
          </Tag>
        ),
      }),
      columnHelper.accessor('username', {
        header: 'Pelapor',
        size: 140,
        cell: (info) => {
          const name = info.getValue();
          return name ? <UserInfoLink username={name} /> : <Typography.Text type="secondary">Anonim</Typography.Text>;
        },
      }),
      columnHelper.display({
        id: 'platform',
        header: 'Platform',
        size: 130,
        meta: { responsive: ['lg'] },
        cell: (info) => (
          <Typography.Text type="secondary">{platformLabel(info.row.original)}</Typography.Text>
        ),
      }),
      columnHelper.accessor('images', {
        header: 'Lampiran',
        size: 140,
        cell: (info) => {
          const images = info.getValue();
          if (!images.length) return <Typography.Text type="secondary">-</Typography.Text>;
          return (
            <Image.PreviewGroup>
              <Space size={4} wrap>
                {images.map((img) => (
                  <Image
                    key={img.provider_file_id}
                    src={img.url}
                    alt=""
                    width={36}
                    height={36}
                    style={{ objectFit: 'cover', borderRadius: 4 }}
                  />
                ))}
              </Space>
            </Image.PreviewGroup>
          );
        },
      }),
      columnHelper.accessor('created_at', {
        header: 'Waktu',
        size: 160,
        cell: (info) => formatDateTime(info.getValue()),
      }),
      columnHelper.display({
        id: 'actions',
        header: 'Aksi',
        size: 120,
        meta: { fixed: 'right' },
        cell: (info) => {
          if (info.row.original.status !== 'open') return null;
          return (
            <Space size={0}>
              <Tooltip title="Selesaikan">
                <Button
                  type="link"
                  icon={<CheckOutlined />}
                  onClick={() => setDecision({ item: info.row.original, status: 'resolved' })}
                />
              </Tooltip>
              <Tooltip title="Tolak">
                <Button
                  type="link"
                  danger
                  icon={<CloseOutlined />}
                  onClick={() => setDecision({ item: info.row.original, status: 'rejected' })}
                />
              </Tooltip>
            </Space>
          );
        },
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

  if (!canManage) {
    return <Alert type="warning" showIcon message="Hanya admin dan root yang dapat melihat laporan masalah." />;
  }

  return (
    <>
      <PageHeader
        title="Laporan Masalah"
        subtitle="Antrean laporan dari aplikasi. Tamu dan akun login."
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
      <Modal
        title={decision?.status === 'resolved' ? 'Selesaikan laporan' : 'Tolak laporan'}
        open={!!decision}
        onCancel={closeDecision}
        onOk={() => void submitDecision()}
        confirmLoading={resolveMutation.isPending}
        okText={decision?.status === 'resolved' ? 'Selesaikan' : 'Tolak'}
        okButtonProps={{ danger: decision?.status === 'rejected' }}
      >
        <Typography.Paragraph type="secondary">{decision?.item.description}</Typography.Paragraph>
        <Input.TextArea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Catatan opsional"
          rows={3}
          maxLength={2000}
        />
      </Modal>
    </>
  );
}
