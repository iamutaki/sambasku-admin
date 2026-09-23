import { useState } from 'react';
import { Alert, App as AntdApp, Button, Descriptions, Input, Modal, Select, Space, Tag, Typography } from 'antd';
import { ReloadOutlined, RollbackOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from '@tanstack/react-router';
import { formatDateTime } from '@/shared/utils/format-datetime';
import { PageHeader } from '@/shared/components/page-header';
import { PageLoading } from '@/shared/components/page-loading';
import { UserInfoLink } from '@/shared/components/user-info-modal';
import { normalizeError } from '@/shared/api/error';
import { WORD_STATUS_LABELS, type TakedownReasonCode, type WordStatus } from '@/features/words/domain/word';
import { useWordReport } from '../application/use-word-report-list';
import {
  useDismissWordReport,
  useMarkWordReportCorrected,
  useTakedownFromReport,
} from '../application/use-resolve-word-report';
import {
  TAKEDOWN_REASON_CODES,
  TAKEDOWN_REASON_LABELS,
  WORD_REPORT_RESOLUTION_LABELS,
  noteRequired,
} from '../domain/word-report';

const { Paragraph, Text } = Typography;

export function WordReportDetailPage() {
  const { message } = AntdApp.useApp();
  const navigate = useNavigate();
  const { id } = useParams({ from: '/console-layout/word-reports/$id' });
  const query = useWordReport(id);
  const report = query.data;
  const dismiss = useDismissWordReport();
  const markCorrected = useMarkWordReportCorrected();
  const takedown = useTakedownFromReport();

  const [note, setNote] = useState('');
  const [takedownOpen, setTakedownOpen] = useState(false);
  const [reason, setReason] = useState<TakedownReasonCode>('inappropriate');
  const [takedownNote, setTakedownNote] = useState('');

  const busy = dismiss.isPending || markCorrected.isPending || takedown.isPending;
  const open = report?.status === 'open';

  const run = async (action: 'dismiss' | 'corrected') => {
    if (!report) return;
    try {
      if (action === 'dismiss') {
        await dismiss.mutateAsync({ id: report.id, note: note.trim() || undefined });
        message.success('Laporan ditolak. Entri tetap tayang.');
      } else {
        await markCorrected.mutateAsync({ id: report.id, note: note.trim() || undefined });
        message.success('Laporan ditutup. Entri tetap tayang.');
      }
      setNote('');
    } catch (err) {
      message.warning(normalizeError(err).message || 'Gagal menutup laporan');
    }
  };

  const submitTakedown = async () => {
    if (!report) return;
    if (noteRequired(reason) && takedownNote.trim().length === 0) {
      message.warning('Catatan wajib diisi untuk alasan ini');
      throw new Error('note');
    }
    try {
      await takedown.mutateAsync({
        id: report.id,
        reason_code: reason,
        note: takedownNote.trim() || undefined,
      });
      message.success(`Entri "${report.lemma}" ditarik dari kamus`);
      setTakedownOpen(false);
    } catch (err) {
      message.warning(normalizeError(err).message || 'Gagal menarik entri');
    }
  };

  if (query.isPending) return <PageLoading tip="Memuat laporan…" />;

  if (query.isError || !report) {
    return (
      <>
        <PageHeader title="Laporan Entri" subtitle="Gagal memuat laporan." />
        <Alert
          type="error"
          showIcon
          message="Laporan tidak ditemukan"
          description={query.error?.message}
          action={
            <Button onClick={() => navigate({ to: '/word-reports' })}>Kembali</Button>
          }
        />
      </>
    );
  }

  const wordStatus = report.word_status as WordStatus;

  return (
    <>
      <PageHeader
        title={report.lemma || 'Laporan entri'}
        subtitle="Keputusan ini tidak mengubah isi entri. Perbaikan isi lewat Ubah Kata."
        extra={
          <Space wrap>
            <Button icon={<ReloadOutlined />} onClick={() => query.refetch()} loading={query.isFetching}>
              Muat ulang
            </Button>
            <Button icon={<RollbackOutlined />} onClick={() => navigate({ to: '/word-reports' })}>
              Kembali
            </Button>
            <Button onClick={() => navigate({ to: '/words/$id', params: { id: report.word_id } })}>
              Buka kata
            </Button>
          </Space>
        }
      />
      <Descriptions column={{ xs: 1, md: 2 }} bordered size="small" style={{ marginBottom: 16 }}>
        <Descriptions.Item label="Alasan">{TAKEDOWN_REASON_LABELS[report.reason_code]}</Descriptions.Item>
        <Descriptions.Item label="Status kata">
          {WORD_STATUS_LABELS[wordStatus] ?? report.word_status}
        </Descriptions.Item>
        <Descriptions.Item label="Pelapor">
          {report.username ? <UserInfoLink username={report.username} /> : '—'}
        </Descriptions.Item>
        <Descriptions.Item label="Waktu">{formatDateTime(report.created_at)}</Descriptions.Item>
        <Descriptions.Item label="Status laporan" span={2}>
          <Tag color={report.status === 'open' ? 'orange' : 'default'}>
            {report.resolution
              ? WORD_REPORT_RESOLUTION_LABELS[report.resolution]
              : report.status === 'open'
                ? 'Terbuka'
                : 'Ditutup'}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="Catatan pelapor" span={2}>
          {report.note || <Text type="secondary">Tidak ada</Text>}
        </Descriptions.Item>
        {report.resolution_note ? (
          <Descriptions.Item label="Catatan keputusan" span={2}>
            {report.resolution_note}
          </Descriptions.Item>
        ) : null}
      </Descriptions>
      {open ? (
        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          <Paragraph type="secondary" style={{ margin: 0 }}>
            Tolak jika laporan tidak beralasan. Sudah diperbaiki jika kamu mengubah entri lewat halaman kata.
            Tarik entri jika lemma ini tidak layak tayang.
          </Paragraph>
          <Input.TextArea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Catatan keputusan (opsional)"
            rows={3}
            maxLength={1000}
          />
          <Space wrap>
            <Button disabled={busy} onClick={() => void run('dismiss')}>
              Tolak laporan
            </Button>
            <Button disabled={busy} onClick={() => void run('corrected')}>
              Sudah diperbaiki
            </Button>
            <Button danger disabled={busy || report.word_status !== 'published'} onClick={() => {
              setReason(report.reason_code);
              setTakedownNote(report.note ?? '');
              setTakedownOpen(true);
            }}>
              Tarik entri
            </Button>
          </Space>
        </Space>
      ) : null}
      <Modal
        title="Tarik entri"
        open={takedownOpen}
        onCancel={() => setTakedownOpen(false)}
        onOk={() => void submitTakedown()}
        confirmLoading={takedown.isPending}
        okText="Tarik"
        okButtonProps={{ danger: true }}
      >
        <Paragraph>
          <Text strong>{report.lemma}</Text> hilang dari pencarian dan halaman publik. Jejaknya tetap di konsol dan bisa dipulihkan.
        </Paragraph>
        <Select
          style={{ width: '100%', marginBottom: 12 }}
          value={reason}
          onChange={(value) => setReason(value)}
          options={TAKEDOWN_REASON_CODES.map((code) => ({
            value: code,
            label: TAKEDOWN_REASON_LABELS[code],
          }))}
        />
        <Input.TextArea
          value={takedownNote}
          onChange={(e) => setTakedownNote(e.target.value)}
          placeholder={noteRequired(reason) ? 'Catatan wajib' : 'Catatan opsional'}
          rows={3}
          maxLength={1000}
        />
      </Modal>
    </>
  );
}
