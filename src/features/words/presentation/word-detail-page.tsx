import { useMemo } from 'react';
import {
  AFFIX_TYPE_LABELS,
  EXAMPLE_SOURCE_LABELS,
  RELATION_TYPE_LABELS,
  TRANSLATION_TYPE_LABELS,
  VARIANT_TYPE_LABELS,
} from '../domain/create-word';
import { Alert, App as AntdApp, Button, Descriptions, Flex, Image, Modal, Space, Switch, Tag, Tooltip, Typography } from 'antd';
import { EditOutlined, ReloadOutlined, RollbackOutlined } from '@ant-design/icons';
import { formatDateTime } from '@/shared/utils/format-datetime';
import { useNavigate, useParams } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/shared/components/page-header';
import { PageLoading } from '@/shared/components/page-loading';
import { useAuth } from '@/shared/auth/use-auth';
import { WORD_STATUS_LABELS, WORD_TYPE_LABELS, type WordStatus } from '../domain/word';
import { useWordDetail } from '../application/use-word-detail';
import { useDialectOptions, useLanguageOptions } from '../application/use-reference-data';
import { useVerifyWord, useUnverifyWord } from '../application/use-word-verify';
import { usePublishWord, useUnpublishWord } from '../application/use-word-publish';
import { normalizeError } from '@/shared/api/error';
import { WordVoteCount } from '@/features/votes/presentation/word-vote-count';
import { WordComments } from '@/features/comments/presentation/word-comments';
import type { WordDetail } from '../domain/word-detail';
import { useState } from 'react';

const { Text, Paragraph } = Typography;

const STATUS_TAG_COLOR: Record<WordStatus, string> = {
  draft: 'default',
  pending_review: 'orange',
  published: 'green',
  rejected: 'red',
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
                <Switch
                  checked={detail.status === 'published'}
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
              </Space>
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
      />
    </>
  );
}

function WordDetailContent({
  detail,
  languageName,
  dialectName,
  translationLanguageName,
}: {
  detail: WordDetail;
  languageName: string;
  dialectName: (dialectId: string | null | undefined) => string;
  translationLanguageName: (languageId: string) => string;
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
      key: 'updated',
      label: 'Diperbarui',
      children: detail.updated_at ? formatDateTime(detail.updated_at) : '-',
    },
  ];

  return (
    <Space direction="vertical" size={20} style={{ width: '100%' }}>
      <Modal
        title="Verifikator"
        open={verifierOpen}
        onCancel={() => setVerifierOpen(false)}
        footer={null}
      >
        {detail.verified_by ? (
          <Space direction="vertical" size={4}>
            <Text>
              {detail.self_verified
                ? `Dibuat dan diverifikasi oleh ${detail.verified_by.username}`
                : `Diverifikasi oleh ${detail.verified_by.username}`}
            </Text>
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
          Makna / Arti ({detail.meanings.length})
        </Text>
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          {detail.meanings.map((meaning) => (
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
                {meaning.definition === '-' ? (
                  <Tag>Belum ada definisi</Tag>
                ) : (
                  meaning.definition
                )}
              </Paragraph>

              {meaning.translations.length ? (
                <Space direction="vertical" size={0}>
                  {meaning.translations.map((t, i) => (
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
                <Tag>Belum ada padanan</Tag>
              )}

              {meaning.examples.length ? (
                <Space direction="vertical" size={0} style={{ marginTop: 4 }}>
                  {meaning.examples.map((e, i) => (
                    <div key={i}>
                      <Text italic>“{e.source_sentence}”</Text>
                      {e.target_sentence ? <Text type="secondary"> - {e.target_sentence}</Text> : null}
                      {e.source_type ? (
                        <Text type="secondary">
                          {' '}
                          ({EXAMPLE_SOURCE_LABELS[e.source_type as keyof typeof EXAMPLE_SOURCE_LABELS] ?? e.source_type})
                        </Text>
                      ) : null}
                    </div>
                  ))}
                </Space>
              ) : null}
            </div>
          ))}
        </Space>
      </div>

      {/* 3. Kategori */}
      <div>
        <Text strong style={{ display: 'block', marginBottom: 8 }}>
          Kategori / Glosarium
        </Text>
        {detail.categories.length ? (
          <Space size={4} wrap>
            {detail.categories.map((c) => (
              <Tag key={c.id}>{c.name}</Tag>
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
        {detail.related_words.length ? (
          <Space direction="vertical" size={4}>
            {detail.related_words.map((rel, i) => (
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

      {detail.appears_in.length ? (
        <div>
          <Text strong style={{ display: 'block', marginBottom: 8 }}>
            Muncul dalam
          </Text>
          <Space direction="vertical" size={4}>
            {detail.appears_in.map((rel, i) => (
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
          {detail.variants.every((v) => v.variant_type === 'alternative')
            ? 'Variasi Penulisan'
            : 'Variasi & Bentuk Turunan'}
        </Text>
        {detail.variants.length ? (
          <Space direction="vertical" size={4}>
            {detail.variants.map((v) => (
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
        {detail.pronunciations.length ? (
          <Space direction="vertical" size={4}>
            {detail.pronunciations.map((p) => (
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
          <Text type="secondary">Tidak ada</Text>
        )}
      </div>

      {/* 7. Gambar */}
      <div>
        <Text strong style={{ display: 'block', marginBottom: 8 }}>
          Gambar
        </Text>
        {detail.images.length ? (
          <Space direction="vertical" size={8}>
            {detail.images.map((img) => (
              <Flex key={img.id} align="center" gap={8} wrap>
                <Image
                  src={img.url}
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