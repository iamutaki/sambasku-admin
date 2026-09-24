import { useMemo, useState } from 'react';
import { EditOutlined, FileTextOutlined, InboxOutlined, PlusOutlined } from '@ant-design/icons';
import { App as AntdApp, Button, Drawer, Flex, Input, Modal, Typography, Upload, theme } from 'antd';
import { normalizeError } from '@/shared/api/error';
import {
  importTemplateCsv,
  parseImportCsv,
  type ParsedWord,
} from '../application/parse-import-csv';
import { importWordsRequest, type ImportWordPayload, type ImportWordResultItem } from '../infrastructure/word-api';
import { ImportSheet } from './import-sheet';
import { KbbiDefinitionPickerModal } from './kbbi-definition-picker-modal';

interface MeaningDraft {
  rowNumber: number;
  translation: string;
  definition: string;
  example: string;
  useTranslation: boolean;
  useDefinition: boolean;
  useExample: boolean;
  skipped: boolean;
}

interface WordDraft {
  id: string;
  lemma: string;
  verify: boolean;
  meanings: MeaningDraft[];
  note?: string;
}

const CHUNK = 25;
const MANUAL_STARTER_ROWS = 12;

let draftSeq = 0;
function nextDraftId() {
  draftSeq += 1;
  return `w-${Date.now()}-${draftSeq}`;
}

function emptyMeaning(rowNumber: number): MeaningDraft {
  return {
    rowNumber,
    translation: '',
    definition: '',
    example: '',
    useTranslation: false,
    useDefinition: false,
    useExample: false,
    skipped: false,
  };
}

function blankRows(count: number, startAt = 1): WordDraft[] {
  return Array.from({ length: count }, (_, i) => ({
    id: nextDraftId(),
    lemma: '',
    verify: false,
    meanings: [emptyMeaning(startAt + i)],
  }));
}

function renumberMeanings(words: WordDraft[]): WordDraft[] {
  let n = 1;
  return words.map((word) => ({
    ...word,
    meanings: word.meanings.map((meaning) => ({ ...meaning, rowNumber: n++ })),
  }));
}

function toDrafts(words: ParsedWord[]): WordDraft[] {
  return renumberMeanings(
    words.map((word) => ({
      id: nextDraftId(),
      lemma: word.lemma,
      verify: false,
      meanings: word.meanings.map((meaning) => ({
        ...meaning,
        useTranslation: meaning.translation.length > 0,
        useDefinition: meaning.definition.length > 0,
        useExample: meaning.example.length > 0,
        skipped: false,
      })),
    })),
  );
}

function activeMeanings(word: WordDraft) {
  return word.meanings.filter((meaning) => {
    if (meaning.skipped) return false;
    const translation = meaning.useTranslation ? meaning.translation : '';
    const definition = meaning.useDefinition ? meaning.definition : '';
    return translation.length > 0 || definition.length > 0;
  });
}

function toPayload(words: WordDraft[], notes: string, canVerify: boolean): ImportWordPayload[] {
  return words
    .map((word) => ({
      lemma: word.lemma.trim(),
      verify: canVerify && word.verify,
      notes: notes.trim() || undefined,
      meanings: activeMeanings(word).map((meaning) => ({
        translation: meaning.useTranslation ? meaning.translation : undefined,
        definition: meaning.useDefinition ? meaning.definition : undefined,
        example: meaning.useExample && meaning.example ? meaning.example : undefined,
      })),
    }))
    .filter((word) => word.lemma.length > 0 && word.meanings.length > 0);
}

async function sendChunks(
  mode: 'validate' | 'commit',
  items: ImportWordPayload[],
  onProgress?: (done: number, total: number) => void,
) {
  const all: ImportWordResultItem[] = [];
  for (let i = 0; i < items.length; i += CHUNK) {
    const slice = items.slice(i, i + CHUNK);
    onProgress?.(Math.min(i + slice.length, items.length), items.length);
    const part = await importWordsRequest({ mode, items: slice });
    all.push(...part);
  }
  return all;
}

function summarize(items: ImportWordResultItem[]) {
  const published = items.filter((item) => item.outcome === 'created' && item.status === 'published').length;
  const drafts = items.filter((item) => item.outcome === 'created' && item.status !== 'published').length;
  const added = items
    .filter((item) => item.outcome === 'meanings_added')
    .reduce((n, item) => n + item.meanings_added, 0);
  const skipped = items.filter((item) => item.outcome === 'skipped').length;
  const invalid = items.filter((item) => item.outcome === 'invalid').length;
  return { published, drafts, added, skipped, invalid };
}

