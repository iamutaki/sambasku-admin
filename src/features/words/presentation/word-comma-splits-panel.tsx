import { useState } from 'react';
import {
  BookOutlined,
  EyeOutlined,
  PartitionOutlined,
  StopOutlined,
} from '@ant-design/icons';
import {
  Alert,
  App as AntdApp,
  Button,
  Card,
  Empty,
  Flex,
  Input,
  Popconfirm,
  Space,
  Tag,
  Typography,
} from 'antd';
import { useNavigate } from '@tanstack/react-router';
import { normalizeError } from '@/shared/api/error';
import { WORD_STATUS_LABELS, WORD_TYPE_LABELS } from '../domain/word';
import { matchWordClassId } from '../application/match-word-class';
import { useWordClassOptions } from '../application/use-reference-data';
import {
  useApplyCommaSplit,
  useCommaSplits,
  useMarkCommaLiteral,
} from '../application/use-comma-splits';
import { KbbiDefinitionPickerModal } from './kbbi-definition-picker-modal';
import type {
  CommaSplitLemmaDto,
  CommaSplitTranslationDto,
  LemmaSplitMeaningOverride,
} from '../infrastructure/word-api';
import type { WordClassOption } from '../domain/create-word';

function statusColor(status: string): string {
  if (status === 'published') return 'green';
  if (status === 'pending_review') return 'orange';
  if (status === 'rejected' || status === 'taken_down') return 'red';
  return 'default';
}

