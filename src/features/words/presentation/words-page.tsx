import { useMemo, useState } from 'react';
import { createColumnHelper, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { DeleteOutlined, EditOutlined, EyeOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { Alert, App as AntdApp, Button, Flex, Input, Popconfirm, Select, Tag, Tooltip, Typography } from 'antd';
import { DataTable } from '@/shared/components/data-table';
import { PageHeader } from '@/shared/components/page-header';
import { useNavigate } from '@tanstack/react-router';
import { useWordList, type UseWordListArgs } from '../application/use-word-list';
import { useAuth } from '@/shared/auth/use-auth';
import { useDeleteWord } from '../application/use-delete-word';
import {
  WORD_STATUS_LABELS,
  WORD_TYPES,
  WORD_TYPE_LABELS,
  type WordListItem,
  type WordStatus,
  type WordType,
} from '../domain/word';
import { useDebouncedValue } from '@/shared/hooks/use-debounced-value';

const columnHelper = createColumnHelper<WordListItem>();

const STATUS_TAG_COLOR: Record<WordStatus, string> = {
  draft: 'default',
  pending_review: 'orange',
  published: 'green',
  rejected: 'red',
};

const wordTypeOptions = WORD_TYPES.map((type) => ({ value: type, label: WORD_TYPE_LABELS[type] }));

export function WordsPage() {
  const { message } = AntdApp.useApp();
  const navigate = useNavigate();
  const { user } = useAuth();
  const deleteWord = useDeleteWord();
  const [searchInput, setSearchInput] = useState('');
  const [wordType, setWordType] = useState<WordType | undefined>();
  const [isVerified, setIsVerified] = useState<boolean | undefined>();
  const [deletingId, setDeletingId] = useState<string | undefined>();
  const q = useDebouncedValue(searchInput, 300);

  const listArgs: UseWordListArgs = { q, wordType, isVerified };
  const { items, hasMore, loadMore, isLoading, isFetching, isFetchingNextPage, isError, error, refetch } =
    useWordList(listArgs);

  // Hapus kata - soft-delete (07-api-delete-kata.md): hilang dari publik &
  // list, baris dipertahankan backend untuk audit/recovery.
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
      columnHelper.accessor('status', {
        header: 'Status',
        size: 160,
        cell: (info) => <Tag color={STATUS_TAG_COLOR[info.getValue()]}>{WORD_STATUS_LABELS[info.getValue()]}</Tag>,
      }),
      columnHelper.accessor('language_code', {
        header: 'Bahasa',
        size: 100,
        meta: { responsive: ['lg'] },
      }),
      columnHelper.accessor('matched_translation', {
        header: 'Terjemahan',
        size: 220,
        meta: { responsive: ['lg'] },
        cell: (info) => info.getValue() ?? '-',
      }),
      columnHelper.display({
        id: 'actions',
        header: 'Aksi',
        size: 140,
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
                <Button
                  type="link"
                  danger
                  icon={<DeleteOutlined />}
                  loading={deletingId === info.row.original.id}
                  disabled={deletingId !== undefined && deletingId !== info.row.original.id}
                />
              </Popconfirm>
            ) : null}
          </Flex>
        ),
      }),
    ],
    [message, navigate, user?.role, onDeleteWord, deletingId],
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
        subtitle="Kamus kosakata - list, cari, dan kelola entri."
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate({ to: '/words/new' })}>
            Tambah Kata
          </Button>
        }
      />
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
  );
}