import { useEffect, useState } from 'react';
import { BookOutlined, LoadingOutlined } from '@ant-design/icons';
import { Alert, Empty, Flex, Input, List, Modal, Space, Spin, Tag, Typography, Button } from 'antd';
import { normalizeError } from '@/shared/api/error';
import { useDebouncedValue } from '@/shared/hooks/use-debounced-value';
import { useLookupLemmaDefinition } from '../application/use-lookup-lemma-definition';
import type { LemmaDefinitionSuggestion } from '../domain/lemma-definition';

const { Text, Paragraph } = Typography;

/** Debounce lookup KBBI - selaras mobile (400 ms). */
const KBBI_DEBOUNCE_MS = 400;

export interface KbbiDefinitionPickerModalProps {
  open: boolean;
  /** Prefill query (biasanya teks terjemahan Indonesia) */
  initialLemma?: string;
  onClose: () => void;
  onSelect: (suggestion: LemmaDefinitionSuggestion) => void;
}

/**
 * Modal lookup KBBI via API kita → pilih satu suggestion untuk isi field
 * definisi (dan hint kelas kata di parent). Cari otomatis via debounce
 * (tanpa tombol Cari).
 */
export function KbbiDefinitionPickerModal({
  open,
  initialLemma = '',
  onClose,
  onSelect,
}: KbbiDefinitionPickerModalProps) {
  const lookup = useLookupLemmaDefinition();
  const [lemma, setLemma] = useState(initialLemma);
  const debouncedLemma = useDebouncedValue(lemma.trim(), KBBI_DEBOUNCE_MS);

  useEffect(() => {
    if (!open) return;
    setLemma(initialLemma);
    lookup.reset();
    // Hanya reset saat modal dibuka / prefill berubah
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialLemma]);

  useEffect(() => {
    if (!open) return;
    if (!debouncedLemma) {
      lookup.reset();
      return;
    }
    lookup.mutate(debouncedLemma);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, debouncedLemma]);

  const result = lookup.data;
  const suggestions = result?.suggestions ?? [];
  const isLoading = lookup.isPending;
  const showIdleHint =
    !debouncedLemma && !isLoading && !result && !lookup.isError;

  return (
    <Modal
      title={
        <Space>
          <BookOutlined />
          <span>Ambil definisi dari KBBI</span>
        </Space>
      }
      open={open}
      onCancel={onClose}
      footer={null}
      width={640}
      destroyOnHidden
    >
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <Text type="secondary">
          Ketik lemma bahasa Indonesia - hasil muncul otomatis. Pilih satu definisi
          untuk mengisi field pada form (tetap bisa diedit setelahnya).
        </Text>

        <Input
          value={lemma}
          onChange={(e) => setLemma(e.target.value)}
          placeholder="mis. makan, apel, rumah"
          maxLength={100}
          allowClear
          prefix={<BookOutlined />}
          suffix={isLoading ? <LoadingOutlined spin /> : null}
        />

        {lookup.isError ? (
          <Alert type="warning" showIcon message={normalizeError(lookup.error).message} />
        ) : null}

        {isLoading ? (
          <Flex vertical align="center" justify="center" gap={8} style={{ padding: '28px 0' }}>
            <Spin size="large" />
            <Text type="secondary">Mencari di KBBI…</Text>
          </Flex>
        ) : null}

        {!isLoading && showIdleHint ? (
          <Empty description="Ketik lemma untuk mencari di KBBI" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : null}

        {!isLoading && result && !result.found ? (
          <Empty description={`Tidak ditemukan di KBBI untuk “${result.query}”`} />
        ) : null}

        {!isLoading && suggestions.length > 0 ? (
          <>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {suggestions.length} definisi - gulir untuk melihat semua
            </Text>
            <List
              size="small"
              bordered
              dataSource={suggestions}
              style={{
                maxHeight: 'min(55vh, 480px)',
                overflow: 'auto',
                overscrollBehavior: 'contain',
              }}
              renderItem={(item) => (
                <List.Item
                  actions={[
                    <Button
                      key="pick"
                      type="link"
                      onClick={() => {
                        onSelect(item);
                        onClose();
                      }}
                    >
                      Pakai
                    </Button>,
                  ]}
                >
                  <List.Item.Meta
                    title={
                      <Space wrap size={4}>
                        <Text strong ellipsis>
                          {item.lemma} · makna {item.homonym_index}.{item.sense_index}
                        </Text>
                        {item.word_class_label ? <Tag>{item.word_class_label}</Tag> : null}
                        {item.word_class_code ? <Tag color="blue">{item.word_class_code}</Tag> : null}
                      </Space>
                    }
                    description={
                      <Paragraph
                        style={{ marginBottom: 0 }}
                        ellipsis={{ rows: 3, expandable: true, symbol: 'lainnya' }}
                      >
                        {item.definition}
                      </Paragraph>
                    }
                  />
                </List.Item>
              )}
            />
          </>
        ) : null}

        {!isLoading && result?.cache_hit ? (
          <Text type="secondary" style={{ fontSize: 12 }}>
            Hasil dari cache server
          </Text>
        ) : null}
      </Space>
    </Modal>
  );
}
