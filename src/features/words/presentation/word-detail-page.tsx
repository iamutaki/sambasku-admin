import { useMemo } from 'react';
import {
  AFFIX_TYPE_LABELS,
  EXAMPLE_SOURCE_LABELS,
  RELATION_TYPE_LABELS,
  TRANSLATION_TYPE_LABELS,
  VARIANT_TYPE_LABELS,
} from '../domain/create-word';
import { Alert, App as AntdApp, Button, Descriptions, Flex, Image, Input, Modal, Select, Space, Switch, Tag, Tooltip, Typography } from 'antd';
import { EditOutlined, ReloadOutlined, RollbackOutlined } from '@ant-design/icons';
import { formatDateTime } from '@/shared/utils/format-datetime';
import { displayImageUrl } from '@/shared/utils/display-image-url';
import { useNavigate, useParams } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/shared/components/page-header';
import { PageLoading } from '@/shared/components/page-loading';
import { useAuth } from '@/shared/auth/use-auth';
import {
  TAKEDOWN_REASON_CODES,
  TAKEDOWN_REASON_LABELS,
  WORD_STATUS_LABELS,
  WORD_TYPE_LABELS,
  USAGE_LABEL_LABELS,
  type TakedownReasonCode,
  type UsageLabel,
  type WordStatus,
} from '../domain/word';
import { useRestoreWord, useTakedownWord } from '../application/use-word-takedown';
import { useWordDetail } from '../application/use-word-detail';
import { useDialectOptions, useLanguageOptions } from '../application/use-reference-data';
import { useVerifyWord, useUnverifyWord } from '../application/use-word-verify';
import { usePublishWord, useUnpublishWord } from '../application/use-word-publish';
import { normalizeError } from '@/shared/api/error';
import { WordVoteCount } from '@/features/votes/presentation/word-vote-count';
import { WordComments } from '@/features/comments/presentation/word-comments';
import type { WordDetail } from '../domain/word-detail';
import { useState } from 'react';
import {
  WordExampleAudiosSection,
  WordLemmaAudiosSection,
} from './word-form-blocks';

const { Text, Paragraph } = Typography;

const STATUS_TAG_COLOR: Record<WordStatus, string> = {
  draft: 'default',
  pending_review: 'orange',
  published: 'green',
  rejected: 'red',
  taken_down: 'magenta',
};

function StatusTag({ status }: { status: WordStatus }) {
  return <Tag color={STATUS_TAG_COLOR[status]}>{WORD_STATUS_LABELS[status]}</Tag>;
}

/**
 * Halaman Detail Kata (read-only) - /words/:id. Ringkasan penuh satu entri
 * untuk SEMUA status (draft/pending_review/published/rejected) via
 * GET /api/v1/admin/words/:id (docs/admin/03 → halaman yang MENGAWALI edit:
 * baca status dulu, baru pilih "Ubah").
 *
 * Kontributor tidak bisa membuka detail admin (endpoint role verifikator) -
 * sama seperti Edit kata: tombol disembunyikan dan navigasi manual menampilkan 403.
 */
