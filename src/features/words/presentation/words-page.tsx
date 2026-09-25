import { useCallback, useMemo, useState } from 'react';
import { createColumnHelper, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import {
  CheckOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  HistoryOutlined,
  PlusOutlined,
  ReloadOutlined,
  StopOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import {
  Alert,
  App as AntdApp,
  Button,
  Flex,
  Input,
  Popconfirm,
  Select,
  Space,
  Switch,
  Tabs,
  Tooltip,
  Typography,
} from 'antd';
import type { Key } from 'react';
import { DataTable } from '@/shared/components/data-table';
import { PageHeader } from '@/shared/components/page-header';
import { useNavigate } from '@tanstack/react-router';
import { useWordList, type UseWordListArgs } from '../application/use-word-list';
import { useAuth } from '@/shared/auth/use-auth';
import { useDeleteWord } from '../application/use-delete-word';
import { useVerifyWord, useUnverifyWord } from '../application/use-word-verify';
import { usePublishWord, useUnpublishWord } from '../application/use-word-publish';
import { useBulkWordsAction } from '../application/use-bulk-words-action';
import { normalizeError } from '@/shared/api/error';
import type { BulkWordsAction } from '../infrastructure/word-api';
import {
  WORD_TYPES,
  WORD_TYPE_LABELS,
  type WordListItem,
  type WordType,
} from '../domain/word';
import { useDebouncedValue } from '@/shared/hooks/use-debounced-value';
import { ImportWordsDrawer } from './import-words-drawer';
import { WordDuplicatesPanel } from './word-duplicates-panel';
import { WordCommaSplitsPanel } from './word-comma-splits-panel';
import { useDuplicateWordGroups } from '../application/use-duplicate-words';
import { useCommaSplits } from '../application/use-comma-splits';

const columnHelper = createColumnHelper<WordListItem>();

const wordTypeOptions = WORD_TYPES.map((type) => ({ value: type, label: WORD_TYPE_LABELS[type] }));

/** Tabs tayang di menu Kata. Duplikasi & Pemisahan = panel terpisah. */
type WordsTab = 'published' | 'unpublished' | 'all' | 'duplicates' | 'comma_splits';

const LIST_TABS: { key: Exclude<WordsTab, 'duplicates' | 'comma_splits'>; label: string; published?: boolean }[] = [
  { key: 'published', label: 'Tayang', published: true },
  { key: 'unpublished', label: 'Tidak tayang', published: false },
  { key: 'all', label: 'Semua' },
];

export function WordsPage() {
  const { message } = AntdApp.useApp();
  const navigate = useNavigate();
  const { user } = useAuth();
  const deleteWord = useDeleteWord();
  const verifyWord = useVerifyWord();
  const unverifyWord = useUnverifyWord();
  const publishWord = usePublishWord();
  const unpublishWord = useUnpublishWord();
  const bulkWords = useBulkWordsAction();
  const canVerify = user?.role === 'root' || user?.role === 'admin' || user?.role === 'reviewer';
  const canImport = canVerify || user?.role === 'editor';
  const canBulkSelect = user?.role !== 'contributor';
  const canBulkDelete = canBulkSelect;
  const [importOpen, setImportOpen] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [wordType, setWordType] = useState<WordType | undefined>();
  const [isVerified, setIsVerified] = useState<boolean | undefined>();
  const [activeTab, setActiveTab] = useState<WordsTab>('published');
  const [deletingId, setDeletingId] = useState<string | undefined>();
  const [publishingId, setPublishingId] = useState<string | undefined>();
  const [verifyingId, setVerifyingId] = useState<string | undefined>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([]);
  const q = useDebouncedValue(searchInput, 300);
  const isDuplicatesTab = activeTab === 'duplicates';
  const isCommaSplitsTab = activeTab === 'comma_splits';
  const isSpecialTab = isDuplicatesTab || isCommaSplitsTab;
  const published = LIST_TABS.find((t) => t.key === activeTab)?.published;
  const duplicatesQuery = useDuplicateWordGroups(true);
  const duplicateCount = duplicatesQuery.data?.total_groups;
  const commaSplitsQuery = useCommaSplits(true);
  const commaSplitCount = commaSplitsQuery.data?.total;

  const listArgs: UseWordListArgs = { q, wordType, isVerified, published, enabled: !isSpecialTab };
  const { items, hasMore, loadMore, isLoading, isFetching, isFetchingNextPage, isError, error, refetch } =
    useWordList(listArgs);

  const onDeleteWord = async (id: string, lemma: string) => {
    setDeletingId(id);
    try {
      await deleteWord.mutateAsync(id, {
        onSuccess: () => message.success(`Kata "${lemma}" dihapus`),
        onError: (err) => message.error(err.message ?? 'Gagal menghapus kata'),
      });
    } finally {
      setDeletingId(undefined);
    }
  };

  const onToggleVerified = async (id: string, lemma: string, next: boolean) => {
    setVerifyingId(id);
    try {
      if (next) {
        await verifyWord.mutateAsync(id, {
          onSuccess: () => message.success(`Kata "${lemma}" diverifikasi`),
          onError: (err) => message.warning(normalizeError(err).message || 'Gagal verifikasi kata'),
        });
      } else {
        await unverifyWord.mutateAsync(id, {
          onSuccess: () => message.success(`Kata "${lemma}" batal diverifikasi`),
          onError: (err) => message.warning(normalizeError(err).message || 'Gagal membatalkan verifikasi'),
        });
      }
    } catch {
      // Handled.
    } finally {
      setVerifyingId(undefined);
    }
  };

  const onTogglePublished = async (id: string, lemma: string, next: boolean) => {
    setPublishingId(id);
    try {
      if (next) {
        await publishWord.mutateAsync(id, {
          onSuccess: (data) => {
            if (data?.merged_into_word_id) {
              message.success(`Makna "${lemma}" digabung ke kata yang sudah tayang`);
            } else {
              message.success(`Kata "${lemma}" ditayangkan`);
            }
          },
          onError: (err) => message.warning(normalizeError(err).message || 'Gagal menayangkan'),
        });
      } else {
        await unpublishWord.mutateAsync(id, {
          onSuccess: () => message.success(`Kata "${lemma}" ditarik dari tayang`),
          onError: (err) => message.warning(normalizeError(err).message || 'Gagal menarik tayang'),
        });
      }
    } catch {
      // Handled.
    } finally {
      setPublishingId(undefined);
    }
  };

  const clearSelection = useCallback(() => setSelectedRowKeys([]), []);

  const onBulkAction = async (action: BulkWordsAction) => {
    const ids = selectedRowKeys.map(String);
    if (ids.length === 0) return;
    try {
      const data = await bulkWords.mutateAsync({ action, ids });
      const merged = data.results.filter(
        (r) => r.ok && r.merged_into_word_id,
      ).length;
      if (data.failed === 0) {
        const mergeNote = merged > 0 ? ` (${merged} digabung ke lemma yang sudah tayang)` : '';
        message.success(
          action === 'delete'
            ? `${data.succeeded} kata dihapus`
            : action === 'publish'
              ? `${data.succeeded} kata ditayangkan${mergeNote}`
              : `${data.succeeded} kata ditarik dari tayang`,
        );
      } else {
        message.warning(
          `${data.succeeded} berhasil, ${data.failed} gagal. Periksa entri yang ditarik/hilang.`,
        );
      }
      clearSelection();
    } catch (err) {
      message.error(normalizeError(err).message || 'Gagal menjalankan aksi massal');
    }
  };

  const columns = useMemo(
    () => [
      columnHelper.accessor('lemma', {
        header: 'Kata Sambas',
        size: 220,
        cell: (info) => <Typography.Text strong>{info.getValue()}</Typography.Text>,
      }),
      columnHelper.accessor('word_type', {
        header: 'Jenis',
        size: 140,
        cell: (info) => WORD_TYPE_LABELS[info.getValue()],
      }),
      columnHelper.display({
        id: 'published',
        header: 'Tayang',
        size: 100,
        cell: (info) => {
          const row = info.row.original;
          const checked = row.status === 'published';
          if (row.status === 'taken_down') {
            return (
              <Tooltip title="Entri ditarik. Pulihkan dari halaman detail.">
                <Switch checked={false} disabled size="small" />
              </Tooltip>
            );
          }
          if (!canVerify) {
            return <Switch checked={checked} disabled size="small" />;
          }
          return (
            <Switch
              checked={checked}
              size="small"
              loading={publishingId === row.id}
              onChange={(next) => onTogglePublished(row.id, row.lemma, next)}
            />
          );
        },
      }),
      columnHelper.display({
        id: 'verified',
        header: 'Terverifikasi',
        size: 120,
        cell: (info) => {
          const row = info.row.original;
          const published = row.status === 'published';
          const canToggle = canVerify && published;
          const switchEl = (
            <Switch
              checked={row.is_verified}
              size="small"
              disabled={!canToggle}
              loading={verifyingId === row.id}
              onChange={(next) => onToggleVerified(row.id, row.lemma, next)}
            />
          );
          if (canVerify && !published) {
            return <Tooltip title="Hanya kata tayang yang bisa diverifikasi">{switchEl}</Tooltip>;
          }
          return switchEl;
        },
      }),
      columnHelper.accessor('language_code', {
        header: 'Bahasa',
        size: 100,
        meta: { responsive: ['lg'] },
      }),
      columnHelper.display({
        id: 'actions',
        header: 'Aksi',
        size: 120,
        meta: { fixed: 'right' },
        cell: (info) => (
          <Flex gap={0} wrap={false} align="center">
            {user?.role !== 'contributor' ? (
              <Tooltip title="Detail">
                <Button
                  type="link"
                  icon={<EyeOutlined />}
                  onClick={() =>
                    navigate({ to: '/words/$id', params: { id: info.row.original.id } })
                  }
                />
              </Tooltip>
            ) : null}
            {user?.role !== 'contributor' ? (
              <Tooltip title="Ubah">
                <Button
                  type="link"
                  icon={<EditOutlined />}
                  onClick={() =>
                    navigate({ to: '/words/$id/edit', params: { id: info.row.original.id } })
                  }
                />
              </Tooltip>
            ) : null}
            {user?.role !== 'contributor' ? (
              <Popconfirm
                title={`Hapus kata "${info.row.original.lemma}"?`}
                description="Kata akan hilang dari kamus publik & daftar admin. Soft-delete: data tetap disimpan untuk audit/recovery."
                okText="Hapus"
                okButtonProps={{ danger: true }}
                cancelText="Batal"
                onConfirm={() => onDeleteWord(info.row.original.id, info.row.original.lemma)}
              >
                <Tooltip title="Hapus">
                  <Button
                    type="link"
                    danger
                    icon={<DeleteOutlined />}
                    loading={deletingId === info.row.original.id}
                    disabled={deletingId !== undefined && deletingId !== info.row.original.id}
                  />
                </Tooltip>
              </Popconfirm>
            ) : null}
          </Flex>
        ),
      }),
    ],
    [
      navigate,
      user?.role,
      onDeleteWord,
      onToggleVerified,
      onTogglePublished,
      canVerify,
      deletingId,
      publishingId,
      verifyingId,
    ],
  );

  const table = useReactTable({
    data: items,
    columns,
    getRowId: (row) => String(row.id),
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
  });

  const selectedCount = selectedRowKeys.length;
  const bulkBusy = bulkWords.isPending;

  return (
    <>
      <PageHeader
        title="Kata"
        subtitle="Kamus kosakata - list, cari, dan kelola entri. Tab Tidak tayang untuk draft / ditarik."
        extra={
          <Flex gap={8}>
            {canImport ? (
              <>
                <Button
                  icon={<HistoryOutlined />}
                  onClick={() => navigate({ to: '/words/import-history' })}
                >
                  Riwayat impor
                </Button>
                <Button icon={<UploadOutlined />} onClick={() => setImportOpen(true)}>
                  Impor massal
                </Button>
              </>
            ) : null}
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() =>
                navigate({
                  to: '/words/new',
                  search: { from_miss: undefined, term: undefined, direction: undefined },
                })
              }
            >
              Tambah Kata
            </Button>
          </Flex>
        }
      />
      <Tabs
        activeKey={activeTab}
        onChange={(key) => {
          setActiveTab(key as WordsTab);
          clearSelection();
        }}
        items={[
          ...LIST_TABS.map((t) => ({ key: t.key, label: t.label })),
          {
            key: 'duplicates',
            label:
              duplicateCount && duplicateCount > 0
                ? `Duplikasi (${duplicateCount})`
                : 'Duplikasi',
          },
          {
            key: 'comma_splits',
            label:
              commaSplitCount && commaSplitCount > 0
                ? `Pemisahan (${commaSplitCount})`
                : 'Pemisahan',
          },
        ]}
        style={{ marginBottom: 8 }}
      />

      {isDuplicatesTab ? (
        <WordDuplicatesPanel canMerge={canVerify} />
      ) : isCommaSplitsTab ? (
        <WordCommaSplitsPanel canApply={canVerify} />
      ) : (
        <>
      <Flex wrap gap={12} style={{ marginBottom: 16 }}>
        <Input.Search
          allowClear
          placeholder="Cari kata Sambas (lemma)…"
          style={{ width: 320 }}
          onChange={(e) => setSearchInput(e.target.value)}
          loading={isFetching && !items.length}
        />
        <Select
          allowClear
          placeholder="Jenis entri"
          style={{ width: 180 }}
          options={wordTypeOptions}
          value={wordType}
          onChange={setWordType}
        />
        <Select
          allowClear
          placeholder="Status verifikasi"
          style={{ width: 180 }}
          options={[
            { value: true, label: 'Terverifikasi' },
            { value: false, label: 'Belum diverifikasi' },
          ]}
          value={isVerified}
          onChange={setIsVerified}
        />
        <Button icon={<ReloadOutlined />} onClick={() => refetch()}>
          Muat ulang
        </Button>
      </Flex>

      {selectedCount > 0 ? (
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
          <Typography.Text>
            {selectedCount} dipilih
          </Typography.Text>
          <Space wrap>
            {canVerify ? (
              <Popconfirm
                title={`Tayangkan ${selectedCount} kata?`}
                description="Jika lemma sudah tayang, makna digabung ke entri yang ada (sama seperti aksi tunggal)."
                okText="Tayang"
                cancelText="Batal"
                onConfirm={() => onBulkAction('publish')}
              >
                <Button icon={<CheckOutlined />} loading={bulkBusy} disabled={bulkBusy}>
                  Tayang
                </Button>
              </Popconfirm>
            ) : null}
            {canVerify ? (
              <Popconfirm
                title={`Tarik tayang ${selectedCount} kata?`}
                description="Status menjadi draft. Entri yang sedang ditarik (taken_down) akan gagal per-baris."
                okText="Tidak tayang"
                cancelText="Batal"
                onConfirm={() => onBulkAction('unpublish')}
              >
                <Button icon={<StopOutlined />} loading={bulkBusy} disabled={bulkBusy}>
                  Tidak tayang
                </Button>
              </Popconfirm>
            ) : null}
            {canBulkDelete ? (
              <Popconfirm
                title={`Hapus ${selectedCount} kata?`}
                description="Soft-delete: hilang dari publik & daftar admin; data tetap untuk audit/recovery."
                okText="Hapus"
                okButtonProps={{ danger: true }}
                cancelText="Batal"
                onConfirm={() => onBulkAction('delete')}
              >
                <Button danger icon={<DeleteOutlined />} loading={bulkBusy} disabled={bulkBusy}>
                  Hapus
                </Button>
              </Popconfirm>
            ) : null}
            <Button type="link" onClick={clearSelection} disabled={bulkBusy}>
              Batal pilih
            </Button>
          </Space>
        </Flex>
      ) : null}

      {isError ? (
        <Alert type="error" showIcon style={{ marginBottom: 16 }} message="Gagal memuat data" description={error?.message} />
      ) : null}

      <DataTable
        table={table}
        rowKey={(record) => String(record.id)}
        loading={isLoading || (isFetching && !items.length) || bulkBusy}
        rowSelection={
          canBulkSelect
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
        </>
      )}
      <ImportWordsDrawer
        open={importOpen}
        canVerify={canVerify}
        onClose={() => setImportOpen(false)}
        onImported={({ drafts }) => {
          if (drafts > 0) setActiveTab('unpublished');
        }}
      />
    </>
  );
}