export function ImportWordsDrawer({
  open,
  canVerify,
  onClose,
}: {
  open: boolean;
  canVerify: boolean;
  onClose: () => void;
}) {
  const { message } = AntdApp.useApp();
  const { token } = theme.useToken();
  const [words, setWords] = useState<WordDraft[]>([]);
  const [notes, setNotes] = useState('');
  const [appliedNotes, setAppliedNotes] = useState('');
  const [server, setServer] = useState<Record<string, ImportWordResultItem>>({});
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string>();
  const [parseError, setParseError] = useState<string>();
  const [sourceLabel, setSourceLabel] = useState<string>();
  const [chooserOpen, setChooserOpen] = useState(true);
  const [find, setFind] = useState('');
  const [kbbiTarget, setKbbiTarget] = useState<{
    wordId: string;
    rowNumber: number;
    translation: string;
  } | null>(null);

  const payload = useMemo(() => toPayload(words, appliedNotes, canVerify), [words, appliedNotes, canVerify]);

  const patchMeaning = (wordId: string, rowNumber: number, next: Partial<MeaningDraft>) => {
    setWords((current) =>
      current.map((word) =>
        word.id === wordId
          ? {
              ...word,
              meanings: word.meanings.map((meaning) =>
                meaning.rowNumber === rowNumber ? { ...meaning, ...next } : meaning,
              ),
            }
          : word,
      ),
    );
  };

  const resetToChooser = () => {
    setWords([]);
    setServer({});
    setSourceLabel(undefined);
    setParseError(undefined);
    setAppliedNotes('');
    setNotes('');
    setFind('');
    setChooserOpen(true);
  };

  const startManual = () => {
    setParseError(undefined);
    setServer({});
    setSourceLabel('Lembar manual');
    setWords(blankRows(MANUAL_STARTER_ROWS));
    setFind('');
    setChooserOpen(false);
  };

  const addRows = (count: number) => {
    setWords((current) => {
      const startAt = current.reduce((n, word) => n + word.meanings.length, 0) + 1;
      return [...current, ...blankRows(count, startAt)];
    });
  };

  const removeRow = (wordId: string, rowNumber: number) => {
    setWords((current) =>
      renumberMeanings(
        current
          .map((word) =>
            word.id === wordId
              ? { ...word, meanings: word.meanings.filter((meaning) => meaning.rowNumber !== rowNumber) }
              : word,
          )
          .filter((word) => word.meanings.length > 0),
      ),
    );
  };

  const onFile = async (file: File) => {
    setParseError(undefined);
    setServer({});
    setSourceLabel(file.name);
    try {
      const text = await file.text();
      const parsed = parseImportCsv(text);
      setWords(toDrafts(parsed.words));
      setFind('');
      setChooserOpen(false);
    } catch (err) {
      setWords([]);
      setChooserOpen(true);
      setParseError(err instanceof Error ? err.message : 'File tidak bisa dibaca');
    }
    return false;
  };

  const downloadTemplate = () => {
    const blob = new Blob([importTemplateCsv()], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'templat-import-kata.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const downloadReport = (items: ImportWordResultItem[]) => {
    const lines = [
      'lemma,hasil,pesan',
      ...items.map((item) =>
        [item.lemma, item.outcome, item.message ?? '']
          .map((cell) => `"${cell.replaceAll('"', '""')}"`)
          .join(','),
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'laporan-import-kata.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const save = async () => {
    if (payload.length === 0) {
      message.warning('Tidak ada kata yang bisa disimpan. Isi kata + terjemahan atau penjelasan arti.');
      return;
    }
    setBusy(true);
    try {
      const checked = await sendChunks('validate', payload, (done, total) => {
        setProgress(total > CHUNK ? `Memeriksa ${done} dari ${total}` : undefined);
      });
      setServer(Object.fromEntries(checked.map((item) => [item.lemma.toLowerCase(), item])));
      const counts = summarize(checked);
      Modal.confirm({
        title: 'Simpan impor ini?',
        content: `${counts.published} kata tayang, ${counts.drafts} draf, ${counts.added} makna ditambahkan ke kata yang sudah ada, ${counts.skipped} dilewati. Dikirim ${CHUNK} kata sekali.`,
        okText: 'Simpan',
        cancelText: 'Batal',
        onOk: async () => {
          setBusy(true);
          const saved: ImportWordResultItem[] = [];
          try {
            for (let i = 0; i < payload.length; i += CHUNK) {
              const slice = payload.slice(i, i + CHUNK);
              const done = Math.min(i + slice.length, payload.length);
              setProgress(payload.length > CHUNK ? `Menyimpan ${done} dari ${payload.length}` : undefined);
              const part = await importWordsRequest({ mode: 'commit', items: slice });
              saved.push(...part);
            }
            const done = summarize(saved);
            message.success(`${done.published} tayang, ${done.drafts} draf, ${done.added} makna ditambahkan`);
            downloadReport(saved);
            resetToChooser();
            onClose();
          } catch (err) {
            if (saved.length > 0) {
              const doneLemmas = new Set(saved.map((item) => item.lemma.trim().toLowerCase()));
              setWords((current) =>
                current.filter((word) => !doneLemmas.has(word.lemma.trim().toLowerCase())),
              );
              downloadReport(saved);
              message.error(
                `${saved.length} kata sudah tersimpan. Sisa lembar belum terkirim: ${normalizeError(err).message || 'impor gagal'}`,
              );
            } else {
              message.error(normalizeError(err).message || 'Impor gagal');
            }
          } finally {
            setBusy(false);
            setProgress(undefined);
          }
        },
      });
    } catch (err) {
      message.error(normalizeError(err).message || 'Impor gagal');
    } finally {
      setBusy(false);
      setProgress(undefined);
    }
  };

  const meaningCount = words.reduce((n, word) => n + word.meanings.length, 0);
  const readyCount = words.filter((word) => canVerify && word.verify && activeMeanings(word).length > 0).length;

  const onSheetText = (
    wordId: string,
    rowNumber: number,
    col: 'lemma' | 'translation' | 'definition' | 'example',
    value: string,
  ) => {
    const next = value.trim();
    if (col === 'lemma') {
      const current = words.find((word) => word.id === wordId);
      if (!current || next === current.lemma) return;
      if (next) {
        const taken = words.some(
          (word) => word.id !== wordId && word.lemma.toLowerCase() === next.toLowerCase(),
        );
        if (taken) {
          message.warning(`"${next}" sudah ada di lembar ini`);
          return;
        }
      }
      setWords((currentWords) =>
        currentWords.map((word) => (word.id === wordId ? { ...word, lemma: next } : word)),
      );
      return;
    }
    const flag =
      col === 'translation' ? 'useTranslation' : col === 'definition' ? 'useDefinition' : 'useExample';
    patchMeaning(wordId, rowNumber, { [col]: next, [flag]: next.length > 0 });
  };

  return (
    <Drawer
      title={
        <div>
          <div>Impor kata (massal sederhana)</div>
          <Typography.Text type="secondary" style={{ fontWeight: 400, fontSize: 13 }}>
            Lembar Excel yang sama untuk isi manual atau file CSV. Endpoint simpan sama. Kolom: kata,
            terjemahan, penjelasan arti, contoh.
          </Typography.Text>
        </div>
      }
      size={1080}
      open={open}
      onClose={onClose}
      styles={{ body: { padding: 0, background: token.colorBgLayout } }}
      footer={
        words.length > 0 ? (
          <Flex justify="space-between" align="center" gap={12}>
            <Typography.Text type="secondary">
              {progress ??
                `${words.length} baris · ${payload.length} siap kirim${canVerify ? ` · ${readyCount} siap tayang` : ''}${appliedNotes ? ' · catatan menempel pada kata baru' : ''}`}
            </Typography.Text>
            <Flex gap={8}>
              <Button onClick={onClose}>Tutup</Button>
              <Button type="primary" loading={busy} disabled={payload.length === 0} onClick={() => void save()}>
                Simpan
              </Button>
            </Flex>
          </Flex>
        ) : null
      }
    >
      {words.length > 0 && !chooserOpen ? (
        <Flex
          align="center"
          gap={12}
          style={{
            padding: '10px 20px',
            background: token.colorBgContainer,
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
          }}
        >
          <FileTextOutlined style={{ color: token.colorTextSecondary }} />
          <Flex vertical style={{ flex: 1, minWidth: 0 }}>
            <Typography.Text strong ellipsis>
              {sourceLabel ?? 'Lembar'}
            </Typography.Text>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {meaningCount} baris · keyboard seperti Excel (panah, Tab, Enter, F2, ⌘⌫ hapus baris)
            </Typography.Text>
          </Flex>
          <Button icon={<PlusOutlined />} onClick={() => addRows(5)}>
            Tambah 5 baris
          </Button>
          <Button onClick={downloadTemplate}>Templat CSV</Button>
          <Button onClick={resetToChooser}>Mulai ulang</Button>
        </Flex>
      ) : (
        <div style={{ padding: 28 }}>
          <Flex vertical gap={20}>
            <Flex justify="space-between" align="end" gap={16} wrap>
              <div>
                <Typography.Title level={5} style={{ margin: 0 }}>
                  Isi manual di lembar
                </Typography.Title>
                <Typography.Text type="secondary">
                  Buka grid kosong — styling dan navigasi sama seperti setelah impor CSV.
                </Typography.Text>
              </div>
              <Button type="primary" icon={<EditOutlined />} onClick={startManual}>
                Buka lembar kosong
              </Button>
            </Flex>

            <div>
              <Flex justify="space-between" align="end" style={{ marginBottom: 12 }}>
                <div>
                  <Typography.Title level={5} style={{ margin: 0 }}>
                    Atau dari file CSV
                  </Typography.Title>
                  <Typography.Text type="secondary">
                    Kolom kata, terjemahan, penjelasan_arti, contoh. Header lama (lemma/definisi) tetap
                    diterima.
                  </Typography.Text>
                </div>
                <Button onClick={downloadTemplate}>Unduh templat</Button>
              </Flex>
              <Upload.Dragger accept=".csv,text/csv" maxCount={1} showUploadList={false} beforeUpload={onFile}>
                <p className="ant-upload-drag-icon">
                  <InboxOutlined />
                </p>
                <p className="ant-upload-text">Taruh file CSV di sini</p>
                <p className="ant-upload-hint">Lepas dari Finder, atau klik untuk memilih</p>
              </Upload.Dragger>
              {parseError ? (
                <Typography.Text type="danger" style={{ display: 'block', marginTop: 8 }}>
                  {parseError}
                </Typography.Text>
              ) : null}
            </div>
          </Flex>
        </div>
      )}

      {words.length > 0 ? (
        <div style={{ padding: 16 }}>
          <Flex
            gap={8}
            align="center"
            wrap
            style={{
              marginBottom: 12,
              padding: 12,
              background: token.colorBgContainer,
              border: `1px solid ${token.colorBorderSecondary}`,
              borderRadius: token.borderRadiusLG,
            }}
          >
            <Input
              allowClear
              value={find}
              onChange={(e) => setFind(e.target.value)}
              placeholder="Cari kata, terjemahan, atau contoh"
              style={{ width: 260 }}
            />
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Catatan untuk kata baru, misalnya sumber glosarium"
              style={{ flex: '1 1 280px' }}
            />
            <Button onClick={() => setAppliedNotes(notes.trim())} disabled={!notes.trim()}>
              Terapkan
            </Button>
            {canVerify ? (
              <Button
                onClick={() =>
                  setWords((current) =>
                    current.map((word) => ({
                      ...word,
                      verify: word.lemma.trim().length > 0 && activeMeanings(word).length > 0,
                    })),
                  )
                }
              >
                Tandai semua siap tayang
              </Button>
            ) : null}
            {canVerify ? (
              <Button
                type="text"
                onClick={() => setWords((current) => current.map((word) => ({ ...word, verify: false })))}
              >
                Lepas semua
              </Button>
            ) : null}
          </Flex>
          {appliedNotes ? (
            <Typography.Paragraph type="secondary" style={{ marginTop: -4 }}>
              Catatan pada kata baru: {appliedNotes}
            </Typography.Paragraph>
          ) : null}
          <ImportSheet
            canVerify={canVerify}
            words={words.map((word) => ({
              id: word.id,
              lemma: word.lemma,
              verify: word.verify,
              message: word.lemma.trim()
                ? server[word.lemma.trim().toLowerCase()]?.message
                : undefined,
              meanings: word.meanings.map((meaning) => ({
                rowNumber: meaning.rowNumber,
                translation: meaning.translation,
                definition: meaning.definition,
                example: meaning.example,
                skipped: meaning.skipped,
              })),
            }))}
            onText={onSheetText}
            onSkip={(wordId, rowNumber, skipped) => patchMeaning(wordId, rowNumber, { skipped })}
            onVerify={(wordId, verify) =>
              setWords((current) =>
                current.map((word) => (word.id === wordId ? { ...word, verify } : word)),
              )
            }
            onRemove={removeRow}
            onKbbi={(wordId, rowNumber, translation) =>
              setKbbiTarget({ wordId, rowNumber, translation })
            }
            query={find}
          />
          <KbbiDefinitionPickerModal
            open={kbbiTarget !== null}
            initialLemma={kbbiTarget?.translation ?? ''}
            onClose={() => setKbbiTarget(null)}
            onSelect={(suggestion) => {
              if (!kbbiTarget) return;
              const translation = suggestion.lemma.trim();
              const definition = suggestion.definition.trim();
              patchMeaning(kbbiTarget.wordId, kbbiTarget.rowNumber, {
                ...(translation ? { translation, useTranslation: true } : {}),
                ...(definition ? { definition, useDefinition: true } : {}),
              });
              message.success('Terjemahan dan penjelasan arti diisi dari KBBI');
            }}
          />
        </div>
      ) : null}
    </Drawer>
  );
}