export function WordDetailPage() {
  const { message } = AntdApp.useApp();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { id } = useParams({ from: '/console-layout/words/$id' });

  const isContributor = user?.role === 'contributor';
  const canVerify = user?.role === 'root' || user?.role === 'admin' || user?.role === 'reviewer';
  const detailQuery = useWordDetail(id, { enabled: !isContributor });
  const detail = detailQuery.data;
  const refreshing = detailQuery.isFetching && !detailQuery.isPending;

  const refreshPage = () => {
    void detailQuery.refetch();
    void queryClient.invalidateQueries({ queryKey: ['comments', 'word', id] });
    void queryClient.invalidateQueries({ queryKey: ['votes', 'counts'] });
  };
  const verifyWord = useVerifyWord();
  const unverifyWord = useUnverifyWord();
  const publishWord = usePublishWord();
  const unpublishWord = useUnpublishWord();
  const [publishing, setPublishing] = useState(false);
  const takedownWord = useTakedownWord();
  const restoreWord = useRestoreWord();
  const [takedownOpen, setTakedownOpen] = useState(false);
  const [reason, setReason] = useState<TakedownReasonCode>('inappropriate');
  const [takedownNote, setTakedownNote] = useState('');

  // Nama bahasa/dialek di-resolve dari data referensi (respons detail hanya
  // membawa id). Bahasa lead = bahasa kata, dialek anak dihitung dari situ.
  const languageQuery = useLanguageOptions();
  const dialectQuery = useDialectOptions(detail?.language_id);

  const languageName = useMemo(() => {
    const found = (languageQuery.data ?? []).find((l) => l.id === detail?.language_id);
    return found ? `${found.name} (${found.code})` : detail?.language_id ?? '-';
  }, [languageQuery.data, detail?.language_id]);

  const dialectName = useMemo(() => {
    const byId = new Map((dialectQuery.data ?? []).map((d) => [d.id, d.name]));
    return (dialectId: string | null | undefined) =>
      dialectId ? byId.get(dialectId) ?? dialectId : 'Umum / tidak ada';
  }, [dialectQuery.data]);

  const translationLanguageName = useMemo(() => {
    const byId = new Map((languageQuery.data ?? []).map((l) => [l.id, `${l.name} (${l.code})`]));
    return (languageId: string) => byId.get(languageId) ?? languageId;
  }, [languageQuery.data]);

  if (isContributor) {
    return (
      <>
        <PageHeader title="Detail Kata" subtitle="Akses terbatas untuk verifikator." />
        <Alert
          type="error"
          showIcon
          message="403 - Akses ditolak"
          description="Kontributor tidak dapat membuka detail entri existing. Perubahan atas entri yang sudah ada lewat jalur kontribusi (antrean review)."
          action={
            <Button onClick={() => navigate({ to: '/words' })} style={{ whiteSpace: 'nowrap' }}>
              Kembali ke Daftar
            </Button>
          }
        />
      </>
    );
  }

  if (detailQuery.isPending) {
    return <PageLoading tip="Memuat detail kata…" />;
  }

  if (detailQuery.isError || !detail) {
    return (
      <>
        <PageHeader
          title="Detail Kata"
          subtitle="Gagal memuat detail kata."
          extra={
            <Button icon={<ReloadOutlined />} onClick={() => refreshPage()} loading={refreshing}>
              Muat ulang
            </Button>
          }
        />
        <Alert
          type="error"
          showIcon
          message="Tidak dapat membuka kata ini"
          description={detailQuery.error?.message ?? 'Kata tidak ditemukan atau akses ditolak.'}
          action={
            <Space>
              <Button icon={<ReloadOutlined />} onClick={() => refreshPage()} loading={refreshing}>
                Coba lagi
              </Button>
              <Button onClick={() => navigate({ to: '/words' })} style={{ whiteSpace: 'nowrap' }}>
                Kembali ke Daftar
              </Button>
            </Space>
          }
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={<span>
          <Text>{detail.lemma}</Text> <StatusTag status={detail.status} />
        </span>}
        subtitle={`${WORD_TYPE_LABELS[detail.word_type] ?? detail.word_type} · ${languageName}`}
        extra={
          <Space wrap>
            <Button icon={<ReloadOutlined />} onClick={() => refreshPage()} loading={refreshing}>
              Muat ulang
            </Button>
            <Button icon={<RollbackOutlined />} onClick={() => navigate({ to: '/words' })}>
              Kembali ke Daftar
            </Button>
            {canVerify ? (
              <Space size={8}>
                <Text type="secondary">Tayang</Text>
                <Tooltip title={detail.status === 'taken_down' ? 'Entri ditarik. Gunakan Pulihkan.' : undefined}>
                <Switch
                  checked={detail.status === 'published'}
                  disabled={detail.status === 'taken_down'}
                  loading={publishing}
                  onChange={async (next) => {
                    setPublishing(true);
                    try {
                      if (next) {
                        await publishWord.mutateAsync(detail.id, {
                          onSuccess: (data) => {
                            if (data?.merged_into_word_id) {
                              message.success(
                                `Makna digabung ke kata "${detail.lemma}" yang sudah tayang`,
                              );
                              void navigate({
                                to: '/words/$id',
                                params: { id: data.merged_into_word_id },
                              });
                            } else {
                              message.success(`Kata "${detail.lemma}" ditayangkan`);
                            }
                          },
                          onError: (err) =>
                            message.warning(normalizeError(err).message || 'Gagal menayangkan'),
                        });
                      } else {
                        await unpublishWord.mutateAsync(detail.id, {
                          onSuccess: () => message.success(`Kata "${detail.lemma}" ditarik dari tayang`),
                          onError: (err) =>
                            message.warning(normalizeError(err).message || 'Gagal menarik tayang'),
                        });
                      }
                    } catch {
                      // Handled.
                    } finally {
                      setPublishing(false);
                    }
                  }}
                />
                </Tooltip>
              </Space>
            ) : null}
            {detail.status === 'published' ? (
              <Button danger onClick={() => setTakedownOpen(true)}>
                Tarik entri
              </Button>
            ) : null}
            {detail.status === 'taken_down' ? (
              <Button
                loading={restoreWord.isPending}
                onClick={async () => {
                  try {
                    await restoreWord.mutateAsync(detail.id);
                    message.success(`Kata "${detail.lemma}" dipulihkan`);
                  } catch (err) {
                    message.warning(normalizeError(err).message || 'Gagal memulihkan');
                  }
                }}
              >
                Pulihkan
              </Button>
            ) : null}
            {canVerify ? (
              <Tooltip title={detail.status !== 'published' ? 'Hanya kata tayang yang bisa diverifikasi' : undefined}>
                <Space size={8}>
                  <Text type="secondary">Terverifikasi</Text>
                  <Switch
                    checked={detail.is_verified}
                    disabled={detail.status !== 'published'}
                    loading={
                      (verifyWord.isPending && verifyWord.variables === detail.id) ||
                      (unverifyWord.isPending && unverifyWord.variables === detail.id)
                    }
                    onChange={async (next) => {
                      try {
                        if (next) {
                          await verifyWord.mutateAsync(detail.id, {
                            onSuccess: () => message.success(`Kata "${detail.lemma}" diverifikasi`),
                            onError: (err) =>
                              message.warning(normalizeError(err).message || 'Gagal verifikasi'),
                          });
                        } else {
                          await unverifyWord.mutateAsync(detail.id, {
                            onSuccess: () =>
                              message.success(`Kata "${detail.lemma}" batal diverifikasi`),
                            onError: (err) => message.warning(normalizeError(err).message || 'Gagal'),
                          });
                        }
                      } catch {
                        // Handled.
                      }
                    }}
                  />
                </Space>
              </Tooltip>
            ) : null}
            <Button
              type="primary"
              icon={<EditOutlined />}
              onClick={() => navigate({ to: '/words/$id/edit', params: { id } })}
            >
              Ubah Kata
            </Button>
          </Space>
        }
      />
      <WordDetailContent
        detail={detail}
        languageName={languageName}
        dialectName={dialectName}
        translationLanguageName={translationLanguageName}
        dialectOptions={(dialectQuery.data ?? []).map((d) => ({
          value: d.id,
          label: d.name,
        }))}
        defaultDialectId={
          (dialectQuery.data ?? []).find((d) => d.is_default)?.id ?? null
        }
        onAudiosChanged={refreshPage}
      />
      <Modal
        title="Tarik entri"
        open={takedownOpen}
        onCancel={() => setTakedownOpen(false)}
        confirmLoading={takedownWord.isPending}
        okText="Tarik"
        okButtonProps={{ danger: true }}
        onOk={async () => {
          const needsNote = reason === 'other' || reason === 'duplicate';
          if (needsNote && takedownNote.trim().length === 0) {
            message.warning('Catatan wajib diisi untuk alasan ini');
            return Promise.reject(new Error('note'));
          }
          try {
            await takedownWord.mutateAsync({
              id: detail.id,
              reason_code: reason,
              note: takedownNote.trim() || undefined,
            });
            message.success(`Kata "${detail.lemma}" ditarik dari kamus`);
            setTakedownOpen(false);
          } catch (err) {
            message.warning(normalizeError(err).message || 'Gagal menarik entri');
          }
        }}
      >
        <Typography.Paragraph>
          <Text strong>{detail.lemma}</Text> hilang dari pencarian dan halaman publik. Jejaknya tetap di konsol dan bisa dipulihkan.
        </Typography.Paragraph>
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
          placeholder={reason === 'other' || reason === 'duplicate' ? 'Catatan wajib' : 'Catatan opsional'}
          rows={3}
          maxLength={1000}
        />
      </Modal>
    </>
  );
}

function WordDetailContent({
  detail,
  languageName,
  dialectName,
  translationLanguageName,
  dialectOptions,
  defaultDialectId,
  onAudiosChanged,
}: {
  detail: WordDetail;
  languageName: string;
  dialectName: (dialectId: string | null | undefined) => string;
  translationLanguageName: (languageId: string) => string;
  dialectOptions: { value: string; label: string }[];
  defaultDialectId?: string | null;
  onAudiosChanged: () => void;
}) {
  const [verifierOpen, setVerifierOpen] = useState(false);
  const basics = [
    {
      key: 'language',
      label: 'Bahasa',
      children: languageName,
    },
    {
      key: 'status',
      label: 'Status',
      children: <StatusTag status={detail.status} />,
    },
    {
      key: 'flags',
      label: 'Tanda',
      children: (
        <Space size={4} wrap>
          {detail.is_verified ? (
            <Tag color="cyan" style={{ cursor: 'pointer' }} onClick={() => setVerifierOpen(true)}>
              Terverifikasi
            </Tag>
          ) : (
            <Tag>Belum diverifikasi</Tag>
          )}
          {detail.is_corrected ? <Tag color="blue">Sudah dikoreksi</Tag> : null}
        </Space>
      ),
    },
    {
      key: 'created',
      label: 'Dibuat',
      children: formatDateTime(detail.created_at),
    },
    {
      key: 'creator',
      label: 'Kontributor',
      children: detail.created_by ? (
        detail.verified_by?.username === detail.created_by.username ? (
          <Space size={6} wrap>
            <span>Dibuat dan diverifikasi oleh {detail.created_by.username}</span>
            {['admin', 'editor', 'root', 'reviewer'].includes(detail.verified_by?.role ?? '') ? (
              <Tag color="cyan">Verifikator</Tag>
            ) : null}
          </Space>
        ) : (
          `Dibuat oleh ${detail.created_by.username}`
        )
      ) : (
        '-'
      ),
    },
    {
      key: 'updated',
      label: 'Diperbarui',
      children: detail.updated_at ? formatDateTime(detail.updated_at) : '-',
    },
    ...(detail.takedown_reason_code
      ? [
          {
            key: 'takedown',
            label: 'Alasan ditarik',
            children: (
              <span>
                {TAKEDOWN_REASON_LABELS[detail.takedown_reason_code as TakedownReasonCode] ??
                  detail.takedown_reason_code}
                {detail.takedown_note ? ` - ${detail.takedown_note}` : ''}
                {detail.taken_down_at ? ` (${formatDateTime(detail.taken_down_at)})` : ''}
              </span>
            ),
          },
        ]
      : []),
  ];

  return (
    <Space direction="vertical" size={20} style={{ width: '100%' }}>
      <Modal
        title="Verifikator"
        open={verifierOpen}
        onCancel={() => setVerifierOpen(false)}
        footer={null}
      >
        {detail.created_by || detail.verified_by ? (
          <Space direction="vertical" size={4}>
            {detail.created_by &&
            detail.verified_by &&
            detail.created_by.username === detail.verified_by.username ? (
              <Space size={6} wrap>
                <Text>Dibuat dan diverifikasi oleh {detail.created_by.username}</Text>
                {['admin', 'editor', 'root', 'reviewer'].includes(detail.verified_by.role) ? (
                  <Tag color="cyan">Verifikator</Tag>
                ) : null}
              </Space>
            ) : (
              <>
                {detail.created_by ? (
                  <Text>Dibuat oleh {detail.created_by.username}</Text>
                ) : null}
                {detail.verified_by ? (
                  <Text>Diverifikasi oleh {detail.verified_by.username}</Text>
                ) : null}
              </>
            )}
            {detail.verified_at ? (
              <Text type="secondary">{formatDateTime(detail.verified_at)}</Text>
            ) : null}
          </Space>
        ) : (
          <Text>Verifikator tidak diketahui</Text>
        )}
      </Modal>
      {/* 1. Informasi dasar */}
      <Descriptions size="small" column={{ xs: 1, md: 2 }} bordered items={basics} />

      {/* 1b. Vote kata (read-only - counts publik, tanpa tombol vote) */}
      <div>
        <Text strong style={{ display: 'block', marginBottom: 8 }}>
          Vote
        </Text>
        <WordVoteCount wordId={detail.id} />
      </div>

      {detail.notes ? (
        <div>
          <Text strong style={{ display: 'block', marginBottom: 8 }}>
            Catatan Tambahan
          </Text>
          <Paragraph>{detail.notes}</Paragraph>
        </div>
      ) : null}

      {/* 2. Makna / arti */}
      <div>
        <Text strong style={{ display: 'block', marginBottom: 8 }}>
          Makna / Arti ({detail.meanings?.length ?? 0})
        </Text>
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          {(detail.meanings ?? []).map((meaning) => (
            <div key={meaning.id}>
              <Flex justify="space-between" align="baseline" wrap gap={8}>
                <Space size={6} wrap>
                  <Text strong>
                    {meaning.word_class
                      ? meaning.word_class.alias
                        ? `${meaning.word_class.name} (${meaning.word_class.alias})`
                        : meaning.word_class.name
                      : 'Makna'}
                  </Text>
                </Space>
                {meaning.order_index ? <Text type="secondary">Urutan {meaning.order_index}</Text> : null}
              </Flex>
              <Paragraph style={{ marginBottom: 4 }}>
                {meaning.definition == null || meaning.definition === '-' ? (
                  <Tag>Belum ada definisi</Tag>
                ) : (
                  meaning.definition
                )}
              </Paragraph>

              {(meaning.translations ?? []).length ? (
                <Space direction="vertical" size={0}>
                  {(meaning.translations ?? []).map((t, i) => (
                    <Text type="secondary" key={i}>
                      • {t.translation_text}
                      {' · '}
                      {translationLanguageName(t.language_id)}
                      {t.translation_type
                        ? ` (${TRANSLATION_TYPE_LABELS[t.translation_type as keyof typeof TRANSLATION_TYPE_LABELS] ?? t.translation_type})`
                        : ''}
                    </Text>
                  ))}
                </Space>
              ) : (
                <Tag>Belum ada terjemahan</Tag>
              )}

              {(meaning.examples ?? []).length ? (
                <Space direction="vertical" size={8} style={{ marginTop: 4 }}>
                  {(meaning.examples ?? []).map((e) => (
                    <div key={e.id}>
                      <Text italic>“{e.source_sentence}”</Text>
                      {e.target_sentence ? <Text type="secondary"> - {e.target_sentence}</Text> : null}
                      {e.source_type ? (
                        <Text type="secondary">
                          {' '}
                          ({EXAMPLE_SOURCE_LABELS[e.source_type as keyof typeof EXAMPLE_SOURCE_LABELS] ?? e.source_type})
                        </Text>
                      ) : null}
                      {(e.audios ?? []).map((a) => (
                        <Flex key={a.id} gap={8} align="center" wrap style={{ marginTop: 4 }}>
                          <audio
                            controls
                            src={a.url}
                            preload="metadata"
                            style={{ height: 32, maxWidth: 360 }}
                          />
                          {a.speaker_name?.trim() ? (
                            <Text type="secondary">{a.speaker_name}</Text>
                          ) : null}
                        </Flex>
                      ))}
                    </div>
                  ))}
                </Space>
              ) : (
                <Text type="secondary" style={{ display: 'block', marginTop: 4 }}>
                  Belum ada contoh kalimat
                </Text>
              )}
            </div>
          ))}
        </Space>
      </div>

      {/* 3. Kategori */}
      <div>
        <Text strong style={{ display: 'block', marginBottom: 8 }}>
          Kategori / Glosarium
        </Text>
        {(detail.categories ?? []).length ? (
          <Space size={4} wrap>
            {(detail.categories ?? []).map((c) => (
              <Tag key={c.id}>{c.name}</Tag>
            ))}
          </Space>
        ) : (
          <Text type="secondary">Tidak ada</Text>
        )}
      </div>

      {/* 3b. Register & peringatan */}
      <div>
        <Text strong style={{ display: 'block', marginBottom: 8 }}>
          Register & peringatan
        </Text>
        {(detail.usage_labels ?? []).length ? (
          <Space size={4} wrap>
            {(detail.usage_labels ?? []).map((code) => (
              <Tag
                key={code}
                color={
                  code === 'kasar' || code === 'tabu' || code === 'seksual' || code === 'diskriminatif'
                    ? 'volcano'
                    : 'default'
                }
              >
                {USAGE_LABEL_LABELS[code as UsageLabel] ?? code}
              </Tag>
            ))}
          </Space>
        ) : (
          <Text type="secondary">Tidak ada</Text>
        )}
      </div>

      {/* 4. Relasi */}
      <div>
        <Text strong style={{ display: 'block', marginBottom: 8 }}>
          Relasi Kata
        </Text>
        {(detail.related_words ?? []).length ? (
          <Space direction="vertical" size={4}>
            {(detail.related_words ?? []).map((rel, i) => (
              <div key={i}>
                <Text>{rel.lemma}</Text>{' '}
                <Text type="secondary">
                  ({RELATION_TYPE_LABELS[rel.relation_type as keyof typeof RELATION_TYPE_LABELS] ?? rel.relation_type})
                </Text>
              </div>
            ))}
          </Space>
        ) : (
          <Text type="secondary">Tidak ada</Text>
        )}
      </div>

      {(detail.appears_in ?? []).length ? (
        <div>
          <Text strong style={{ display: 'block', marginBottom: 8 }}>
            Muncul dalam
          </Text>
          <Space direction="vertical" size={4}>
            {(detail.appears_in ?? []).map((rel, i) => (
              <div key={i}>
                <Text>{rel.lemma}</Text>{' '}
                <Text type="secondary">
                  ({RELATION_TYPE_LABELS[rel.relation_type as keyof typeof RELATION_TYPE_LABELS] ?? rel.relation_type})
                </Text>
              </div>
            ))}
          </Space>
        </div>
      ) : null}

      {/* 5. Variasi penulisan & bentuk turunan (11) */}
      <div>
        <Text strong style={{ display: 'block', marginBottom: 8 }}>
          {(detail.variants ?? []).every((v) => v.variant_type === 'alternative')
            ? 'Variasi Penulisan'
            : 'Variasi & Bentuk Turunan'}
        </Text>
        {(detail.variants ?? []).length ? (
          <Space direction="vertical" size={4}>
            {(detail.variants ?? []).map((v) => (
              <div key={v.id}>
                {v.variant_type === 'alternative' ? (
                  <Tag color="blue">{v.form}</Tag>
                ) : (
                  <Text>{v.form}</Text>
                )}{' '}
                <Text type="secondary">
                  ({VARIANT_TYPE_LABELS[v.variant_type as keyof typeof VARIANT_TYPE_LABELS] ?? v.variant_type}
                  {v.affix_type ? `, ${AFFIX_TYPE_LABELS[v.affix_type as keyof typeof AFFIX_TYPE_LABELS] ?? v.affix_type}` : ''}
                  {v.affix_value ? ` "${v.affix_value}"` : ''}
                  {v.dialect_id ? `, ${dialectName(v.dialect_id)}` : ''}
                  {v.notes ? ` - ${v.notes}` : ''})
                </Text>
              </div>
            ))}
          </Space>
        ) : (
          <Text type="secondary">Tidak ada</Text>
        )}
      </div>

      {/* 6. Pengucapan */}
      <div>
        <Text strong style={{ display: 'block', marginBottom: 8 }}>
          Pengucapan
        </Text>
        {(detail.pronunciations ?? []).length ? (
          <Space direction="vertical" size={4}>
            {(detail.pronunciations ?? []).map((p) => (
              <div key={p.id}>
                <Text code>{p.value}</Text>
                <Space size={6} wrap style={{ marginLeft: 8 }}>
                  {p.notation ? <Text type="secondary">/{p.notation}/</Text> : null}
                  <Text type="secondary">({dialectName(p.dialect_id)})</Text>
                </Space>
              </div>
            ))}
          </Space>
        ) : (
          <Text type="secondary">Tidak ada notasi</Text>
        )}
        <div style={{ marginTop: 12 }}>
          <Text strong style={{ display: 'block', marginBottom: 8 }}>
            Audio pelafalan lemma (kata)
          </Text>
          <WordLemmaAudiosSection
            wordId={detail.id}
            lemma={detail.lemma}
            audios={detail.audios ?? []}
            dialectLabel={dialectName}
            dialectOptions={dialectOptions}
            defaultDialectId={defaultDialectId}
            onUploaded={onAudiosChanged}
          />
        </div>
        <div style={{ marginTop: 20 }}>
          <Text strong style={{ display: 'block', marginBottom: 8 }}>
            Audio pelafalan contoh kalimat
          </Text>
          <WordExampleAudiosSection
            wordId={detail.id}
            lemma={detail.lemma}
            examples={(detail.meanings ?? []).flatMap((m) =>
              (m.examples ?? []).map((e) => ({
                id: e.id,
                source_sentence: e.source_sentence,
                target_sentence: e.target_sentence,
                audios: e.audios,
              })),
            )}
            audios={detail.audios ?? []}
            dialectLabel={dialectName}
            dialectOptions={dialectOptions}
            defaultDialectId={defaultDialectId}
            onUploaded={onAudiosChanged}
          />
        </div>
      </div>

      {/* 7. Gambar */}
      <div>
        <Text strong style={{ display: 'block', marginBottom: 8 }}>
          Gambar
        </Text>
        {(detail.images ?? []).length ? (
          <Image.PreviewGroup>
            <Space direction="vertical" size={8}>
              {(detail.images ?? []).map((img) => (
                <Flex key={img.id} align="center" gap={8} wrap>
                  <Image
                    src={displayImageUrl(img.url, { width: 800 }) ?? img.url}
                    fallback={img.url}
                    alt={img.alt_text ?? detail.lemma}
                    height={48}
                    style={{ borderRadius: 6, objectFit: 'cover' }}
                  />
                  <Space size={4} wrap>
                    {img.is_primary ? <Tag color="geekblue">Utama</Tag> : null}
                    {img.alt_text ? <Text type="secondary">{img.alt_text}</Text> : null}
                  </Space>
                </Flex>
              ))}
            </Space>
          </Image.PreviewGroup>
        ) : (
          <Text type="secondary">Tidak ada</Text>
        )}
      </div>

      {/* 8. Komentar - semua status + moderasi inline (docs/admin/06) */}
      <div>
        <Text strong style={{ display: 'block', marginBottom: 8 }}>
          Komentar
        </Text>
        <WordComments wordId={detail.id} />
      </div>
    </Space>
  );
}