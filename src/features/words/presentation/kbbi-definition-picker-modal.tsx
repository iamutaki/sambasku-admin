import { useEffect, useState } from 'react';
import { BookOutlined, SearchOutlined } from '@ant-design/icons';
import { Alert, App as AntdApp, Button, Empty, Input, List, Modal, Space, Tag, Typography } from 'antd';
import { normalizeError } from '@/shared/api/error';
import { useLookupLemmaDefinition } from '../application/use-lookup-lemma-definition';
import type { LemmaDefinitionSuggestion } from '../domain/lemma-definition';

const { Text, Paragraph } = Typography;

export interface KbbiDefinitionPickerModalProps {
  open: boolean;
  /** Prefill query (biasanya teks terjemahan Indonesia) */
  initialLemma?: string;
  onClose: () => void;
  onSelect: (suggestion: LemmaDefinitionSuggestion) => void;
}

/**
 * Modal lookup KBBI via API kita → pilih satu suggestion untuk isi field
 * definisi (dan hint kelas kata di parent).
 */
export function KbbiDefinitionPickerModal({
  open,
  initialLemma = '',
  onClose,
  onSelect,
}: KbbiDefinitionPickerModalProps) {
  const { message } = AntdApp.useApp();
  const lookup = useLookupLemmaDefinition();
  const [lemma, setLemma] = useState(initialLemma);

  useEffect(() => {
    if (!open) return;
    setLemma(initialLemma);
    lookup.reset();
    // Hanya reset saat modal dibuka / prefill berubah - jangan ikut lookup identity
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialLemma]);

  const handleSearch = () => {
    const q = lemma.trim();
    if (!q) {
      message.warning('Isi lemma bahasa Indonesia dulu');
      return;
    }
    lookup.mutate(q, {
      onError: (err) => {
        message.warning(normalizeError(err).message || 'Gagal mengambil definisi KBBI');
      },
    });
  };

  const result = lookup.data;
  const suggestions = result?.suggestions ?? [];

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
          Cari lemma bahasa Indonesia. Pilih satu definisi untuk mengisi field pada form
          (tetap bisa diedit setelahnya).
        </Text>

        <Space.Compact style={{ width: '100%' }}>
          <Input
            value={lemma}
            onChange={(e) => setLemma(e.target.value)}
            placeholder="mis. makan, apel, rumah"
            maxLength={100}
            allowClear
            onPressEnter={handleSearch}
          />
          <Button type="primary" icon={<SearchOutlined />} loading={lookup.isPending} onClick={handleSearch}>
            Cari
          </Button>
        </Space.Compact>

        {lookup.isError ? (
          <Alert type="warning" showIcon message={normalizeError(lookup.error).message} />
        ) : null}

        {result && !result.found ? (
          <Empty description={`Tidak ditemukan di KBBI untuk “${result.query}”`} />
        ) : null}

        {suggestions.length > 0 ? (
          <>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {suggestions.length} definisi - gulir untuk melihat semua
            </Text>
            <List
              size="small"
              bordered
              dataSource={suggestions}
              // Viewport-relative: aman untuk 100+ sense (overflow scroll, bukan stretch modal)
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

        {result?.cache_hit ? (
          <Text type="secondary" style={{ fontSize: 12 }}>
            Hasil dari cache server
          </Text>
        ) : null}
      </Space>
    </Modal>
  );
}
