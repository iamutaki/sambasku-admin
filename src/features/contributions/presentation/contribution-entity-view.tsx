import type { ReactNode } from 'react';
import { Descriptions, Flex, Space, Tag, Typography } from 'antd';
import {
  EXAMPLE_SOURCE_LABELS,
  RELATION_TYPE_LABELS,
  TRANSLATION_TYPE_LABELS,
  VARIANT_TYPE_LABELS,
} from '@/features/words/domain/create-word';
import { WORD_STATUS_LABELS, WORD_TYPE_LABELS } from '@/features/words/domain/word';
import type {
  ContributionDetailView,
  ExampleChildData,
  PronunciationChildData,
  WordEntityView,
  WordImageChildData,
} from '../domain/contribution';

const { Text } = Typography;

const ENTITY_STATUS_TAG_COLOR: Record<string, string> = {
  published: 'green',
  pending_review: 'orange',
  draft: 'default',
  rejected: 'red',
};

function StatusTag({ status }: { status: string }) {
  const label = WORD_STATUS_LABELS[status as keyof typeof WORD_STATUS_LABELS] ?? status;
  const color = ENTITY_STATUS_TAG_COLOR[status] ?? 'default';
  return <Tag color={color}>{label}</Tag>;
}

function VerifiedTag({ isVerified, isCorrected }: { isVerified: boolean; isCorrected: boolean }) {
  return (
    <>
      {isVerified ? <Tag color="cyan">Terverifikasi</Tag> : null}
      {isCorrected ? <Tag color="blue">Sudah dikoreksi</Tag> : null}
    </>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <Text strong style={{ display: 'block', marginBottom: 8 }}>
        {title}
      </Text>
      {children}
    </div>
  );
}

/**
 * Tampilan READ-ONLY isi kontribusi - dipakai di dalam drawer review.
 * Word → seluruh detail kata (semua status); anak → row entity + parent.
 */
export function ContributionEntityView({ detail }: { detail: ContributionDetailView }) {
  if (detail.entityType === 'word') {
    return <WordEntityDetail word={detail.word} />;
  }

  const child = detail.child;
  let content: ReactNode;
  if (detail.entityType === 'pronunciation') {
    content = <PronunciationDetail fields={child.fields as PronunciationChildData} />;
  } else if (detail.entityType === 'word_image') {
    content = <WordImageDetail fields={child.fields as WordImageChildData} />;
  } else {
    content = <ExampleDetail fields={child.fields as ExampleChildData} />;
  }

  return (
    <>
      <Section title="Kata Induk (referensi)">
        <Descriptions size="small" column={1} items={[
          { key: 'lemma', label: 'Lemma', children: child.wordLemma ?? '-' },
          { key: 'status', label: 'Status', children: <StatusTag status={child.status} /> },
        ]} />
      </Section>
      <Section title="Isi Kontribusi">{content}</Section>
    </>
  );
}

