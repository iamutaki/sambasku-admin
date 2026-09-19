import { useMemo, useState } from 'react';
import { createColumnHelper, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { useNavigate } from '@tanstack/react-router';
import { DeleteOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import {
  Alert,
  App as AntdApp,
  Button,
  Col,
  Flex,
  Input,
  Popconfirm,
  Result,
  Row,
  Select,
  Tabs,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import dayjs from 'dayjs';
import { DataTable } from '@/shared/components/data-table';
import { PageHeader } from '@/shared/components/page-header';
import { useAuth } from '@/shared/auth/use-auth';
import { normalizeError } from '@/shared/api/error';
import { useDebouncedValue } from '@/shared/hooks/use-debounced-value';
import { useAdminVoteList } from '../application/use-admin-vote-list';
import { useTopTargetVotes } from '../application/use-top-target-votes';
import { useDeleteAdminVote } from '../application/use-delete-admin-vote';
import { useResetTargetVotes } from '../application/use-reset-target-votes';
import {
  TARGET_TYPE_LABELS,
  TARGET_TYPE_OPTIONS,
  TARGET_TYPE_TAG_COLOR,
  VALUE_OPTIONS,
  type AdminTopTargetItem,
  type AdminVoteListItem,
  type AdminVoteTargetType,
} from '../domain/vote-admin';

const voteColumnHelper = createColumnHelper<AdminVoteListItem>();
const topColumnHelper = createColumnHelper<AdminTopTargetItem>();

/** Preview target: comment → body; word → lemma (+ link); fallback type:id. */
function TargetPreviewCell({
  targetType,
  targetId,
  targetPreview,
}: {
  targetType: AdminVoteTargetType;
  targetId: string;
  targetPreview: string | null;
}) {
  const navigate = useNavigate();
  const label = targetPreview?.trim() || null;

  if (targetType === 'word') {
    return (
      <Typography.Link onClick={() => navigate({ to: '/words/$id', params: { id: targetId } })}>
        {label ?? 'Lihat detail kata'}
      </Typography.Link>
    );
  }

  if (label) {
    return (
      <Typography.Text ellipsis={{ tooltip: label }} style={{ maxWidth: 360 }}>
        {label}
      </Typography.Text>
    );
  }

  return <Typography.Text type="secondary">Target dihapus / tidak ditemukan</Typography.Text>;
}

/** Aksi hapus per-baris (mutasi milik baris → loading terisolasi per baris). */
function DeleteVoteAction({ vote }: { vote: AdminVoteListItem }) {
  const { message } = AntdApp.useApp();
  const deleteVote = useDeleteAdminVote();

  return (
    <Popconfirm
      title="Hapus vote ini?"
      description={`Vote voter "${vote.voterUsername}" pada target ini akan dihapus permanen (irreversible).`}
      okText="Hapus"
      okButtonProps={{ danger: true }}
      cancelText="Batal"
      onConfirm={() => {
        void deleteVote
          .mutateAsync(vote.id, {
            onSuccess: () => message.success(`Vote ${vote.voterUsername} dihapus`),
            onError: (err) => message.warning(normalizeError(err).message || 'Gagal hapus vote'),
          })
          .catch(() => {
            // Handled via callback onError.
          });
      }}
    >
      <Tooltip title="Hapus vote">
        <Button type="link" danger icon={<DeleteOutlined />} loading={deleteVote.isPending} />
      </Tooltip>
    </Popconfirm>
  );
}

/** Aksi reset massal per-baris top target. */
function ResetTargetAction({ target }: { target: AdminTopTargetItem }) {
  const { message } = AntdApp.useApp();
  const resetTarget = useResetTargetVotes();

  return (
    <Popconfirm
      title="Reset SEMUA vote untuk target ini?"
      description={`Semua ${target.upvotes + target.downvotes} vote (upvote + downvote) akan dihapus permanen, skor net balik ke 0. Tidak bisa dibatalkan.`}
      okText="Reset Semua"
      okButtonProps={{ danger: true }}
      cancelText="Batal"
      onConfirm={() => {
        void resetTarget
          .mutateAsync(
            { targetType: target.targetType, targetId: target.targetId },
            {
              onSuccess: (data) =>
                message.success(`Berhasil reset vote target. Total vote dihapus: ${data.deleted_count}`),
              onError: (err) => message.warning(normalizeError(err).message || 'Gagal reset vote target'),
            },
          )
          .catch(() => {
            // Handled via callback onError.
          });
      }}
    >
      <Tooltip title="Reset semua vote">
        <Button type="link" danger icon={<DeleteOutlined />} loading={resetTarget.isPending} />
      </Tooltip>
    </Popconfirm>
  );
}

/** Tab 1 - daftar vote granular untuk audit manual + hapus vote spam. */
function VoteListTab() {
  const [searchInput, setSearchInput] = useState('');
  const [targetType, setTargetType] = useState<AdminVoteTargetType | undefined>();
  const [value, setValue] = useState<1 | -1 | undefined>();
  const [targetIdInput, setTargetIdInput] = useState('');
  const q = useDebouncedValue(searchInput, 400);

  const { items, hasMore, loadMore, isLoading, isFetching, isFetchingNextPage, isError, error, refetch } =
    useAdminVoteList({ q, targetType, value, targetId: targetIdInput || undefined });

  const columns = useMemo(
    () => [
      voteColumnHelper.accessor('voterUsername', {
        header: 'Pengguna',
        size: 280,
        meta: { fixed: 'left' },
        cell: (info) => (
          <div>
            <Typography.Text strong>{info.getValue()}</Typography.Text>
            <br />
            <Typography.Text italic type="secondary" style={{ fontSize: 12 }}>
              {info.row.original.voterEmail}
            </Typography.Text>
          </div>
        ),
      }),
      voteColumnHelper.accessor('targetType', {
        header: 'Tipe Target',
        size: 160,
        cell: (info) => (
          <Tag color={TARGET_TYPE_TAG_COLOR[info.getValue()]}>{TARGET_TYPE_LABELS[info.getValue()]}</Tag>
        ),
      }),
      voteColumnHelper.display({
        id: 'target',
        header: 'Target',
        size: 220,
        cell: ({ row }) => (
          <TargetPreviewCell
            targetType={row.original.targetType}
            targetId={row.original.targetId}
            targetPreview={row.original.targetPreview}
          />
        ),
      }),
      voteColumnHelper.accessor('value', {
        header: 'Nilai',
        size: 130,
        cell: (info) =>
          info.getValue() === 1 ? <Tag color="green">↑ Upvote</Tag> : <Tag color="red">↓ Downvote</Tag>,
      }),
      voteColumnHelper.accessor('createdAt', {
        header: 'Waktu',
        size: 180,
        meta: { responsive: ['md'] },
        cell: (info) => dayjs(info.getValue()).format('DD MMM YYYY HH:mm'),
      }),
      voteColumnHelper.display({
        id: 'actions',
        header: 'Aksi',
        size: 100,
        meta: { fixed: 'right' },
        cell: ({ row }) => <DeleteVoteAction vote={row.original} />,
      }),
    ],
    [],
  );

  const table = useReactTable({
    data: items,
    columns,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
  });

  return (
    <>
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={8}>
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="Cari username / email voter…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </Col>
        <Col xs={24} md={5}>
          <Select
            allowClear
            style={{ width: '100%' }}
            placeholder="Tipe target"
            options={TARGET_TYPE_OPTIONS}
            value={targetType}
            onChange={setTargetType}
          />
        </Col>
        <Col xs={24} md={5}>
          <Select
            allowClear
            style={{ width: '100%' }}
            placeholder="Nilai vote"
            options={VALUE_OPTIONS}
            value={value}
            onChange={setValue}
          />
        </Col>
        <Col xs={24} md={6}>
          <Input
            allowClear
            placeholder="Filter ULID target (opsional)"
            value={targetIdInput}
            onChange={(e) => setTargetIdInput(e.target.value)}
          />
        </Col>
        <Col xs={24}>
          <Flex justify="flex-end" wrap>
            <Button icon={<ReloadOutlined />} onClick={() => refetch()}>
              Muat ulang
            </Button>
          </Flex>
        </Col>
      </Row>

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
        loading={isLoading || (isFetching && !items.length)}
      />

      <Flex justify="center" align="center" gap={16} style={{ marginTop: 16 }}>
        <Typography.Text type="secondary">{items.length} vote dimuat</Typography.Text>
        {hasMore ? (
          <Button onClick={() => loadMore()} loading={isFetchingNextPage}>
            Muat lagi
          </Button>
        ) : null}
      </Flex>
    </>
  );
}

/** Tab 2 - top target per entity type terurut skor bersih + reset massal. */
function TopTargetsTab({ enabled }: { enabled: boolean }) {
  const [targetType, setTargetType] = useState<AdminVoteTargetType>('word');

  const { data: items = [], isLoading, isFetching, isError, error, refetch } = useTopTargetVotes({
    targetType,
    enabled,
  });

  const columns = useMemo(
    () => [
      topColumnHelper.display({
        id: 'rank',
        header: 'Peringkat',
        size: 110,
        cell: ({ row }) => <Typography.Text strong>{row.index + 1}</Typography.Text>,
      }),
      topColumnHelper.display({
        id: 'target',
        header: 'Target',
        size: 220,
        cell: ({ row }) => (
          <TargetPreviewCell
            targetType={row.original.targetType}
            targetId={row.original.targetId}
            targetPreview={row.original.targetPreview}
          />
        ),
      }),
      topColumnHelper.accessor('upvotes', {
        header: 'Upvote',
        size: 110,
        cell: (info) => <Tag color="green">↑ {info.getValue()}</Tag>,
      }),
      topColumnHelper.accessor('downvotes', {
        header: 'Downvote',
        size: 110,
        cell: (info) => <Tag color="red">↓ {info.getValue()}</Tag>,
      }),
      topColumnHelper.accessor('net', {
        header: 'Skor Bersih',
        size: 130,
        cell: (info) => (
          <Typography.Text
            strong
            type={info.getValue() > 0 ? 'success' : info.getValue() < 0 ? 'danger' : undefined}
          >
            {info.getValue() > 0 ? `+${info.getValue()}` : info.getValue()}
          </Typography.Text>
        ),
      }),
      topColumnHelper.display({
        id: 'actions',
        header: 'Aksi',
        size: 110,
        meta: { fixed: 'right' },
        cell: ({ row }) => <ResetTargetAction target={row.original} />,
      }),
    ],
    [],
  );

  const table = useReactTable({
    data: items,
    columns,
    getRowId: (row) => `${row.targetType}:${row.targetId}`,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
  });

  return (
    <>
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={8}>
          <Select
            style={{ width: '100%' }}
            placeholder="Tipe target"
            options={TARGET_TYPE_OPTIONS}
            value={targetType}
            onChange={setTargetType}
          />
        </Col>
        <Col xs={24} md={16}>
          <Flex justify="flex-end" wrap>
            <Button icon={<ReloadOutlined />} onClick={() => refetch()}>
              Muat ulang
            </Button>
          </Flex>
        </Col>
      </Row>

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
        rowKey={(record) => `${record.targetType}:${record.targetId}`}
        loading={isLoading || (isFetching && !items.length)}
      />
    </>
  );
}

/**
 * Panel Vote - list vote granular (audit + hapus spam) dan top
 * target terurut skor bersih (deteksi brigading + reset massal). Hanya
 * role root/admin/reviewer (matrix destructive action level konten).
 */
export function VoteModerationPage() {
  const { user } = useAuth();
  const canManage = user?.role === 'root' || user?.role === 'admin' || user?.role === 'reviewer';
  const [activeTab, setActiveTab] = useState('list');

  if (!canManage) {
    return (
      <Result
        status="403"
        title="403"
        subTitle="Panel vote hanya untuk role reviewer, admin, dan root."
      />
    );
  }

  return (
    <>
      <PageHeader
        title="Vote"
        subtitle="Audit vote granular (hapus vote spam individual) dan reset massal per target untuk penanganan brigading."
      />
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          { key: 'list', label: 'Daftar Vote', children: <VoteListTab /> },
          { key: 'top', label: 'Top Target', children: <TopTargetsTab enabled={activeTab === 'top'} /> },
        ]}
      />
    </>
  );
}
