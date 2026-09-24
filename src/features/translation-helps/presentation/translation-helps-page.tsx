import { useMemo, useState } from 'react';
import { createColumnHelper, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { ReloadOutlined, ToolOutlined } from '@ant-design/icons';
import { Alert, Button, Flex, Image, Space, Tabs, Tag, Tooltip, Typography } from 'antd';
import { formatDateTime } from '@/shared/utils/format-datetime';
import { useNavigate } from '@tanstack/react-router';
import { DataTable } from '@/shared/components/data-table';
import { PageHeader } from '@/shared/components/page-header';
import { UserInfoLink } from '@/shared/components/user-info-modal';
import { useAuth } from '@/shared/auth/use-auth';
import { useTranslationHelpList } from '../application/use-translation-help-list';
import {
  TRANSLATION_HELP_STATUS_LABELS,
  TRANSLATION_HELP_STATUS_TAG_COLOR,
  previewImageUrl,
  type TranslationHelpListItem,
  type TranslationHelpStatus,
} from '../domain/translation-help';

const columnHelper = createColumnHelper<TranslationHelpListItem>();

type StatusTab = TranslationHelpStatus | 'all';

const STATUS_TABS: { key: StatusTab; label: string; status?: TranslationHelpStatus }[] = [
  { key: 'pending_review', label: TRANSLATION_HELP_STATUS_LABELS.pending_review, status: 'pending_review' },
  { key: 'published', label: TRANSLATION_HELP_STATUS_LABELS.published, status: 'published' },
  { key: 'rejected', label: TRANSLATION_HELP_STATUS_LABELS.rejected, status: 'rejected' },
  { key: 'taken_down', label: TRANSLATION_HELP_STATUS_LABELS.taken_down, status: 'taken_down' },
  { key: 'all', label: 'Semua' },
];

function canModerateTranslationHelps(role: string | undefined): boolean {
  return role === 'root' || role === 'admin' || role === 'reviewer' || role === 'editor';
}

export function TranslationHelpsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const canModerate = canModerateTranslationHelps(user?.role);
  const [statusTab, setStatusTab] = useState<StatusTab>('pending_review');
  const status = STATUS_TABS.find((t) => t.key === statusTab)?.status;

  const { items, hasMore, loadMore, isLoading, isFetching, isFetchingNextPage, isError, error, refetch } =
    useTranslationHelpList({ status, enabled: canModerate });

  const columns = useMemo(
    () => [
      columnHelper.accessor('body', {
        header: 'Isi',
        size: 280,
        cell: (info) => {
          const body = info.getValue();
          if (!body) {
            return <Typography.Text type="secondary">Hanya gambar</Typography.Text>;
          }
          return (
            <Typography.Paragraph ellipsis={{ rows: 2 }} style={{ margin: 0 }}>
              {body}
            </Typography.Paragraph>
          );
        },
      }),
      columnHelper.accessor('status', {
        header: 'Status',
        size: 120,
        cell: (info) => (
          <Tag color={TRANSLATION_HELP_STATUS_TAG_COLOR[info.getValue()]}>
            {TRANSLATION_HELP_STATUS_LABELS[info.getValue()]}
          </Tag>
        ),
      }),
      columnHelper.accessor('username', {
        header: 'Pengirim',
        size: 140,
        cell: (info) => {
          const name = info.getValue();
          return name ? (
            <UserInfoLink username={name} />
          ) : (
            <Typography.Text type="secondary">Anonim</Typography.Text>
          );
        },
      }),
      columnHelper.accessor('images', {
        header: 'Gambar',
        size: 120,
        cell: (info) => {
          const images = info.getValue();
          if (!images.length) return <Typography.Text type="secondary">-</Typography.Text>;
          return (
            <Image.PreviewGroup>
              <Space size={4} wrap>
                {images.slice(0, 3).map((img) => (
                  <Image
                    key={img.provider_file_id}
                    src={previewImageUrl(img)}
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
        header: 'Dikirim',
        size: 160,
        cell: (info) => formatDateTime(info.getValue()),
      }),
      columnHelper.display({
        id: 'actions',
        header: 'Aksi',
        size: 80,
        meta: { fixed: 'right' },
        cell: (info) => (
          <Tooltip title="Detail">
            <Button
              type="link"
              icon={<ToolOutlined />}
              onClick={() =>
                navigate({
                  to: '/translation-helps/$id',
                  params: { id: info.row.original.id },
                })
              }
            />
          </Tooltip>
        ),
      }),
    ],
    [navigate],
  );

  const table = useReactTable({
    data: items,
    columns,
    getRowId: (row) => String(row.id),
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
  });

  if (!canModerate) {
    return (
      <Alert
        type="warning"
        showIcon
        message="Hanya admin, root, reviewer, dan editor yang dapat memoderasi tanya terjemahan."
      />
    );
  }

  return (
    <>
      <PageHeader
        title="Tanya Terjemahan"
        subtitle="Antrean pertanyaan terjemahan dari aplikasi."
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
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message="Gagal memuat data"
          description={error?.message}
        />
      ) : null}
      <DataTable
        table={table}
        rowKey={(record) => String(record.id)}
        loading={isLoading || (isFetching && !items.length)}
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
  );
}