function WordEntityDetail({ word }: { word: WordEntityView }) {
  const basics = [
    { key: 'lemma', label: 'Lemma', children: <Text strong>{word.lemma}</Text> },
    {
      key: 'word_type',
      label: 'Jenis Entri',
      children: WORD_TYPE_LABELS[word.wordType] ?? word.wordType,
    },
    { key: 'status', label: 'Status', children: <StatusTag status={word.status} /> },
    {
      key: 'flags',
      label: 'Tanda',
      children: <VerifiedTag isVerified={word.isVerified} isCorrected={word.isCorrected} />,
    },
  ];

  if (word.dialectId) {
    basics.push({ key: 'dialect', label: 'Dialek', children: word.dialectId });
  }
  if (word.notes) {
    basics.push({ key: 'notes', label: 'Catatan', children: word.notes });
  }

  return (
    <>
      <Section title="Data Kata Dasar">
        <Descriptions size="small" column={2} items={basics} />
      </Section>

      {word.meanings.length ? (
        <Section title="Makna / Arti">
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            {word.meanings.map((meaning) => (
              <div key={meaning.id || `${meaning.wordClassId}-${meaning.definition}`}>
                <Flex justify="space-between" align="baseline" wrap gap={8}>
                  <Text strong>
                    {meaning.wordClassName || meaning.wordClassId || 'Makna'}
                  </Text>
                  {meaning.orderIndex ? <Text type="secondary">Urutan {meaning.orderIndex}</Text> : null}
                </Flex>
                <Text style={{ display: 'block' }}>{meaning.definition}</Text>
                {meaning.translations.length ? (
                  <Space direction="vertical" size={0} style={{ marginTop: 4 }}>
                    {meaning.translations.map((t, i) => (
                      <Text type="secondary" key={i}>
                        • {t.text}
                        {t.type ? ` (${TRANSLATION_TYPE_LABELS[t.type as keyof typeof TRANSLATION_TYPE_LABELS] ?? t.type})` : ''}
                      </Text>
                    ))}
                  </Space>
                ) : null}
                {meaning.examples.length ? (
                  <Space direction="vertical" size={0} style={{ marginTop: 4 }}>
                    {meaning.examples.map((e, i) => (
                      <div key={i}>
                        <Text italic>“{e.source}”</Text>
                        {e.target ? <Text type="secondary"> — {e.target}</Text> : null}
                        {e.sourceType ? (
                          <Text type="secondary"> ({EXAMPLE_SOURCE_LABELS[e.sourceType as keyof typeof EXAMPLE_SOURCE_LABELS] ?? e.sourceType})</Text>
                        ) : null}
                      </div>
                    ))}
                  </Space>
                ) : null}
              </div>
            ))}
          </Space>
        </Section>
      ) : null}

      {word.categories.length ? (
        <Section title="Kategori / Glosarium">
          <Tag bordered>{word.categories.map((c) => c.name).join(', ')}</Tag>
        </Section>
      ) : null}

      {word.pronunciations.length ? (
        <Section title="Pengucapan">
          <Space direction="vertical" size={4}>
            {word.pronunciations.map((p) => (
              <div key={p.id}>
                <Text strong>/p.kata…/</Text>
                <Space size={6} wrap style={{ marginLeft: 4 }}>
                  <Text code>{p.value}</Text>
                  <StatusTag status={p.status ?? 'published'} />
                </Space>
                {p.dialectId ? <Text type="secondary">({p.dialectId})</Text> : null}
              </div>
            ))}
          </Space>
        </Section>
      ) : null}

      {word.images.length ? (
        <Section title="Gambar">
          <Space direction="vertical" size={8}>
            {word.images.map((img) => (
              <Flex key={img.id} align="center" gap={8} wrap>
                <img src={img.url} alt={img.altText ?? img.id} style={{ height: 48, borderRadius: 6 }} />
                <Space size={4} wrap>
                  {img.isPrimary ? <Tag color="geekblue">Utama</Tag> : null}
                  {img.status ? <StatusTag status={img.status} /> : null}
                  {img.altText ? <Text type="secondary">{img.altText}</Text> : null}
                </Space>
              </Flex>
            ))}
          </Space>
        </Section>
      ) : null}

      {word.variants.length ? (
        <Section title="Bentuk Turunan">
          <Space direction="vertical" size={4}>
            {word.variants.map((v) => (
              <div key={v.id}>
                <Text>{v.form}</Text>{' '}
                <Text type="secondary">
                  ({VARIANT_TYPE_LABELS[v.variantType as keyof typeof VARIANT_TYPE_LABELS] ?? v.variantType}
                  {v.affixType ? `, afiks ${v.affixType}` : ''}
                  {v.affixValue ? ` ${v.affixValue}` : ''})
                </Text>
              </div>
            ))}
          </Space>
        </Section>
      ) : null}

      {word.relatedWords.length ? (
        <Section title="Relasi Kata">
          <Space direction="vertical" size={4}>
            {word.relatedWords.map((rel, i) => (
              <div key={i}>
                <Text>{rel.lemma}</Text>{' '}
                <Text type="secondary">
                  ({RELATION_TYPE_LABELS[rel.relationType as keyof typeof RELATION_TYPE_LABELS] ?? rel.relationType})
                </Text>
              </div>
            ))}
          </Space>
        </Section>
      ) : null}

      {word.appearsIn.length ? (
        <Section title="Muncul dalam">
          <Space direction="vertical" size={4}>
            {word.appearsIn.map((rel, i) => (
              <div key={i}>
                <Text>{rel.lemma}</Text>{' '}
                <Text type="secondary">
                  ({RELATION_TYPE_LABELS[rel.relationType as keyof typeof RELATION_TYPE_LABELS] ?? rel.relationType})
                </Text>
              </div>
            ))}
          </Space>
        </Section>
      ) : null}
    </>
  );
}

function PronunciationDetail({ fields }: { fields: PronunciationChildData }) {
  return (
    <Descriptions size="small" column={1} items={[
      { key: 'value', label: 'Pengucapan', children: <Text code>{fields.value}</Text> },
      { key: 'notation', label: 'Notasi', children: fields.notation },
      { key: 'dialect', label: 'Dialek', children: fields.dialect_id ?? 'Umum / tidak ada' },
      { key: 'speaker', label: 'Penutur', children: fields.speaker_name ?? '-' },
      { key: 'audio', label: 'Audio', children: fields.audio_url ? <a href={fields.audio_url} target="_blank" rel="noreferrer">Dengarkan</a> : null },
      { key: 'notes', label: 'Catatan', children: fields.notes ?? '-' },
    ]} />
  );
}

function WordImageDetail({ fields }: { fields: WordImageChildData }) {
  return (
    <Space direction="vertical" size={8} style={{ width: '100%' }}>
      <img src={fields.url} alt={fields.alt_text ?? fields.provider_file_id} style={{ maxWidth: 240, borderRadius: 8 }} />
      <Descriptions size="small" column={1} items={[
        { key: 'url', label: 'URL', children: <a href={fields.url} target="_blank" rel="noreferrer">{fields.url}</a> },
        { key: 'provider', label: 'Penyedia', children: fields.provider ?? '-' },
        { key: 'file_id', label: 'File ID', children: fields.provider_file_id },
        { key: 'alt', label: 'Alt Text', children: fields.alt_text ?? '-' },
        { key: 'primary', label: 'Gambar Utama', children: fields.is_primary ? 'Ya' : 'Tidak' },
      ]} />
    </Space>
  );
}

function ExampleDetail({ fields }: { fields: ExampleChildData }) {
  return (
    <Descriptions size="small" column={1} items={[
      { key: 'source', label: 'Kalimat', children: fields.source_sentence },
      { key: 'target', label: 'Terjemahan', children: fields.target_sentence ?? '-' },
      {
        key: 'source_type',
        label: 'Sumber',
        children: fields.source_type ? EXAMPLE_SOURCE_LABELS[fields.source_type as keyof typeof EXAMPLE_SOURCE_LABELS] ?? fields.source_type : '-',
      },
      { key: 'notes', label: 'Catatan', children: fields.notes ?? '-' },
    ]} />
  );
}