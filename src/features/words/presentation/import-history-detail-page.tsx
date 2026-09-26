import { Alert, Button, Descriptions, Flex, Table, Tag, Typography } from 'antd';
import { DownloadOutlined, RollbackOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from '@tanstack/react-router';
import { formatDateTime } from '@/shared/utils/format-datetime';
import { PageHeader } from '@/shared/components/page-header';
import { PageLoading } from '@/shared/components/page-loading';
import { useImportSession } from '../application/use-import-sessions';
import type { WordImportSessionStatus } from '../infrastructure/word-api';

const STATUS_LABEL: Record<WordImportSessionStatus, string> = {
  running: 'Berjalan',
  completed: 'Selesai',
  cancelled: 'Dibatalkan',
  failed: 'Gagal',
};

const STATUS_COLOR: Record<WordImportSessionStatus, string> = {
  running: 'processing',
  completed: 'success',
  cancelled: 'warning',
  failed: 'error',
};

const OUTCOME_LABEL: Record<string, string> = {
  created: 'Kata baru',
  meanings_added: 'Makna ditambah',
  skipped: 'Duplikat dilewati',
  invalid: 'Tidak valid',
};

export function ImportHistoryDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams({ from: '/console-layout/words/import-history/$id' });
  const query = useImportSession(id);
  const session = query.data;

  const downloadReport = () => {
    if (!session) return;
    const lines = [
      'lemma,hasil,pesan',
      ...session.items.map((item) =>
        [item.lemma, item.outcome, item.message ?? '']
          .map((cell) => `"${cell.replaceAll('"', '""')}"`)
          .join(','),
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `laporan-import-${session.id}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (query.isPending) return <PageLoading tip="Memuat sesi impor…" />;

  if (query.isError || !session) {
    return (
      <>
        <PageHeader title="Detail impor" />
        <Alert
          type="error"
          showIcon
          message="Sesi impor tidak ditemukan"
          description={query.error?.message}
          action={
            <Button onClick={() => navigate({ to: '/words/import-history' })}>Kembali</Button>
          }
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={session.source_label || 'Sesi impor'}
        subtitle={`Atribusi: ${session.attributed_to_username ?? 'Pengimpor Data CSV'}`}
        extra={
          <Flex gap={8}>
            <Button icon={<RollbackOutlined />} onClick={() => navigate({ to: '/words/import-history' })}>
              Riwayat
            </Button>
            <Button type="primary" icon={<DownloadOutlined />} onClick={downloadReport}>
              Unduh CSV
            </Button>
          </Flex>
        }
      />

      <Descriptions
        bordered
        size="small"
        column={{ xs: 1, sm: 2, md: 3 }}
        style={{ marginBottom: 16 }}
      >
        <Descriptions.Item label="Status">
          <Tag color={STATUS_COLOR[session.status]}>{STATUS_LABEL[session.status]}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="Waktu">
          {formatDateTime(session.finished_at ?? session.created_at)}
        </Descriptions.Item>
        <Descriptions.Item label="Atribusi">
          {session.attributed_to_username || 'Pengimpor Data CSV'}
        </Descriptions.Item>
        <Descriptions.Item label="Total">{session.total}</Descriptions.Item>
        <Descriptions.Item label="Kata baru">{session.created_count}</Descriptions.Item>
        <Descriptions.Item label="Duplikat">{session.duplicates_count}</Descriptions.Item>
        <Descriptions.Item label="Makna ditambah">{session.meanings_added_count}</Descriptions.Item>
        <Descriptions.Item label="Tidak valid">{session.invalid_count}</Descriptions.Item>
      </Descriptions>

      <Typography.Title level={5} style={{ marginTop: 0 }}>
        Item
      </Typography.Title>
      <Table
        size="small"
        rowKey={(row) => `${row.lemma}-${row.outcome}`}
        pagination={{ pageSize: 50, hideOnSinglePage: true }}
        dataSource={session.items}
        columns={[
          { title: 'Lemma', dataIndex: 'lemma', width: 200 },
          {
            title: 'Hasil',
            dataIndex: 'outcome',
            width: 160,
            render: (value: string) => OUTCOME_LABEL[value] ?? value,
          },
          {
            title: 'Makna+',
            dataIndex: 'meanings_added',
            width: 90,
          },
          {
            title: 'Pesan',
            dataIndex: 'message',
            render: (value?: string) => value || '-',
          },
        ]}
      />
    </>
  );
}
