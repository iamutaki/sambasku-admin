import { useMemo } from 'react';
import {
  AFFIX_TYPE_LABELS,
  EXAMPLE_SOURCE_LABELS,
  RELATION_TYPE_LABELS,
  TRANSLATION_TYPE_LABELS,
  VARIANT_TYPE_LABELS,
} from '../domain/create-word';
import { Alert, Button, Card, Descriptions, Flex, Image, Skeleton, Space, Tag, Typography } from 'antd';
import { EditOutlined, RollbackOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useNavigate, useParams } from '@tanstack/react-router';
import { PageHeader } from '@/shared/components/page-header';
import { useAuth } from '@/shared/auth/use-auth';
import { WORD_STATUS_LABELS, WORD_TYPE_LABELS, type WordStatus } from '../domain/word';
import { useWordDetail } from '../application/use-word-detail';
import { useDialectOptions, useLanguageOptions } from '../application/use-reference-data';
import type { WordDetail } from '../domain/word-detail';

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
  const navigate = useNavigate();
  const { user } = useAuth();
  const { id } = useParams({ from: '/console-layout/words/$id' });

  const isContributor = user?.role === 'contributor';
  const detailQuery = useWordDetail(id, { enabled: !isContributor });
  const detail = detailQuery.data;

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
    return (
      <>
        <PageHeader title="Detail Kata" subtitle="Memuat detail kata…" />
        <Card>
          <Skeleton active paragraph={{ rows: 8 }} />
        </Card>
      </>
    );
  }

  if (detailQuery.isError || !detail) {
    return (
      <>
        <PageHeader title="Detail Kata" subtitle="Gagal memuat detail kata." />
        <Alert
          type="error"
          showIcon
          message="Tidak dapat membuka kata ini"
          description={detailQuery.error?.message ?? 'Kata tidak ditemukan atau akses ditolak.'}
          action={
            <Button onClick={() => navigate({ to: '/words' })} style={{ whiteSpace: 'nowrap' }}>
              Kembali ke Daftar
            </Button>
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
            <Button icon={<RollbackOutlined />} onClick={() => navigate({ to: '/words' })}>
              Kembali ke Daftar
            </Button>
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
          {detail.is_verified ? <Tag color="cyan">Terverifikasi</Tag> : <Tag>Belum diverifikasi</Tag>}
          {detail.is_corrected ? <Tag color="blue">Sudah dikoreksi</Tag> : null}
        </Space>
      ),
    },
    {
      key: 'created',
      label: 'Dibuat',
      children: dayjs(detail.created_at).format('DD MMM YYYY HH:mm'),
    },
    {
      key: 'updated',
      label: 'Diperbarui',
      children: detail.updated_at ? dayjs(detail.updated_at).format('DD MMM YYYY HH:mm') : '-',
    },
  ];

  return (
    <Space direction="vertical" size={20} style={{ width: '100%' }}>
      {/* 1. Informasi dasar */}
      <Descriptions size="small" column={{ xs: 1, md: 2 }} bordered items={basics} />

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
                  <Text strong>{meaning.word_class?.name ?? 'Makna'}</Text>
                  {meaning.word_class?.code ? <Text type="secondary">({meaning.word_class.code})</Text> : null}
                </Space>
                {meaning.order_index ? <Text type="secondary">Urutan {meaning.order_index}</Text> : null}
              </Flex>
              <Paragraph style={{ marginBottom: 4 }}>{meaning.definition}</Paragraph>

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
              ) : null}

              {meaning.examples.length ? (
                <Space direction="vertical" size={0} style={{ marginTop: 4 }}>
                  {meaning.examples.map((e, i) => (
                    <div key={i}>
                      <Text italic>“{e.source_sentence}”</Text>
                      {e.target_sentence ? <Text type="secondary"> — {e.target_sentence}</Text> : null}
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

      {/* 5. Bentuk turunan */}
      <div>
        <Text strong style={{ display: 'block', marginBottom: 8 }}>
          Bentuk Turunan
        </Text>
        {detail.variants.length ? (
          <Space direction="vertical" size={4}>
            {detail.variants.map((v) => (
              <div key={v.id}>
                <Text>{v.form}</Text>{' '}
                <Text type="secondary">
                  ({VARIANT_TYPE_LABELS[v.variant_type as keyof typeof VARIANT_TYPE_LABELS] ?? v.variant_type}
                  {v.affix_type ? `, ${AFFIX_TYPE_LABELS[v.affix_type as keyof typeof AFFIX_TYPE_LABELS] ?? v.affix_type}` : ''}
                  {v.affix_value ? ` "${v.affix_value}"` : ''}
                  {v.dialect_id ? `, ${dialectName(v.dialect_id)}` : ''}
                  {v.notes ? ` — ${v.notes}` : ''})
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
    </Space>
  );
}