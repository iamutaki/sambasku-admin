import { useMemo, useState } from 'react';
import { createColumnHelper, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { DeleteOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { Alert, App as AntdApp, Button, Flex, Input, Popconfirm, Space, Typography } from 'antd';
import { DataTable } from '@/shared/components/data-table';
import { PageHeader } from '@/shared/components/page-header';
import { formatDateTime } from '@/shared/utils/format-datetime';
import { normalizeError } from '@/shared/api/error';
import { useAuth } from '@/shared/auth/use-auth';
import { useBlocklistList } from '../application/use-blocklist-list';
import { useCreateBlocklistWord, useDeleteBlocklistWord } from '../application/use-blocklist-mutations';
import type { BlocklistWordItem } from '../domain/blocklist-word';

const columnHelper = createColumnHelper<BlocklistWordItem>();

export function CommentBlocklistPage() {
  const { user } = useAuth();
  const canManage = user?.role === 'admin' || user?.role === 'root';
  const { message } = AntdApp.useApp();
  const [word, setWord] = useState('');

  const { items, hasMore, loadMore, isLoading, isFetching, isFetchingNextPage, isError, error, refetch } =
    useBlocklistList(canManage);
  const createMutation = useCreateBlocklistWord();
  const deleteMutation = useDeleteBlocklistWord();

  const onAdd = async () => {
    const trimmed = word.trim();
    if (!trimmed) {
      message.warning('Kata tidak boleh kosong');
      return;
    }
    try {
      await createMutation.mutateAsync(trimmed);
      message.success('Kata ditambahkan ke blocklist');
      setWord('');
    } catch (err) {
      message.error(normalizeError(err).message);
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
        subtitle="Kata di daftar ini diganti otomatis (*** ) saat user mengirim komentar."
        extra={
          <Button icon={<ReloadOutlined />} onClick={() => refetch()}>
            Muat ulang
          </Button>
        }
      />

      <Space.Compact style={{ width: '100%', maxWidth: 480, marginBottom: 16 }}>
        <Input
          placeholder="Tambah kata terlarang"
          value={word}
          onChange={(e) => setWord(e.target.value)}
          onPressEnter={() => void onAdd()}
          maxLength={100}
        />
        <Button type="primary" icon={<PlusOutlined />} loading={createMutation.isPending} onClick={() => void onAdd()}>
          Tambah
        </Button>
      </Space.Compact>

      {isError ? (
        <Alert type="error" showIcon style={{ marginBottom: 16 }} message="Gagal memuat" description={error?.message} />
      ) : null}

      <DataTable table={table} rowKey={(r) => r.id} loading={isLoading || (isFetching && !items.length)} />

      <Flex justify="center" gap={16} style={{ marginTop: 16 }}>
        <Typography.Text type="secondary">{items.length} kata</Typography.Text>
        {hasMore ? (
          <Button onClick={() => loadMore()} loading={isFetchingNextPage}>
            Muat lagi
          </Button>
        ) : null}
      </Flex>
    </>
  );
}
