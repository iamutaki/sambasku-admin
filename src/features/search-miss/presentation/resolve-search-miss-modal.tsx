import { useEffect, useState } from 'react';
import { Alert, App as AntdApp, Form, Modal, Radio, Typography } from 'antd';
import { WordSearchSelect } from '@/features/words/presentation/word-search-select';
import { normalizeError } from '@/shared/api/error';
import { useResolveSearchMiss } from '../application/use-resolve-search-miss';
import type { ResolveSearchMissAction } from '../infrastructure/search-miss-api';
import type { SearchMissListItem } from '../domain/search-miss';
import { DIRECTION_LABELS } from '../domain/search-miss';

export interface ResolveSearchMissModalProps {
  open: boolean;
  miss: SearchMissListItem | null;
  onClose: () => void;
}

/**
 * Modal selesaikan search-miss ke kata existing:
 * lemma → varian penulisan | sinonim; translation → terjemahan.
 */
export function ResolveSearchMissModal({ open, miss, onClose }: ResolveSearchMissModalProps) {
  const { message } = AntdApp.useApp();
  const resolveMiss = useResolveSearchMiss();
  const [wordId, setWordId] = useState<string | undefined>();
  const [action, setAction] = useState<ResolveSearchMissAction>('variant');

  const isLemma = miss?.direction === 'lemma';

  useEffect(() => {
    if (!open || !miss) return;
    setWordId(undefined);
    setAction(miss.direction === 'lemma' ? 'variant' : 'translation');
  }, [open, miss]);

  const onOk = async () => {
    if (!miss) return;
    if (!wordId) {
      message.warning('Pilih kata target dulu');
      return;
    }
    try {
      const result = await resolveMiss.mutateAsync({
        id: miss.id,
        body: { action, wordId },
      });
      const label =
        action === 'variant' ? 'varian' : action === 'synonym' ? 'sinonim' : 'terjemahan';
      message.success(
        result.is_fulfilled
          ? `Miss "${miss.term}" diselesaikan sebagai ${label}`
          : `Disimpan sebagai ${label} (cek status terpenuhi)`,
      );
      onClose();
    } catch (err) {
      message.warning(normalizeError(err).message || 'Gagal menyelesaikan search miss');
    }
  };

  return (
    <Modal
      title={miss ? `Selesaikan: “${miss.term}”` : 'Selesaikan search miss'}
      open={open}
      onCancel={onClose}
      onOk={() => void onOk()}
      okText="Selesaikan"
      confirmLoading={resolveMiss.isPending}
      destroyOnHidden
    >
      {miss ? (
        <>
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            message={`Arah: ${DIRECTION_LABELS[miss.direction]} · hit ${miss.searchCount}`}
            description={
              isLemma
                ? 'Tempel sebagai variasi penulisan atau buat entri sinonim dari kata yang sudah ada.'
                : 'Tambahkan term ini sebagai terjemahan Indonesia pada makna kata Sambas yang dipilih.'
            }
          />
          <Form layout="vertical">
            <Form.Item label="Aksi" required>
              <Radio.Group
                value={action}
                onChange={(e) => setAction(e.target.value as ResolveSearchMissAction)}
              >
                {isLemma ? (
                  <>
                    <Radio.Button value="variant">Varian penulisan</Radio.Button>
                    <Radio.Button value="synonym">Sinonim (entri baru)</Radio.Button>
                  </>
                ) : (
                  <Radio.Button value="translation">Sebagai terjemahan</Radio.Button>
                )}
              </Radio.Group>
            </Form.Item>
            <Form.Item
              label="Kata target"
              required
              extra={
                action === 'synonym' ? (
                  <Typography.Text type="secondary">
                    Lemma miss akan jadi kata published baru, makna diwariskan dari target.
                  </Typography.Text>
                ) : null
              }
            >
              <WordSearchSelect
                value={wordId}
                onChange={setWordId}
                placeholder="Cari kata published…"
                disabled={resolveMiss.isPending}
              />
            </Form.Item>
          </Form>
        </>
      ) : null}
    </Modal>
  );
}
