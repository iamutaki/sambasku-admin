import { useMemo, useState } from 'react';
import { createColumnHelper, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
  ReloadOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import { Alert, App as AntdApp, Button, Flex, Input, Popconfirm, Select, Switch, Tabs, Tooltip, Typography } from 'antd';
import { DataTable } from '@/shared/components/data-table';
import { PageHeader } from '@/shared/components/page-header';
import { useNavigate } from '@tanstack/react-router';
import { useWordList, type UseWordListArgs } from '../application/use-word-list';
import { useAuth } from '@/shared/auth/use-auth';
import { useDeleteWord } from '../application/use-delete-word';
import { useVerifyWord, useUnverifyWord } from '../application/use-word-verify';
import { usePublishWord, useUnpublishWord } from '../application/use-word-publish';
import { normalizeError } from '@/shared/api/error';
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
  const canVerify = user?.role === 'root' || user?.role === 'admin' || user?.role === 'reviewer';
  const canImport = canVerify || user?.role === 'editor';
  const [importOpen, setImportOpen] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [wordType, setWordType] = useState<WordType | undefined>();
  const [isVerified, setIsVerified] = useState<boolean | undefined>();
  const [activeTab, setActiveTab] = useState<WordsTab>('published');
  const [deletingId, setDeletingId] = useState<string | undefined>();
  const [publishingId, setPublishingId] = useState<string | undefined>();
  const [verifyingId, setVerifyingId] = useState<string | undefined>();
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

  return (
    <>
      <PageHeader
        title="Kata"
        subtitle="Kamus kosakata - list, cari, dan kelola entri. Tab Tidak tayang untuk draft / ditarik."
        extra={
          <Flex gap={8}>
            {canImport ? (
              <Button icon={<UploadOutlined />} onClick={() => setImportOpen(true)}>
                Impor massal
              </Button>
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
        onChange={(key) => setActiveTab(key as WordsTab)}
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