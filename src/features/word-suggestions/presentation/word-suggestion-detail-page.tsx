import { useState } from 'react';
import { App, Button, Card, Descriptions, Flex, Image, Input, Space, Tag, Typography } from 'antd';
import { useNavigate, useParams } from '@tanstack/react-router';
import { PageHeader } from '@/shared/components/page-header';
import { PageLoading } from '@/shared/components/page-loading';
import {
  useApproveWordSuggestion,
  useRejectWordSuggestion,
  useWordSuggestionDetail,
} from '../application/use-word-suggestion-actions';
import { REASON_CODE_LABELS, SUGGESTION_STATUS_LABELS } from '../domain/word-suggestion';

export function WordSuggestionDetailPage() {
  const { id } = useParams({ from: '/console-layout/word-suggestions/$id' });
  const navigate = useNavigate();
  const { message, modal } = App.useApp();
  const { data, isLoading, isError, error } = useWordSuggestionDetail(id);
  const approve = useApproveWordSuggestion();
  const reject = useRejectWordSuggestion();
  const [comment, setComment] = useState('');

  if (isLoading) return <PageLoading tip="Memuat usulan…" />;
  if (isError || !data) {
    return (
      <Typography.Text type="danger">
        {error instanceof Error ? error.message : 'Usulan tidak ditemukan'}
      </Typography.Text>
    );
  }

  const { suggestion, current_word, diff } = data;
  const pending = suggestion.status === 'pending';
  const hasMainDiff =
    diff.lemma.changed ||
    diff.notes.changed ||
    diff.meanings.length > 0 ||
    diff.categories.added.length + diff.categories.removed.length > 0 ||
    (diff.relations?.added.length ?? 0) + (diff.relations?.removed.length ?? 0) > 0 ||
    (diff.variants?.added.length ?? 0) + (diff.variants?.removed.length ?? 0) > 0 ||
    (diff.images?.added.length ?? 0) +
      (diff.images?.removed.length ?? 0) +
      (diff.images?.set_primary.length ?? 0) >
      0;

  const onApprove = () => {
    modal.confirm({
      title: 'Setujui usulan?',
      content: 'Perubahan akan langsung diterapkan ke kata tayang.',
      onOk: async () => {
        await approve.mutateAsync({ id, comment: comment || undefined });
        message.success('Usulan disetujui');
        void navigate({ to: '/word-suggestions' });
      },
    });
  };

  const onReject = () => {
    if (!comment.trim()) {
      message.warning('Alasan penolakan wajib diisi');
      return;
    }
    modal.confirm({
      title: 'Tolak usulan?',
      onOk: async () => {
        await reject.mutateAsync({ id, comment: comment.trim() });
        message.success('Usulan ditolak');
        void navigate({ to: '/word-suggestions' });
      },
    });
  };

  return (
    <Flex vertical gap={16}>
      <PageHeader
        title={`Usul: ${suggestion.word_lemma}`}
        subtitle={`Status: ${SUGGESTION_STATUS_LABELS[suggestion.status]}`}
        extra={
          <Button onClick={() => void navigate({ to: '/word-suggestions' })}>Kembali</Button>
        }
      />

      <Card title="Ringkasan">
        <Descriptions column={1} size="small">
          <Descriptions.Item label="Kontributor">
            {suggestion.contributor_username ?? suggestion.contributor_id}
          </Descriptions.Item>
          <Descriptions.Item label="Alasan">
            <Space>
              <Tag>{REASON_CODE_LABELS[suggestion.reason_code] ?? suggestion.reason_code}</Tag>
              <span>{suggestion.reason}</span>
            </Space>
          </Descriptions.Item>
          <Descriptions.Item label="Diajukan">{suggestion.created_at}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title="Diff">
        {diff.lemma.changed && (
          <Typography.Paragraph>
            Lemma: <Typography.Text delete>{diff.lemma.current}</Typography.Text> →{' '}
            <Typography.Text strong>{diff.lemma.proposed}</Typography.Text>
          </Typography.Paragraph>
        )}
        {diff.notes.changed && (
          <Typography.Paragraph>
            Catatan: <Typography.Text delete>{diff.notes.current ?? '-'}</Typography.Text> →{' '}
            <Typography.Text strong>{diff.notes.proposed ?? '-'}</Typography.Text>
          </Typography.Paragraph>
        )}
        {diff.meanings.map((m, i) => (
          <Typography.Paragraph key={i}>
            Makna {m.meaning_id ?? '(baru)'}:
            {m.changes.map((ch, j) => (
              <span key={j}>
                {' '}
                {ch.current ?? '-'} → {ch.proposed ?? '-'}
              </span>
            ))}
          </Typography.Paragraph>
        ))}
        {(diff.categories.added.length > 0 || diff.categories.removed.length > 0) && (
          <Typography.Paragraph>
            Kategori: +{diff.categories.added.length} / −{diff.categories.removed.length}
          </Typography.Paragraph>
        )}
        {diff.relations &&
          (diff.relations.added.length > 0 || diff.relations.removed.length > 0) && (
            <Typography.Paragraph>
              Relasi:{' '}
              {diff.relations.added.map((r, i) => (
                <Tag key={`a-${i}`} color="green">
                  +{r.relation_type} {r.lemma ?? r.word_id}
                </Tag>
              ))}
              {diff.relations.removed.map((r, i) => (
                <Tag key={`r-${i}`} color="red">
                  −{r.relation_type} {r.lemma ?? r.word_id}
                </Tag>
              ))}
            </Typography.Paragraph>
          )}
        {diff.variants &&
          (diff.variants.added.length > 0 || diff.variants.removed.length > 0) && (
            <Typography.Paragraph>
              Varian:{' '}
              {diff.variants.added.map((v, i) => (
                <Tag key={`va-${i}`} color="green">
                  +{v.form}
                </Tag>
              ))}
              {diff.variants.removed.map((v, i) => (
                <Tag key={`vr-${i}`} color="red">
                  −{v.form}
                </Tag>
              ))}
            </Typography.Paragraph>
          )}
        {diff.images && (
          <>
            {diff.images.added.length > 0 && (
              <Image.PreviewGroup>
                <Flex gap={8} wrap="wrap" style={{ marginBottom: 8 }}>
                  {diff.images.added.map((img, i) => (
                    <Image key={i} src={img.url} width={72} height={72} style={{ objectFit: 'cover' }} />
                  ))}
                </Flex>
              </Image.PreviewGroup>
            )}
            {diff.images.removed.length > 0 && (
              <Typography.Paragraph type="secondary">
                Hapus gambar: {diff.images.removed.map((i) => i.image_id).join(', ')}
              </Typography.Paragraph>
            )}
            {diff.images.set_primary.length > 0 && (
              <Typography.Paragraph type="secondary">
                Set primary: {diff.images.set_primary.map((i) => i.image_id).join(', ')}
              </Typography.Paragraph>
            )}
          </>
        )}
        {!hasMainDiff && (
          <Typography.Text type="secondary">
            Tidak ada diff field utama (cek proposed_changes mentah).
          </Typography.Text>
        )}
        <Typography.Paragraph type="secondary" style={{ marginTop: 8 }}>
          Kata saat ini: {current_word.lemma} / {current_word.meanings.length} makna /{' '}
          {current_word.relations?.length ?? 0} relasi / {current_word.variants?.length ?? 0}{' '}
          varian / {current_word.images?.length ?? 0} gambar
        </Typography.Paragraph>
        <pre style={{ fontSize: 12, overflow: 'auto', maxHeight: 200 }}>
          {JSON.stringify(suggestion.proposed_changes, null, 2)}
        </pre>
      </Card>

      {pending && (
        <Card title="Keputusan">
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Input.TextArea
              rows={3}
              placeholder="Komentar (wajib untuk tolak)"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
            <Space>
              <Button type="primary" loading={approve.isPending} onClick={onApprove}>
                Setujui
              </Button>
              <Button danger loading={reject.isPending} onClick={onReject}>
                Tolak
              </Button>
            </Space>
          </Space>
        </Card>
      )}
    </Flex>
  );
}
