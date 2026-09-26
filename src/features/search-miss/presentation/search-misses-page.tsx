import { useCallback, useMemo, useState } from 'react';
import type { Key } from 'react';
import { createColumnHelper, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import {
  LinkOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  ToolOutlined,
} from '@ant-design/icons';
import {
  Alert,
  App as AntdApp,
  Button,
  Col,
  Flex,
  Input,
  Popconfirm,
  Row,
  Select,
  Space,
  Switch,
  Tabs,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import { formatDateTime } from '@/shared/utils/format-datetime';
import { useNavigate } from '@tanstack/react-router';
import { DataTable } from '@/shared/components/data-table';
import { PageHeader } from '@/shared/components/page-header';
import { useAuth } from '@/shared/auth/use-auth';
import { normalizeError } from '@/shared/api/error';
import { useDebouncedValue } from '@/shared/hooks/use-debounced-value';
import { useSearchMissList } from '../application/use-search-miss-list';
import { useDismissSearchMiss } from '../application/use-dismiss-search-miss';
import { useBulkDismissSearchMiss } from '../application/use-bulk-dismiss-search-miss';
import { useUpdateSearchMiss } from '../application/use-update-search-miss';
import {
  DIRECTION_LABELS,
  DIRECTION_TAG_COLOR,
  type SearchMissDirection,
  type SearchMissListItem,
} from '../domain/search-miss';
import { ResolveSearchMissModal } from './resolve-search-miss-modal';

const columnHelper = createColumnHelper<SearchMissListItem>();

const directionOptions: { value: SearchMissDirection; label: string }[] = [
  { value: 'lemma', label: DIRECTION_LABELS.lemma },
  { value: 'translation', label: DIRECTION_LABELS.translation },
];

const visibleOptions = [
  { value: true, label: 'Tayang' },
  { value: false, label: 'Tidak tayang' },
];

/** Tab antrean admin: belum terpenuhi dulu (kerja utama). */
type FulfilledTab = 'pending' | 'done' | 'all';

const FULFILLED_TABS: { key: FulfilledTab; label: string; fulfilled?: boolean }[] = [
  { key: 'pending', label: 'Belum Terpenuhi', fulfilled: false },
  { key: 'done', label: 'Terpenuhi', fulfilled: true },
  { key: 'all', label: 'Semua' },
];

/**
 * Search Miss Panel - daftar pencarian user yang 0 hasil (peluang
 * prioritas kontribusi). Semua role login boleh lihat; koreksi term +
 * tayang + resolve hanya admin/root; dismiss soft-delete root/admin/reviewer.
 * Tabs: Belum Terpenuhi (default) | Terpenuhi | Semua.
 */
export function SearchMissesPage() {
  const navigate = useNavigate();
  const { message } = AntdApp.useApp();
  const { user } = useAuth();
  const canEdit = user?.role === 'root' || user?.role === 'admin';
  const canDismiss = canEdit || user?.role === 'reviewer';

  const [searchInput, setSearchInput] = useState('');
  const [direction, setDirection] = useState<SearchMissDirection | undefined>();
  const [visible, setVisible] = useState<boolean | undefined>();
  const [fulfilledTab, setFulfilledTab] = useState<FulfilledTab>('pending');
  const [resolveMiss, setResolveMiss] = useState<SearchMissListItem | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([]);
  const q = useDebouncedValue(searchInput, 300);
  const fulfilled = FULFILLED_TABS.find((t) => t.key === fulfilledTab)?.fulfilled;

  const { items, hasMore, loadMore, isLoading, isFetching, isFetchingNextPage, isError, error, refetch } =
    useSearchMissList({ q, direction, fulfilled, visible });

  const dismissSearchMiss = useDismissSearchMiss();
  const bulkDismissSearchMiss = useBulkDismissSearchMiss();
  const updateSearchMiss = useUpdateSearchMiss();

  const clearSelection = useCallback(() => setSelectedRowKeys([]), []);

  const onDismiss = useCallback(
    async (id: string, term: string) => {
      try {
        await dismissSearchMiss.mutateAsync(id, {
          onSuccess: () => {
            message.success(`"${term}" dihapus dari antrian`);
            setSelectedRowKeys((keys) => keys.filter((k) => String(k) !== id));
          },
          onError: (err) =>
            message.warning(normalizeError(err).message || 'Gagal menghapus dari antrian'),
        });
      } catch {
        // Handled di atas.
      }
    },
    [dismissSearchMiss, message],
  );

  const onBulkDismiss = async () => {
    const ids = selectedRowKeys.map(String);
    if (ids.length === 0) return;
    try {
      const data = await bulkDismissSearchMiss.mutateAsync(ids);
      if (data.failed === 0) {
        message.success(`${data.succeeded} pencarian dihapus dari antrian`);
      } else {
        message.warning(
          `${data.succeeded} berhasil, ${data.failed} gagal. Periksa entri yang sudah hilang.`,
        );
      }
      clearSelection();
    } catch (err) {
      message.error(normalizeError(err).message || 'Gagal dismiss massal');
    }
  };

  const onSaveTerm = useCallback(
    async (id: string, nextTerm: string) => {
      const trimmed = nextTerm.trim();
      if (!trimmed) {
        message.warning('Kata dicari tidak boleh kosong');
        return;
      }
      try {
        await updateSearchMiss.mutateAsync(
          { id, body: { term: trimmed } },
          {
            onSuccess: () => message.success('Kata dicari diperbarui'),
            onError: (err) =>
              message.warning(normalizeError(err).message || 'Gagal memperbarui kata dicari'),
          },
        );
      } catch {
        // Handled di atas.
      }
    },
    [message, updateSearchMiss],
  );

  const onToggleVisible = useCallback(
    async (id: string, term: string, next: boolean) => {
      try {
        await updateSearchMiss.mutateAsync(
          { id, body: { isVisible: next } },
          {
            onSuccess: () =>
              message.success(next ? `"${term}" ditayangkan di beranda` : `"${term}" disembunyikan dari beranda`),
            onError: (err) =>
              message.warning(normalizeError(err).message || 'Gagal mengubah status tayang'),
          },
        );
      } catch {
        // Handled di atas.
      }
    },
    [message, updateSearchMiss],
  );

  const onCreateWord = useCallback(
    (row: SearchMissListItem) => {
      navigate({
        to: '/words/new',
        search: {
          from_miss: row.id,
          term: row.term,
          direction: row.direction,
        },
      });
    },
    [navigate],
  );

  const updatingId =
    updateSearchMiss.isPending && updateSearchMiss.variables
      ? updateSearchMiss.variables.id
      : null;

  const bulkBusy = bulkDismissSearchMiss.isPending;
  const selectedCount = selectedRowKeys.length;

  const columns = useMemo(
    () => [
      columnHelper.accessor('term', {
        header: 'Kata Dicari',
        size: 240,
        meta: { fixed: 'left' },
        cell: (info) => {
          const row = info.row.original;
          if (!canEdit) {
            return <Typography.Text strong>{info.getValue()}</Typography.Text>;
          }
          return (
            <Typography.Text
              strong
              editable={{
                triggerType: ['icon', 'text'],
                onChange: (next) => {
                  if (next.trim() === row.term) return;
                  void onSaveTerm(row.id, next);
                },
              }}
            >
              {info.getValue()}
            </Typography.Text>
          );
        },
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
      columnHelper.accessor('isVisible', {
        header: 'Tayang',
        size: 100,
        cell: (info) => {
          const row = info.row.original;
          const checked = info.getValue();
          if (!canEdit) {
            return <Switch checked={checked} disabled size="small" />;
          }
          return (
            <Switch
              checked={checked}
              size="small"
              loading={updatingId === row.id}
              onChange={(next) => void onToggleVisible(row.id, row.term, next)}
            />
          );
        },
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
        cell: (info) => formatDateTime(info.getValue()),
      }),
      columnHelper.display({
        id: 'actions',
        header: 'Aksi',
        size: 200,
        meta: { fixed: 'right' },
        cell: (info) => {
          const row = info.row.original;
          return (
            <Space size={0}>
              {!row.fulfilled ? (
                <>
                  <Tooltip title="Buat kata">
                    <Button type="link" icon={<PlusOutlined />} onClick={() => onCreateWord(row)} />
                  </Tooltip>
                  {canEdit ? (
                    <Tooltip title="Selesaikan ke kata existing (varian / sinonim / terjemahan)">
                      <Button
                        type="link"
                        icon={<LinkOutlined />}
                        onClick={() => setResolveMiss(row)}
                      />
                    </Tooltip>
                  ) : null}
                </>
              ) : null}
              {canDismiss ? (
                <Popconfirm
                  title="Hapus dari antrian?"
                  description="Aksi tidak bisa dibatalkan. Item ini akan hilang dari daftar."
                  okText="Dismiss"
                  okButtonProps={{ danger: true }}
                  cancelText="Batal"
                  onConfirm={() => onDismiss(row.id, row.term)}
                >
                  <Tooltip title="Dismiss">
                    <Button
                      type="link"
                      danger
                      icon={<ToolOutlined />}
                      loading={
                        dismissSearchMiss.isPending && dismissSearchMiss.variables === row.id
                      }
                      disabled={bulkBusy}
                    />
                  </Tooltip>
                </Popconfirm>
              ) : null}
            </Space>
          );
        },
      }),
    ],
    [
      canDismiss,
      canEdit,
      onDismiss,
      onCreateWord,
      onSaveTerm,
      onToggleVisible,
      dismissSearchMiss.isPending,
      dismissSearchMiss.variables,
      updatingId,
      bulkBusy,
    ],
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
        title="Pencarian"
        subtitle="Antrean kata yang dicari user tapi belum ada di kamus. Buat kata baru, atau selesaikan ke kata existing (varian / sinonim / terjemahan)."
        extra={
          <Button icon={<ReloadOutlined />} onClick={() => refetch()}>
            Muat ulang
          </Button>
        }
      />

      <Tabs
        activeKey={fulfilledTab}
        onChange={(key) => setFulfilledTab(key as FulfilledTab)}
        items={FULFILLED_TABS.map((t) => ({ key: t.key, label: t.label }))}
        style={{ marginBottom: 8 }}
      />

      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={10}>
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="Cari lemma yang dicari…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </Col>
        <Col xs={24} md={7}>
          <Select
            allowClear
            style={{ width: '100%' }}
            placeholder="Arah terjemah"
            options={directionOptions}
            value={direction}
            onChange={setDirection}
          />
        </Col>
        <Col xs={24} md={7}>
          <Select
            allowClear
            style={{ width: '100%' }}
            placeholder="Tayang di beranda"
            options={visibleOptions}
            value={visible}
            onChange={setVisible}
          />
        </Col>
      </Row>

      {canDismiss && selectedCount > 0 ? (
        <Flex
          wrap
          gap={12}
          align="center"
          style={{
            marginBottom: 12,
            padding: '8px 12px',
            background: 'var(--ant-color-fill-alter, #fafafa)',
            borderRadius: 8,
          }}
        >
          <Typography.Text>{selectedCount} dipilih</Typography.Text>
          <Space wrap>
            <Popconfirm
              title={`Dismiss ${selectedCount} pencarian?`}
              description="Soft-delete: hilang dari antrian & beranda; jejak tetap untuk audit."
              okText="Dismiss"
              okButtonProps={{ danger: true }}
              cancelText="Batal"
              onConfirm={() => void onBulkDismiss()}
            >
              <Button danger icon={<ToolOutlined />} loading={bulkBusy} disabled={bulkBusy}>
                Dismiss
              </Button>
            </Popconfirm>
            <Button type="link" onClick={clearSelection} disabled={bulkBusy}>
              Batal pilih
            </Button>
          </Space>
        </Flex>
      ) : null}

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
        loading={isLoading || (isFetching && !items.length) || bulkBusy}
        rowSelection={
          canDismiss
            ? {
                selectedRowKeys,
                onChange: (keys) => setSelectedRowKeys(keys),
                preserveSelectedRowKeys: true,
              }
            : undefined
        }
      />

      <Flex justify="center" align="center" gap={16} style={{ marginTop: 16 }}>
        <Typography.Text type="secondary">{items.length} entri dimuat</Typography.Text>
        {hasMore ? (
          <Button onClick={() => loadMore()} loading={isFetchingNextPage}>
            Muat lagi
          </Button>
        ) : null}
      </Flex>

      <ResolveSearchMissModal
        open={resolveMiss !== null}
        miss={resolveMiss}
        onClose={() => setResolveMiss(null)}
      />
    </>
  );
}
