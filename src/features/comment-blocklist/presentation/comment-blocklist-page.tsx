import { useMemo, useState } from 'react';
import { createColumnHelper, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { DeleteOutlined, PlusOutlined, ReloadOutlined, UploadOutlined } from '@ant-design/icons';
import { Alert, App as AntdApp, Button, Flex, Input, Popconfirm, Space, Typography, Upload } from 'antd';
import { DataTable } from '@/shared/components/data-table';
import { PageHeader } from '@/shared/components/page-header';
import { formatDateTime } from '@/shared/utils/format-datetime';
import { normalizeError } from '@/shared/api/error';
import { useAuth } from '@/shared/auth/use-auth';
import { useDebouncedValue } from '@/shared/hooks/use-debounced-value';
import { useBlocklistList } from '../application/use-blocklist-list';
import { useBulkCreateBlocklistWords, useDeleteBlocklistWord } from '../application/use-blocklist-mutations';
import { splitBlocklistText, wordsFromWordlist } from '../application/parse-blocklist-input';
import { bulkResultTone, formatBulkResultMessage } from '../application/format-bulk-result';
import type { BlocklistWordItem, BulkBlocklistResult } from '../domain/blocklist-word';

const columnHelper = createColumnHelper<BlocklistWordItem>();
const MAX_WORDLIST_BYTES = 2 * 1024 * 1024;
const MAX_WORDLIST_WORDS = 20_000;

export function CommentBlocklistPage() {
  const { user } = useAuth();
  const canManage = user?.role === 'admin' || user?.role === 'root';
  const { message } = AntdApp.useApp();
  const [word, setWord] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const q = useDebouncedValue(searchInput, 300);

  const { items, hasMore, loadMore, isLoading, isFetching, isFetchingNextPage, isError, error, refetch } =
    useBlocklistList(canManage, q);
  const bulkMutation = useBulkCreateBlocklistWords();
  const deleteMutation = useDeleteBlocklistWord();

  const reportBulk = (result: BulkBlocklistResult) => {
    const text = formatBulkResultMessage(result);
    const tone = bulkResultTone(result);
    if (tone === 'success') message.success(text);
    else if (tone === 'info') message.info(text);
    else message.warning(text);
  };

  const submitWords = async (words: string[], clearInput: boolean) => {
    if (words.length === 0) {
      message.warning('Tidak ada kata untuk ditambahkan');
      return;
    }
    if (words.length > MAX_WORDLIST_WORDS) {
      message.warning(`Maksimal ${MAX_WORDLIST_WORDS.toLocaleString('id-ID')} kata per unggahan`);
      return;
    }
    try {
      const result = await bulkMutation.mutateAsync(words);
      reportBulk(result);
      if (clearInput && (result.created_count > 0 || result.skipped_count > 0)) setWord('');
    } catch (err) {
      message.error(normalizeError(err).message);
    }
  };

  const onAdd = () => submitWords(splitBlocklistText(word), true);

  const onWordlist = async (file: File) => {
    if (file.size > MAX_WORDLIST_BYTES) {
      message.warning('File terlalu besar (maksimal 2 MB)');
      return;
    }
    try {
      const text = await file.text();
      await submitWords(wordsFromWordlist(text), false);
    } catch {
      message.error('File tidak bisa dibaca');
    }
  };

  const columns = useMemo(
    () => [
      columnHelper.accessor('word', {
        header: 'Kata',
        size: 280,
        cell: (info) => <Typography.Text code>{info.getValue()}</Typography.Text>,
      }),
      columnHelper.accessor('created_at', {
        header: 'Ditambahkan',
        size: 180,
        cell: (info) => formatDateTime(info.getValue()),
      }),
      columnHelper.display({
        id: 'actions',
        header: 'Aksi',
        size: 80,
        cell: ({ row }) => (
          <Popconfirm
            title="Hapus dari blocklist?"
            okText="Hapus"
            okButtonProps={{ danger: true }}
            onConfirm={async () => {
              try {
                await deleteMutation.mutateAsync(row.original.id);
                message.success('Kata dihapus dari blocklist');
              } catch (err) {
                message.error(normalizeError(err).message);
              }
            }}
          >
            <Button
              type="link"
              danger
              icon={<DeleteOutlined />}
              loading={deleteMutation.isPending && deleteMutation.variables === row.original.id}
            />
          </Popconfirm>
        ),
      }),
    ],
    [deleteMutation.isPending, deleteMutation.variables, message],
  );

  const table = useReactTable({
    data: items,
    columns,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
  });

  if (!canManage) {
    return <Alert type="warning" showIcon message="Hanya admin/root yang dapat mengelola blocklist" />;
  }

  return (
    <>
      <PageHeader
        title="Blocklist Komentar"
        subtitle="Kata di daftar ini diganti otomatis (***) saat user mengirim komentar."
        extra={
          <Button icon={<ReloadOutlined />} onClick={() => refetch()}>
            Muat ulang
          </Button>
        }
      />

      <Flex vertical gap={8} style={{ maxWidth: 640, marginBottom: 16 }}>
        <Input.TextArea
          placeholder="Tambah kata, pisahkan dengan koma. Contoh: lorem, ipsum, dolo"
          value={word}
          onChange={(e) => setWord(e.target.value)}
          autoSize={{ minRows: 2, maxRows: 6 }}
          disabled={bulkMutation.isPending}
        />
        <Space wrap>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            loading={bulkMutation.isPending}
            onClick={() => void onAdd()}
          >
            Tambah
          </Button>
          <Upload
            accept=".csv,.txt,text/csv,text/plain"
            showUploadList={false}
            disabled={bulkMutation.isPending}
            beforeUpload={(file) => {
              void onWordlist(file);
              return false;
            }}
          >
            <Button icon={<UploadOutlined />} loading={bulkMutation.isPending}>
              Unggah CSV
            </Button>
          </Upload>
        </Space>
        <Typography.Text type="secondary">
          Beberapa kata dipisah koma atau baris baru. CSV: satu kata per baris (pemisah koma atau titik koma juga
          diterima). Kata yang sudah ada diabaikan.
        </Typography.Text>
      </Flex>

      <Input.Search
        allowClear
        placeholder="Cari kata untuk dihapus…"
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        style={{ maxWidth: 360, marginBottom: 16 }}
        loading={isFetching && !isFetchingNextPage}
      />

      {isError ? (
        <Alert type="error" showIcon style={{ marginBottom: 16 }} message="Gagal memuat" description={error?.message} />
      ) : null}

      <DataTable table={table} rowKey={(r) => r.id} loading={isLoading || (isFetching && !items.length)} />

      <Flex justify="center" gap={16} style={{ marginTop: 16 }}>
        <Typography.Text type="secondary">
          {items.length} kata dimuat{q.trim() ? ` untuk “${q.trim()}”` : ''}
        </Typography.Text>
        {hasMore ? (
          <Button onClick={() => loadMore()} loading={isFetchingNextPage}>
            Muat lagi
          </Button>
        ) : null}
      </Flex>
    </>
  );
}