function PartsEditor({
  parts,
  onChange,
  disabled,
}: {
  parts: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  return (
    <Space direction="vertical" style={{ width: '100%' }} size={6}>
      {parts.map((part, index) => (
        <Input
          key={index}
          value={part}
          disabled={disabled}
          placeholder={`Bagian ${index + 1}`}
          onChange={(e) => {
            const next = [...parts];
            next[index] = e.target.value;
            onChange(next);
          }}
          addonBefore={String(index + 1)}
          allowClear
        />
      ))}
      <Button
        size="small"
        type="dashed"
        disabled={disabled}
        onClick={() => onChange([...parts, ''])}
      >
        + Tambah bagian
      </Button>
    </Space>
  );
}

type ExtraMeaning = {
  translation: string;
  definition: string;
  wordClassId: string | null;
  dirty: boolean;
  source: 'manual' | 'kbbi';
};

function blankExtra(item: CommaSplitLemmaDto): ExtraMeaning {
  return {
    translation: item.copied_translation,
    definition: item.copied_definition,
    wordClassId: null,
    dirty: false,
    source: 'manual',
  };
}

function LemmaCard({
  item,
  canApply,
  wordClasses,
}: {
  item: CommaSplitLemmaDto;
  canApply: boolean;
  wordClasses: WordClassOption[];
}) {
  const { message } = AntdApp.useApp();
  const navigate = useNavigate();
  const apply = useApplyCommaSplit();
  const mark = useMarkCommaLiteral();
  const resetKey = `${item.word_id}:${item.suggested_parts.join('|')}:${item.copied_translation}`;
  const [parts, setParts] = useState(item.suggested_parts);
  const [extras, setExtras] = useState<ExtraMeaning[]>(() =>
    item.suggested_parts.slice(1).map(() => blankExtra(item)),
  );
  const [kbbiIndex, setKbbiIndex] = useState<number | null>(null);
  const [seenKey, setSeenKey] = useState(resetKey);
  if (seenKey !== resetKey) {
    setSeenKey(resetKey);
    setParts(item.suggested_parts);
    setExtras(item.suggested_parts.slice(1).map(() => blankExtra(item)));
  }

  const setLemmaParts = (next: string[]) => {
    setParts(next);
    setExtras((current) => {
      const needed = Math.max(next.length - 1, 0);
      if (current.length === needed) return current;
      if (current.length > needed) return current.slice(0, needed);
      return [
        ...current,
        ...Array.from({ length: needed - current.length }, () => blankExtra(item)),
      ];
    });
  };

  const patchExtra = (index: number, patch: Partial<ExtraMeaning>) => {
    setExtras((current) =>
      current.map((extra, i) => (i === index ? { ...extra, ...patch } : extra)),
    );
  };

  const rows = parts
    .map((lemma, index) => ({
      lemma: lemma.trim(),
      extra: index === 0 ? null : extras[index - 1],
    }))
    .filter((row) => row.lemma.length > 0);
  const cleaned = rows.map((row) => row.lemma);
  const meaningOverrides: LemmaSplitMeaningOverride[] = rows.slice(1).map((row) => {
    const extra = row.extra ?? blankExtra(item);
    if (!extra.dirty) return { mode: 'copy' };
    const override: LemmaSplitMeaningOverride = {
      mode: 'replace',
      translation_text: extra.translation.trim(),
      meaning_source: extra.source,
    };
    if (extra.definition.trim()) override.definition = extra.definition.trim();
    if (extra.wordClassId) override.word_class_id = extra.wordClassId;
    return override;
  });
  const replaceMissingGloss = meaningOverrides.some(
    (item) => item.mode === 'replace' && item.translation_text.length === 0,
  );
  const canSplit = cleaned.length >= 2 && !replaceMissingGloss;

  const onSplit = async () => {
    try {
      await apply.mutateAsync({
        kind: 'lemma',
        word_id: item.word_id,
        parts: cleaned,
        meaning_overrides: meaningOverrides,
      });
      message.success(
        `"${item.lemma}" dipisah menjadi ${cleaned.length} kata (asli → "${cleaned[0]}")`,
      );
    } catch (err) {
      message.error(normalizeError(err).message || 'Gagal memisahkan kata');
    }
  };

  const onLiteral = async () => {
    try {
      await mark.mutateAsync({ kind: 'lemma', word_id: item.word_id });
      message.success('Ditandai sebagai koma literal');
    } catch (err) {
      message.error(normalizeError(err).message || 'Gagal menandai');
    }
  };

  return (
    <Card
      size="small"
      title={
        <Flex align="center" gap={8} wrap>
          <Typography.Text strong>{item.lemma}</Typography.Text>
          <Tag>{item.language_code}</Tag>
          <Tag color={statusColor(item.status)}>
            {WORD_STATUS_LABELS[item.status] ?? item.status}
          </Tag>
          <Tag>{WORD_TYPE_LABELS[item.word_type]}</Tag>
          <Typography.Text type="secondary">
            {item.meanings_count} makna
          </Typography.Text>
        </Flex>
      }
      extra={
        <Button
          type="link"
          icon={<EyeOutlined />}
          onClick={() => navigate({ to: '/words/$id', params: { id: item.word_id } })}
        >
          Detail
        </Button>
      }
    >
      {item.meaning_preview.length > 0 ? (
        <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
          Makna yang disalin: {item.meaning_preview.join(' · ')}
        </Typography.Paragraph>
      ) : null}
      <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
        Entri asli menjadi bagian pertama. Bagian lain jadi kata baru dengan makna
        yang sama — ubah terjemahannya bila artinya berbeda.
      </Typography.Text>
      <Space direction="vertical" style={{ width: '100%' }} size={10}>
        {parts.map((part, index) => {
          const extra = index === 0 ? null : extras[index - 1];
          return (
            <Space key={index} direction="vertical" style={{ width: '100%' }} size={6}>
              <Input
                value={part}
                disabled={!canApply}
                placeholder={`Bagian ${index + 1}`}
                onChange={(e) => {
                  const next = [...parts];
                  next[index] = e.target.value;
                  setLemmaParts(next);
                }}
                addonBefore={String(index + 1)}
                allowClear
              />
              {extra ? (
                <>
                  <Input
                    value={extra.translation}
                    disabled={!canApply}
                    placeholder="Terjemahan Indonesia"
                    addonBefore="Terjemahan"
                    onChange={(e) =>
                      patchExtra(index - 1, {
                        translation: e.target.value,
                        dirty: true,
                        source: 'manual',
                      })
                    }
                    suffix={
                      <Button
                        type="text"
                        size="small"
                        icon={<BookOutlined />}
                        aria-label="Ambil dari KBBI"
                        disabled={!canApply}
                        onClick={() => setKbbiIndex(index - 1)}
                      />
                    }
                  />
                  <Input.TextArea
                    value={extra.definition}
                    disabled={!canApply}
                    rows={2}
                    placeholder="Penjelasan arti (opsional). Kosongkan bila tetap memakai salinan."
                    onChange={(e) =>
                      patchExtra(index - 1, {
                        definition: e.target.value,
                        dirty: true,
                        source: 'manual',
                      })
                    }
                  />
                  <Typography.Text type="secondary">
                    {extra.dirty
                      ? 'Makna ini diganti. Contoh dan label sumber tidak ikut.'
                      : 'Makna ini akan disalin.'}
                  </Typography.Text>
                </>
              ) : null}
            </Space>
          );
        })}
        <Button
          size="small"
          type="dashed"
          disabled={!canApply}
          onClick={() => setLemmaParts([...parts, ''])}
        >
          + Tambah bagian
        </Button>
      </Space>
      <KbbiDefinitionPickerModal
        open={kbbiIndex !== null}
        initialLemma={
          kbbiIndex === null ? '' : (extras[kbbiIndex]?.translation ?? item.copied_translation)
        }
        onClose={() => setKbbiIndex(null)}
        onSelect={(suggestion) => {
          if (kbbiIndex === null) return;
          const matchedId = matchWordClassId(
            wordClasses,
            suggestion.word_class_code,
            suggestion.word_class_label,
          );
          patchExtra(kbbiIndex, {
            translation: suggestion.lemma.trim(),
            definition: suggestion.definition,
            wordClassId: matchedId ?? null,
            dirty: true,
            source: 'kbbi',
          });
          setKbbiIndex(null);
          message.success('Terjemahan diisi dari KBBI');
        }}
      />
      {canApply ? (
        <Flex gap={8} wrap style={{ marginTop: 12 }}>
          <Popconfirm
            title="Pisahkan menjadi beberapa kata?"
            description={`Asli → "${cleaned[0] ?? ''}", lalu ${Math.max(cleaned.length - 1, 0)} kata baru.`}
            okText="Pisahkan"
            cancelText="Batal"
            onConfirm={onSplit}
            disabled={!canSplit}
          >
            <Button
              type="primary"
              icon={<PartitionOutlined />}
              loading={apply.isPending}
              disabled={!canSplit}
            >
              Pisahkan kata
            </Button>
          </Popconfirm>
          <Popconfirm
            title="Tandai koma sebagai literal?"
            description="Entri ini tidak akan muncul lagi di antrean Pemisahan."
            okText="Tandai"
            cancelText="Batal"
            onConfirm={onLiteral}
          >
            <Button icon={<StopOutlined />} loading={mark.isPending}>
              Koma literal
            </Button>
          </Popconfirm>
        </Flex>
      ) : null}
    </Card>
  );
}

function TranslationCard({
  item,
  canApply,
}: {
  item: CommaSplitTranslationDto;
  canApply: boolean;
}) {
  const { message } = AntdApp.useApp();
  const navigate = useNavigate();
  const apply = useApplyCommaSplit();
  const mark = useMarkCommaLiteral();
  const resetKey = `${item.meaning_translation_id}:${item.suggested_parts.join('|')}`;
  const [parts, setParts] = useState(item.suggested_parts);
  const [seenKey, setSeenKey] = useState(resetKey);
  if (seenKey !== resetKey) {
    setSeenKey(resetKey);
    setParts(item.suggested_parts);
  }

  const cleaned = parts.map((p) => p.trim()).filter(Boolean);
  const canSplit = cleaned.length >= 2;

  const onSplit = async () => {
    try {
      await apply.mutateAsync({
        kind: 'translation',
        meaning_translation_id: item.meaning_translation_id,
        parts: cleaned,
      });
      message.success(
        `Terjemahan "${item.translation_text}" dipecah menjadi ${cleaned.length} makna`,
      );
    } catch (err) {
      message.error(normalizeError(err).message || 'Gagal memisahkan makna');
    }
  };

  const onLiteral = async () => {
    try {
      await mark.mutateAsync({
        kind: 'translation',
        meaning_translation_id: item.meaning_translation_id,
      });
      message.success('Ditandai sebagai koma literal');
    } catch (err) {
      message.error(normalizeError(err).message || 'Gagal menandai');
    }
  };

  return (
    <Card
      size="small"
      title={
        <Flex align="center" gap={8} wrap>
          <Typography.Text strong>{item.lemma}</Typography.Text>
          <Tag>{item.language_code}</Tag>
          <Typography.Text type="secondary">terjemahan berkoma</Typography.Text>
        </Flex>
      }
      extra={
        <Button
          type="link"
          icon={<EyeOutlined />}
          onClick={() => navigate({ to: '/words/$id', params: { id: item.word_id } })}
        >
          Detail
        </Button>
      }
    >
      <Typography.Paragraph style={{ marginBottom: 8 }}>
        <Typography.Text type="secondary">Terjemahan: </Typography.Text>
        {item.translation_text}
      </Typography.Paragraph>
      {item.definition && item.definition !== '-' ? (
        <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
          Definisi: {item.definition}
        </Typography.Paragraph>
      ) : null}
      <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
        Setiap bagian menjadi blok Makna terpisah (satu terjemahan per makna).
      </Typography.Text>
      <PartsEditor parts={parts} onChange={setParts} disabled={!canApply} />
      {canApply ? (
        <Flex gap={8} wrap style={{ marginTop: 12 }}>
          <Popconfirm
            title="Pisahkan ke beberapa makna?"
            description={`Akan menjadi ${cleaned.length} blok Makna.`}
            okText="Pisahkan"
            cancelText="Batal"
            onConfirm={onSplit}
            disabled={!canSplit}
          >
            <Button
              type="primary"
              icon={<PartitionOutlined />}
              loading={apply.isPending}
              disabled={!canSplit}
            >
              Pisahkan ke makna
            </Button>
          </Popconfirm>
          <Popconfirm
            title="Tandai koma sebagai literal?"
            description="Terjemahan ini tidak akan muncul lagi di antrean Pemisahan."
            okText="Tandai"
            cancelText="Batal"
            onConfirm={onLiteral}
          >
            <Button icon={<StopOutlined />} loading={mark.isPending}>
              Koma literal
            </Button>
          </Popconfirm>
        </Flex>
      ) : null}
    </Card>
  );
}

export function WordCommaSplitsPanel({ canApply }: { canApply: boolean }) {
  const { data, isLoading, isError, error, refetch, isFetching } = useCommaSplits(true);
  const wordClassQuery = useWordClassOptions();

  if (isLoading) {
    return <Typography.Text type="secondary">Memuat kandidat pemisahan…</Typography.Text>;
  }

  if (isError) {
    return (
      <Alert
        type="error"
        showIcon
        message="Gagal memuat antrean Pemisahan"
        description={error instanceof Error ? error.message : undefined}
        action={
          <Button size="small" onClick={() => refetch()}>
            Coba lagi
          </Button>
        }
      />
    );
  }

  const lemmas = data?.lemmas ?? [];
  const translations = data?.translations ?? [];
  if (lemmas.length === 0 && translations.length === 0) {
    return (
      <Empty
        description="Tidak ada lemma atau terjemahan berkoma yang perlu dipisah"
        image={Empty.PRESENTED_IMAGE_SIMPLE}
      />
    );
  }

  return (
    <Flex vertical gap={24}>
      <Flex justify="space-between" align="center">
        <Typography.Text type="secondary">
          {data?.total ?? lemmas.length + translations.length} kandidat
          ({lemmas.length} kata, {translations.length} terjemahan)
        </Typography.Text>
        <Button size="small" loading={isFetching} onClick={() => refetch()}>
          Muat ulang
        </Button>
      </Flex>

      {lemmas.length > 0 ? (
        <Flex vertical gap={12}>
          <Typography.Title level={5} style={{ margin: 0 }}>
            Kata Sambas berkoma
          </Typography.Title>
          {lemmas.map((item) => (
            <LemmaCard
              key={item.word_id}
              item={item}
              canApply={canApply}
              wordClasses={wordClassQuery.data ?? []}
            />
          ))}
        </Flex>
      ) : null}

      {translations.length > 0 ? (
        <Flex vertical gap={12}>
          <Typography.Title level={5} style={{ margin: 0 }}>
            Terjemahan Indonesia berkoma
          </Typography.Title>
          {translations.map((item) => (
            <TranslationCard
              key={item.meaning_translation_id}
              item={item}
              canApply={canApply}
            />
          ))}
        </Flex>
      ) : null}
    </Flex>
  );
}
