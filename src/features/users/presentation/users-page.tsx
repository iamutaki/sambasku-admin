import { useCallback, useMemo, useState } from 'react';
import { createColumnHelper, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { PlusOutlined, ReloadOutlined, SaveOutlined, UserOutlined } from '@ant-design/icons';
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
  Space,
  Switch,
  Tabs,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import { formatDateTime } from '@/shared/utils/format-datetime';
import { DataTable } from '@/shared/components/data-table';
import { PageHeader } from '@/shared/components/page-header';
import { normalizeError } from '@/shared/api/error';
import { useAuth } from '@/shared/auth/use-auth';
import { useDebouncedValue } from '@/shared/hooks/use-debounced-value';
import { useUserAdminList, type UseUserAdminListArgs } from '../application/use-user-admin-list';
import { useSetCanContribute, useSetUserActive, useUpdateUserRole } from '../application/use-update-user-role';
import { CreateUserDrawer } from './create-user-drawer';
import {
  CHANGEABLE_ROLES,
  ROLE_LABELS,
  ROLE_OPTIONS_SELECT,
  ROLE_TAG_COLOR,
  type AdminUserListItem,
  type AdminUserRole,
} from '../domain/user-admin';

type PendingRoleMap = Record<string, AdminUserRole | undefined>;

const columnHelper = createColumnHelper<AdminUserListItem>();

const allRoleFilterOptions: { value: AdminUserRole; label: string }[] = [
  ...(ROLE_OPTIONS_SELECT as unknown as { value: AdminUserRole; label: string }[]),
  { value: 'root', label: ROLE_LABELS.root },
];

export function UsersPage() {
  const { user } = useAuth();
  const canManage = user?.role === 'admin' || user?.role === 'root';
  const { message } = AntdApp.useApp();
  const [searchInput, setSearchInput] = useState('');
  const [filterRole, setFilterRole] = useState<AdminUserRole | undefined>();
  const [userTab, setUserTab] = useState<'all' | 'blocked'>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [pendingRoles, setPendingRoles] = useState<PendingRoleMap>({});
  const q = useDebouncedValue(searchInput, 300);
  const updateRole = useUpdateUserRole();
  const setContribute = useSetCanContribute();
  const setActive = useSetUserActive();
  const listArgs: UseUserAdminListArgs = {
    q,
    role: filterRole,
    canContribute: userTab === 'blocked' ? false : undefined,
  };
  const { items, hasMore, loadMore, isLoading, isFetching, isFetchingNextPage, isError, error, refetch } =
    useUserAdminList(listArgs);

  const ensurePending = (row: AdminUserListItem) => {
    setPendingRoles((prev) => {
      if (prev[row.id] !== undefined) return prev;
      if (!CHANGEABLE_ROLES.includes(row.role as (typeof CHANGEABLE_ROLES)[number])) return prev;
      return { ...prev, [row.id]: row.role as AdminUserRole };
    });
  };

  const onChangePending = (id: string, next: AdminUserRole) => {
    setPendingRoles((prev) => ({ ...prev, [id]: next }));
  };

  const onSaveRole = useCallback(
    async (row: AdminUserListItem) => {
      const pending = pendingRoles[row.id];
      if (!pending || pending === row.role) return;
      if (!CHANGEABLE_ROLES.includes(pending as (typeof CHANGEABLE_ROLES)[number])) return;
      try {
        await updateRole.mutateAsync(
          {
            id: row.id,
            role: pending as Exclude<AdminUserRole, 'root'>,
            username: row.username,
            prevRole: row.role,
          },
          {
            onError: (err) => message.warning(normalizeError(err).message || 'Gagal ubah role'),
          },
        );
        setPendingRoles((prev) => {
          const next = { ...prev };
          delete next[row.id];
          return next;
        });
      } catch {
        // Handled via onError above & onError hook.
      }
    },
    [pendingRoles, updateRole, message],
  );

  const columns = useMemo(
    () => [
      columnHelper.accessor('username', {
        header: 'Pengguna',
        size: 280,
        meta: { fixed: 'left' },
        cell: (info) => (
          <div>
            <Typography.Text strong>{info.getValue()}</Typography.Text>
            <br />
            <Typography.Text type="secondary" italic style={{ fontSize: 12 }}>
              @{info.row.original.email}
            </Typography.Text>
          </div>
        ),
      }),
      columnHelper.display({
        id: 'contribute',
        header: 'Kontribusi',
        size: 120,
        cell: (info) => {
          const row = info.row.original;
          const pending = setContribute.isPending && setContribute.variables?.id === row.id;
          return (
            <Switch
              checked={row.canContribute}
              size="small"
              loading={pending}
              onChange={(next) =>
                setContribute.mutate({
                  id: row.id,
                  canContribute: next,
                  username: row.username,
                })
              }
            />
          );
        },
      }),
      columnHelper.accessor('role', {
        header: 'Peran',
        size: 160,
        cell: (info) => (
          <Tag color={ROLE_TAG_COLOR[info.getValue()]}>{ROLE_LABELS[info.getValue()]}</Tag>
        ),
      }),
      columnHelper.accessor('isActive', {
        header: 'Status',
        size: 140,
        cell: (info) => {
          const row = info.row.original;
          const isSelf = row.id === user?.id;
          const locked = row.role === 'root' || isSelf;
          const reason = row.role === 'root'
            ? 'Status root hanya dapat diatur via SQL seed'
            : isSelf
              ? 'Tidak bisa mengubah status akun sendiri'
              : undefined;
          const control = (
            <Switch
              checked={row.isActive}
              size="small"
              disabled={locked}
              loading={setActive.isPending && setActive.variables?.id === row.id}
              onChange={(next) => {
                if (locked) return;
                setActive.mutate({ id: row.id, isActive: next, username: row.username });
              }}
            />
          );
          return reason ? <Tooltip title={reason}>{control}</Tooltip> : control;
        },
      }),
      columnHelper.accessor('createdAt', {
        header: 'Bergabung',
        size: 180,
        meta: { responsive: ['md'] },
        cell: (info) => formatDateTime(info.getValue()),
      }),
      columnHelper.display({
        id: 'actions',
        header: 'Aksi',
        size: 320,
        meta: { fixed: 'right' },
        cell: (info) => {
          const row = info.row.original;
          const isMutationThisRow = updateRole.variables?.id === row.id;
          if (row.role === 'root') {
            return (
              <Tooltip title="Role root hanya dapat diatur via SQL seed (keamanan)">
                <Typography.Text type="secondary">-</Typography.Text>
              </Tooltip>
            );
          }
          const pending = pendingRoles[row.id] ?? row.role;
          const changed = pending !== row.role && CHANGEABLE_ROLES.includes(pending as (typeof CHANGEABLE_ROLES)[number]);
          ensurePending(row);
          return (
            <Flex gap={8} wrap={false} align="center" key={`user-action-${row.id}-${changed}`}>
              <Select
                size="small"
                style={{ minWidth: 140 }}
                value={pending}
                disabled={isMutationThisRow}
                options={ROLE_OPTIONS_SELECT as { value: typeof pending; label: string }[]}
                onChange={(val) => onChangePending(row.id, val as AdminUserRole)}
              />
              <Popconfirm
                title={`Ubah role user "${row.username}"?`}
                description={
                  <div>
                    <div>
                      Dari <Tag color={ROLE_TAG_COLOR[row.role]}>{ROLE_LABELS[row.role]}</Tag>
                      {' → '}
                      <Tag color={ROLE_TAG_COLOR[pending as AdminUserRole]}>
                        {ROLE_LABELS[pending as AdminUserRole]}
                      </Tag>
                    </div>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      Semua perangkat login user akan logout otomatis setelah peran diubah.
                    </Typography.Text>
                  </div>
                }
                okText="Ubah Peran"
                okButtonProps={{ type: 'primary' }}
                cancelText="Batal"
                disabled={!changed}
                onConfirm={() => onSaveRole(row)}
              >
                <Tooltip title={changed ? 'Simpan perubahan peran' : 'Pilih peran baru terlebih dahulu'}>
                  <Button
                    type="link"
                    icon={<SaveOutlined />}
                    loading={isMutationThisRow}
                    disabled={!changed || updateRole.isPending}
                  />
                </Tooltip>
              </Popconfirm>
            </Flex>
          );
        },
      }),
    ],
    [pendingRoles, updateRole.variables, updateRole.isPending, onSaveRole, setContribute, setActive, user?.id],
  );

  const table = useReactTable({
    data: items,
    columns,
    getRowId: (row) => String(row.id),
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
  });

  if (!canManage) {
    return (
      <Result
        status="403"
        title="Akses ditolak"
        subTitle="Halaman kelola pengguna hanya untuk role admin dan root."
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
        title={<Space size={8}><UserOutlined /> <span>Pengguna</span></Space>}
        subtitle="Kelola akun dan peran pengguna. Hanya admin dan root yang dapat membuka halaman ini. Peran Verifikator memeriksa antrean. Admin, Editor, dan Root juga boleh memeriksa, dengan wewenang tambahan, dan jabatan mereka tetap Admin, Editor, atau Root."
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
            Tambah pengguna
          </Button>
        }
      />
      <Tabs
        activeKey={userTab}
        onChange={(key) => setUserTab(key as 'all' | 'blocked')}
        style={{ marginBottom: 12 }}
        items={[
          { key: 'all', label: 'Semua' },
          { key: 'blocked', label: 'Tidak bisa kontribusi' },
        ]}
      />
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={10}>
          <Input.Search
            allowClear
            placeholder="Cari username atau email…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            loading={isFetching && !items.length}
          />
        </Col>
        <Col xs={24} md={6}>
          <Select
            allowClear
            placeholder="Filter peran"
            style={{ width: '100%' }}
            options={allRoleFilterOptions}
            value={filterRole}
            onChange={setFilterRole}
          />
        </Col>
        <Col xs={24} md={8}>
          <Flex gap={8} align="center" wrap="wrap">
            <Button icon={<ReloadOutlined />} onClick={() => refetch()}>
              Muat ulang
            </Button>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {items.length} pengguna dimuat
            </Typography.Text>
          </Flex>
        </Col>
      </Row>

      {isError ? (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message="Gagal memuat daftar pengguna"
          description={error?.message}
        />
      ) : null}

      {userTab === 'blocked' && !isLoading && items.length === 0 ? (
        <Typography.Text type="secondary">Tidak ada pengguna yang dihentikan kontribusinya.</Typography.Text>
      ) : (
        <DataTable
          table={table}
          rowKey={(record) => String(record.id)}
          loading={isLoading || (isFetching && !items.length)}
        />
      )}

      <CreateUserDrawer open={createOpen} onClose={() => setCreateOpen(false)} />

      <Flex justify="center" align="center" gap={16} style={{ marginTop: 16 }}>
        {hasMore ? (
          <Button onClick={() => loadMore()} loading={isFetchingNextPage}>
            Muat lagi
          </Button>
        ) : items.length ? (
          <Typography.Text type="secondary">Semua pengguna sudah dimuat</Typography.Text>
        ) : null}
      </Flex>
    </>
  );
}
