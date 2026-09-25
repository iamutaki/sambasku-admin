import { useMemo, useRef, useState } from 'react';
import { EditOutlined, FileTextOutlined, HistoryOutlined, InboxOutlined, PlusOutlined } from '@ant-design/icons';
import { useQueryClient } from '@tanstack/react-query';
import { Alert, App as AntdApp, Button, Drawer, Flex, Input, Modal, Progress, Spin, Steps, Typography, Upload, theme } from 'antd';
import { useNavigate } from '@tanstack/react-router';
import { normalizeError, type ApiError } from '@/shared/api/error';
import {
  importTemplateCsv,
  parseImportCsv,
  type ParsedWord,
} from '../application/parse-import-csv';
import { importWordsRequest, saveWordImportSessionRequest, type ImportWordPayload, type ImportWordResultItem, type WordImportSessionStatus } from '../infrastructure/word-api';
import { generateOpaqueId } from '@/shared/utils/opaque-id';
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

type WordImportStatus = 'pending' | 'saved' | 'failed';

interface WordDraft {
  id: string;
  lemma: string;
  verify: boolean;
  verified: boolean;
  meanings: MeaningDraft[];
  note?: string;
  importStatus?: WordImportStatus;
  importError?: string;
}

type ImportProgress = {
  phase: 'sending' | 'done' | 'failed' | 'cancelled';
  done: number;
  total: number;
  lemma?: string;
  attempt?: number;
  maxAttempts?: number;
  created: number;
  duplicates: number;
  meaningsAdded: number;
  invalid: number;
};

type ResumeSummary = {
  saved: number;
  remaining: number;
  created: number;
  duplicates: number;
  meaningsAdded: number;
  invalid: number;
};

function emptyCounters() {
  return { created: 0, duplicates: 0, meaningsAdded: 0, invalid: 0 };
}

function applyResultCounters(
  counters: { created: number; duplicates: number; meaningsAdded: number; invalid: number },
  result: ImportWordResultItem,
) {
  if (result.outcome === 'created') counters.created += 1;
  else if (result.outcome === 'skipped') counters.duplicates += 1;
  else if (result.outcome === 'meanings_added') counters.meaningsAdded += result.meanings_added;
  else if (result.outcome === 'invalid') counters.invalid += 1;
  return counters;
}

/** Satu kata per request — aman untuk budget subrequest Workers (~50/invocation). */
const CHUNK = 1;
/** Percobaan maksimal per kata; gagal 5× → hentikan impor (partial tetap disimpan). */
const MAX_ATTEMPTS = 5;
/** Backoff antar percobaan gagal (ms). */
const RETRY_BACKOFF_MS = [2000, 5000, 10000, 15000, 20000] as const;
/** Jeda singkat antar kata sukses — jaga rate limit 30/menit. */
const WORD_GAP_MS = 2000;
/** Jedah singkat agar step Selesai/Gagal sempat terbaca. */
const PHASE_HOLD_MS = 900;
const MANUAL_STARTER_ROWS = 12;
const DRAFT_PUBLISH_HINT =
  'Draf muncul di tab Tidak tayang. Nyalakan sakelar Tayang di sana untuk menayangkan.';

class ImportCancelledError extends Error {
  constructor() {
    super('Impor dibatalkan');
    this.name = 'ImportCancelledError';
  }
}

function sleep(ms: number, isCancelled?: () => boolean) {
  const step = 100;
  let waited = 0;
  return (async () => {
    while (waited < ms) {
      if (isCancelled?.()) throw new ImportCancelledError();
      const chunk = Math.min(step, ms - waited);
      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, chunk);
      });
      waited += chunk;
    }
  })();
}

function isRetryableImportError(err: ApiError): boolean {
  if (err.errorCode === 'UPSTREAM_CAPACITY' || err.errorCode === 'RATE_LIMITED') return true;
  if (err.errorCode === 'NETWORK_ERROR' || err.errorCode === 'TIMEOUT_ERROR') return true;
  if (err.status === 0 || err.status === 429) return true;
  if (err.status === 502 || err.status === 503 || err.status === 504) return true;
  return false;
}

async function importOneWithRetry(
  item: ImportWordPayload,
  onAttempt?: (attempt: number) => void,
  isCancelled?: () => boolean,
): Promise<ImportWordResultItem> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    if (isCancelled?.()) throw new ImportCancelledError();
    onAttempt?.(attempt);
    try {
      const part = await importWordsRequest({ mode: 'commit', items: [item] });
      const result = part[0];
      if (!result) {
        throw normalizeError(new Error('Respons impor kosong'), 'Respons impor kosong');
      }
      // Request sudah sukses: jangan buang hasil meski user baru membatalkan.
      return result;
    } catch (err) {
      if (err instanceof ImportCancelledError) throw err;
      lastError = err;
      const normalized = normalizeError(err);
      if (!isRetryableImportError(normalized) || attempt >= MAX_ATTEMPTS) {
        throw err;
      }
      await sleep(RETRY_BACKOFF_MS[attempt - 1] ?? RETRY_BACKOFF_MS[RETRY_BACKOFF_MS.length - 1], isCancelled);
    }
  }
  throw lastError;
}

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
    verified: false,
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
      verified: false,
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
      verified: canVerify && word.verified,
      notes: notes.trim() || undefined,
      meanings: activeMeanings(word).map((meaning) => ({
        translation: meaning.useTranslation ? meaning.translation : undefined,
        definition: meaning.useDefinition ? meaning.definition : undefined,
        example: meaning.useExample && meaning.example ? meaning.example : undefined,
      })),
    }))
    .filter((word) => word.lemma.length > 0 && word.meanings.length > 0);
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

/** Pratinjau lokal — tanpa hit API validate (hemat beban Workers). */
function previewLocal(items: ImportWordPayload[]) {
  const publish = items.filter((item) => item.verify).length;
  const draft = items.length - publish;
  return { publish, draft, total: items.length };
}

function clearImportMarks(words: WordDraft[]): WordDraft[] {
  return words.map((word) => ({
    ...word,
    importStatus: undefined,
    importError: undefined,
  }));
}

export function ImportWordsDrawer({
  open,
  canVerify,
  onClose,
  onImported,
}: {
  open: boolean;
  canVerify: boolean;
  onClose: () => void;
  onImported?: (summary: { drafts: number; published: number }) => void;
}) {
  const { message } = AntdApp.useApp();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { token } = theme.useToken();
  const cancelRef = useRef(false);
  const [cancelling, setCancelling] = useState(false);
  const [words, setWords] = useState<WordDraft[]>([]);
  const [notes, setNotes] = useState('');
  const [appliedNotes, setAppliedNotes] = useState('');
  const [server, setServer] = useState<Record<string, ImportWordResultItem>>({});
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<ImportProgress>();
  const [resume, setResume] = useState<ResumeSummary>();
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
  const failedCount = words.filter((word) => word.importStatus === 'failed').length;
  const isCancelled = () => cancelRef.current;

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
    setResume(undefined);
    setChooserOpen(true);
  };

  const startManual = () => {
    setParseError(undefined);
    setServer({});
    setSourceLabel('Lembar manual');
    setWords(blankRows(MANUAL_STARTER_ROWS));
    setFind('');
    setResume(undefined);
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
    setResume(undefined);
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

  const runCommitImport = async () => {
    cancelRef.current = false;
    setCancelling(false);
    setBusy(true);
    setResume(undefined);
    setWords((current) => clearImportMarks(current));
    const sessionId = generateOpaqueId();
    const counters = emptyCounters();
    const total = payload.length;
    setProgress({
      phase: 'sending',
      done: 0,
      total,
      attempt: 1,
      maxAttempts: MAX_ATTEMPTS,
      ...emptyCounters(),
    });
    const saved: ImportWordResultItem[] = [];
    let currentLemma = '';
    let historyPersistFailed = false;

    const persistSession = async (status: WordImportSessionStatus) => {
      try {
        await saveWordImportSessionRequest({
          id: sessionId,
          source_label: sourceLabel ?? null,
          status,
          total,
          created_count: counters.created,
          duplicates_count: counters.duplicates,
          meanings_added_count: counters.meaningsAdded,
          invalid_count: counters.invalid,
          items: saved.map((item) => ({
            lemma: item.lemma,
            outcome: item.outcome,
            meanings_added: item.meanings_added,
            message: item.message,
          })),
        });
        void queryClient.invalidateQueries({ queryKey: ['word-import-sessions'] });
      } catch {
        // Jangan gagalkan impor kata; beri tahu sekali agar seed/migrate dicek.
        if (!historyPersistFailed) {
          historyPersistFailed = true;
          message.warning(
            'Kata tersimpan, tapi riwayat impor gagal disimpan. Cek seed Importir Data CSV dan migrate word_import_sessions.',
            6,
          );
        }
      }
    };

    // Jejak awal — cancel sebelum kata pertama tetap punya record.
    await persistSession('running');

    try {
      for (let i = 0; i < payload.length; i += 1) {
        if (isCancelled()) throw new ImportCancelledError();
        const item = payload[i]!;
        currentLemma = item.lemma;
        setProgress({
          phase: 'sending',
          done: i,
          total,
          lemma: item.lemma,
          attempt: 1,
          maxAttempts: MAX_ATTEMPTS,
          ...counters,
        });
        const result = await importOneWithRetry(
          item,
          (attempt) => {
            setProgress({
              phase: 'sending',
              done: i,
              total,
              lemma: item.lemma,
              attempt,
              maxAttempts: MAX_ATTEMPTS,
              ...counters,
            });
          },
          isCancelled,
        );
        saved.push(result);
        applyResultCounters(counters, result);
        setServer((current) => ({ ...current, [result.lemma.toLowerCase()]: result }));
        setWords((current) =>
          current.filter((word) => word.lemma.trim().toLowerCase() !== result.lemma.trim().toLowerCase()),
        );
        setProgress({
          phase: 'sending',
          done: i + 1,
          total,
          lemma: item.lemma,
          attempt: 1,
          maxAttempts: MAX_ATTEMPTS,
          ...counters,
        });
        // Progressive upsert — batal/gagal parsial tetap punya jejak di riwayat.
        await persistSession('running');
        if (i + CHUNK < payload.length) {
          await sleep(WORD_GAP_MS, isCancelled);
        }
      }
      setProgress({
        phase: 'done',
        done: total,
        total,
        lemma: currentLemma,
        ...counters,
      });
      await sleep(PHASE_HOLD_MS);
      await persistSession('completed');
      const done = summarize(saved);
      void queryClient.invalidateQueries({ queryKey: ['words'] });
      message.success(
        `${done.published} tayang, ${done.drafts} draf, ${done.added} makna ditambahkan.${done.drafts > 0 ? ` ${DRAFT_PUBLISH_HINT}` : ''}`,
        done.drafts > 0 ? 6 : 3,
      );
      downloadReport(saved);
      resetToChooser();
      onImported?.({ drafts: done.drafts, published: done.published });
      onClose();
    } catch (err) {
      const cancelled = err instanceof ImportCancelledError;
      const remaining = total - saved.length;

      setWords((current) =>
        renumberMeanings(
          current.filter((word) => {
            const key = word.lemma.trim().toLowerCase();
            return !saved.some((item) => item.lemma.trim().toLowerCase() === key);
          }),
        ),
      );

      if (cancelled) {
        setProgress({
          phase: 'cancelled',
          done: saved.length,
          total,
          lemma: currentLemma || undefined,
          ...counters,
        });
        setResume(
          remaining > 0 || saved.length > 0
            ? {
                saved: saved.length,
                remaining,
                ...counters,
              }
            : undefined,
        );
        await persistSession('cancelled');
        if (saved.length > 0) {
          downloadReport(saved);
          void queryClient.invalidateQueries({ queryKey: ['words'] });
          const partial = summarize(saved);
          message.warning(
            `Impor dibatalkan. ${saved.length} kata sudah tersimpan, ${remaining} tersisa di lembar.`,
          );
          onImported?.({ drafts: partial.drafts, published: partial.published });
        } else {
          message.info('Impor dibatalkan. Belum ada kata yang tersimpan.');
        }
        await sleep(PHASE_HOLD_MS);
        return;
      }

      const normalized = normalizeError(err);
      const exhausted = isRetryableImportError(normalized);
      const stopReason = exhausted
        ? `berhenti setelah ${MAX_ATTEMPTS} percobaan gagal`
        : 'berhenti (error tidak bisa diulang)';
      const failedKey = currentLemma.trim().toLowerCase();
      const errorMessage = normalized.message || 'impor gagal';

      setProgress({
        phase: 'failed',
        done: saved.length,
        total,
        lemma: currentLemma,
        attempt: MAX_ATTEMPTS,
        maxAttempts: MAX_ATTEMPTS,
        ...counters,
      });

      setWords((current) =>
        renumberMeanings(
          current.map((word) =>
            word.lemma.trim().toLowerCase() === failedKey
              ? { ...word, importStatus: 'failed' as const, importError: errorMessage }
              : { ...word, importStatus: undefined, importError: undefined },
          ),
        ),
      );

      setResume({ saved: saved.length, remaining, ...counters });
      await persistSession('failed');

      if (saved.length > 0) {
        downloadReport(saved);
        void queryClient.invalidateQueries({ queryKey: ['words'] });
        const partial = summarize(saved);
        message.error(
          `${saved.length} kata sudah tersimpan. Impor ${stopReason}: ${errorMessage}${partial.drafts > 0 ? ` ${DRAFT_PUBLISH_HINT}` : ''}`,
        );
        onImported?.({ drafts: partial.drafts, published: partial.published });
      } else {
        message.error(`Impor ${stopReason}: ${errorMessage}`);
      }

      await sleep(PHASE_HOLD_MS);
    } finally {
      message.destroy('import-cancel');
      cancelRef.current = false;
      setCancelling(false);
      setBusy(false);
      setProgress(undefined);
    }
  };

  const requestCancelImport = () => {
    if (!busy || progress?.phase !== 'sending' || cancelRef.current) return;
    cancelRef.current = true;
    setCancelling(true);
    message.loading({
      content: 'Membatalkan… kata yang sedang diproses tetap diselesaikan dulu.',
      key: 'import-cancel',
      duration: 0,
    });
  };

  const save = () => {
    if (payload.length === 0) {
      message.warning('Tidak ada kata yang bisa disimpan. Isi kata + terjemahan atau penjelasan arti.');
      return;
    }
    if (busy) return;
    const preview = previewLocal(payload);
    Modal.confirm({
      title: 'Simpan impor ini?',
      content: (
        <div>
          <div>
            {preview.total} kata siap dikirim satu per satu
            {canVerify ? ` · perkiraan ${preview.publish} tayang, ${preview.draft} draf` : ''}. Gagal
            sementara akan dicoba ulang hingga {MAX_ATTEMPTS}× per kata.
          </div>
          {preview.draft > 0 && canVerify ? <div style={{ marginTop: 8 }}>{DRAFT_PUBLISH_HINT}</div> : null}
        </div>
      ),
      okText: 'Simpan',
      cancelText: 'Batal',
      // Jangan await impor di onOk — modal harus tutup dulu.
      // Kalau di-await, klik Batal menutup dialog tapi overlay busy tetap nyangkut.
      onOk: () => {
        void runCommitImport();
      },
      onCancel: () => {
        if (!busy) {
          setProgress(undefined);
        }
      },
    });
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
        currentWords.map((word) =>
          word.id === wordId
            ? { ...word, lemma: next, importStatus: undefined, importError: undefined }
            : word,
        ),
      );
      return;
    }
    const flag =
      col === 'translation' ? 'useTranslation' : col === 'definition' ? 'useDefinition' : 'useExample';
    patchMeaning(wordId, rowNumber, { [col]: next, [flag]: next.length > 0 });
  };

  const stepIndex =
    progress?.phase === 'done' || progress?.phase === 'failed' || progress?.phase === 'cancelled' ? 2 : progress ? 1 : 0;
  const retryHint =
    progress && progress.attempt && progress.attempt > 1
      ? ` · coba lagi ${progress.attempt}/${progress.maxAttempts ?? MAX_ATTEMPTS}`
      : '';
  const progressPercent =
    progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
  const progressStatus =
    progress?.phase === 'failed' || progress?.phase === 'cancelled'
      ? 'exception'
      : progress?.phase === 'done'
        ? 'success'
        : 'active';
  const phaseTitle =
    progress?.phase === 'done'
      ? 'Impor selesai'
      : progress?.phase === 'failed'
        ? 'Impor terhenti'
        : progress?.phase === 'cancelled'
          ? 'Impor dibatalkan'
          : cancelling
            ? 'Membatalkan…'
            : progress?.attempt && progress.attempt > 1
              ? 'Mencoba ulang…'
              : 'Mengirim kata…';
  const phaseNote =
    progress?.phase === 'done'
      ? 'Semua kata di antrian ini berhasil disimpan.'
      : progress?.phase === 'failed'
        ? 'Kata yang sudah berhasil dihapus dari lembar. Baris merah dan sisa data siap dikirim ulang.'
        : progress?.phase === 'cancelled'
          ? 'Kata yang sudah tersimpan dihapus dari lembar. Sisa antrian siap dikirim ulang kapan saja.'
          : cancelling
            ? 'Menunggu kata yang sedang diproses selesai, lalu impor dihentikan.'
            : progress?.attempt && progress.attempt > 1
              ? `Server sibuk atau kapasitas penuh. Percobaan ${progress.attempt} dari ${progress.maxAttempts ?? MAX_ATTEMPTS} untuk kata ini.`
              : `Satu kata per permintaan, jeda ${WORD_GAP_MS / 1000}s antar kata. Anda bisa membatalkan kapan saja.`;

  const stepStatus =
    progress?.phase === 'failed' || progress?.phase === 'cancelled'
      ? 'error'
      : progress?.phase === 'done'
        ? 'finish'
        : 'process';
  const stepEndTitle =
    progress?.phase === 'failed' ? 'Gagal' : progress?.phase === 'cancelled' ? 'Dibatalkan' : 'Selesai';

  return (
    <Drawer
      title={
        <div>
          <div>Impor kata massal</div>
          <Typography.Text type="secondary" style={{ fontWeight: 400, fontSize: 12 }}>
            Lembar manual atau CSV · kata, terjemahan, penjelasan arti, contoh
          </Typography.Text>
          <div>
            <Button
              type="link"
              size="small"
              icon={<HistoryOutlined />}
              style={{ padding: 0, height: 'auto', fontSize: 12 }}
              onClick={() => {
                onClose();
                void navigate({ to: '/words/import-history' });
              }}
            >
              Riwayat impor
            </Button>
          </div>
        </div>
      }
      size={1080}
      open={open}
      onClose={() => {
        if (!busy) onClose();
      }}
      maskClosable={!busy}
      styles={{ body: { padding: 0, background: token.colorBgLayout, position: 'relative' } }}
      footer={
        words.length > 0 ? (
          <Flex justify="space-between" align="center" gap={12}>
            <Typography.Text type="secondary">
              {progress
                ? `Mengirim ${progress.done} / ${progress.total}${retryHint}`
                : `${words.length} baris · ${payload.length} siap kirim${canVerify ? ` · ${readyCount} siap tayang` : ''}${failedCount > 0 ? ` · ${failedCount} gagal` : ''}${appliedNotes ? ' · catatan menempel' : ''}`}
            </Typography.Text>
            <Flex gap={8}>
              <Button onClick={onClose} disabled={busy}>
                Tutup
              </Button>
              <Button type="primary" loading={busy} disabled={payload.length === 0} onClick={() => save()}>
                {resume ? 'Simpan sisa' : 'Simpan'}
              </Button>
            </Flex>
          </Flex>
        ) : null
      }
    >
      {busy && progress ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(255, 255, 255, 0.78)',
            backdropFilter: 'blur(1px)',
            padding: 24,
          }}
        >
          <Flex
            vertical
            gap={16}
            style={{
              width: 'min(460px, 100%)',
              padding: 24,
              background: token.colorBgContainer,
              borderRadius: token.borderRadiusLG,
              border: `1px solid ${token.colorBorderSecondary}`,
              boxShadow: token.boxShadowSecondary,
            }}
          >
            <Steps
              size="small"
              current={stepIndex}
              status={stepStatus}
              items={[
                { title: 'Siap' },
                { title: 'Mengirim' },
                { title: stepEndTitle },
              ]}
            />

            <Flex align="center" gap={10}>
              {progress.phase === 'sending' ? <Spin size="small" /> : null}
              <Typography.Text strong style={{ fontSize: 15 }}>
                {phaseTitle}
              </Typography.Text>
            </Flex>

            <div>
              <Flex justify="space-between" align="baseline" style={{ marginBottom: 6 }}>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  Progres
                </Typography.Text>
                <Typography.Text strong style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {progress.done} / {progress.total}
                  <Typography.Text type="secondary" style={{ fontWeight: 400, marginLeft: 6 }}>
                    ({progressPercent}%)
                  </Typography.Text>
                </Typography.Text>
              </Flex>
              <Progress
                percent={progressPercent}
                status={progressStatus}
                showInfo={false}
                strokeColor={
                  progress.phase === 'failed' || progress.phase === 'cancelled'
                    ? token.colorError
                    : progress.phase === 'done'
                      ? token.colorSuccess
                      : token.colorPrimary
                }
              />
            </div>

            <Flex wrap gap={12} style={{ fontSize: 12 }}>
              <Typography.Text type="secondary">
                Diproses{' '}
                <Typography.Text strong style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {progress.done} / {progress.total}
                </Typography.Text>
              </Typography.Text>
              <Typography.Text type="secondary">
                Kata baru{' '}
                <Typography.Text strong style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {progress.created}
                </Typography.Text>
              </Typography.Text>
              <Typography.Text type="secondary">
                Duplikat dilewati{' '}
                <Typography.Text strong style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {progress.duplicates}
                </Typography.Text>
              </Typography.Text>
              <Typography.Text type="secondary">
                Makna ditambah{' '}
                <Typography.Text strong style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {progress.meaningsAdded}
                </Typography.Text>
              </Typography.Text>
            </Flex>

            {progress.lemma ? (
              <Flex
                vertical
                gap={2}
                style={{
                  padding: '10px 12px',
                  background: token.colorFillAlter,
                  borderRadius: token.borderRadius,
                  border: `1px solid ${token.colorBorderSecondary}`,
                }}
              >
                <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                  {progress.phase === 'sending'
                    ? progress.attempt && progress.attempt > 1
                      ? 'Sedang mencoba ulang'
                      : cancelling
                        ? 'Menyelesaikan sebelum batal'
                        : 'Sedang diproses'
                    : progress.phase === 'failed'
                      ? 'Terhenti pada'
                      : progress.phase === 'cancelled'
                        ? 'Berhenti sebelum'
                        : 'Kata terakhir'}
                </Typography.Text>
                <Typography.Text strong ellipsis style={{ fontSize: 14 }}>
                  {progress.lemma}
                </Typography.Text>
                {progress.phase === 'sending' && progress.attempt && progress.attempt > 1 ? (
                  <Typography.Text type="warning" style={{ fontSize: 12 }}>
                    Percobaan {progress.attempt} / {progress.maxAttempts ?? MAX_ATTEMPTS}
                  </Typography.Text>
                ) : null}
              </Flex>
            ) : null}

            <Typography.Paragraph
              type="secondary"
              style={{ margin: 0, fontSize: 12, lineHeight: 1.55 }}
            >
              {phaseNote}
            </Typography.Paragraph>

            {progress.phase === 'sending' ? (
              <Button danger block disabled={cancelling} onClick={requestCancelImport}>
                {cancelling ? 'Membatalkan…' : 'Batalkan impor'}
              </Button>
            ) : null}
          </Flex>
        </div>
      ) : null}

      {words.length > 0 && !chooserOpen ? (
        <Flex
          align="center"
          gap={8}
          style={{
            padding: '8px 16px',
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
              {meaningCount} baris · panah, Tab, Enter, F2, ⌘⌫
            </Typography.Text>
          </Flex>
          <Button size="small" icon={<PlusOutlined />} onClick={() => addRows(5)}>
            +5
          </Button>
          <Button size="small" onClick={downloadTemplate}>
            Templat
          </Button>
          <Button size="small" onClick={resetToChooser} disabled={busy}>
            Ulang
          </Button>
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
        <div style={{ padding: 12 }}>
          {resume ? (
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 8 }}
              message={
                failedCount > 0
                  ? `${resume.saved} kata tersimpan. ${resume.remaining} tersisa — baris merah gagal; perbaiki bila perlu, lalu Simpan sisa.`
                  : `${resume.saved} kata tersimpan. ${resume.remaining} tersisa di lembar — klik Simpan sisa untuk melanjutkan.`
              }
              description={`Kata baru ${resume.created} · Duplikat ${resume.duplicates} · Makna ditambah ${resume.meaningsAdded}${resume.invalid > 0 ? ` · Tidak valid ${resume.invalid}` : ''}`}
              closable
              onClose={() => setResume(undefined)}
            />
          ) : null}
          <Flex
            gap={8}
            align="center"
            wrap
            style={{
              marginBottom: 8,
              padding: '8px 10px',
              background: token.colorBgContainer,
              border: `1px solid ${token.colorBorderSecondary}`,
              borderRadius: token.borderRadiusLG,
            }}
          >
            <Input
              allowClear
              size="small"
              value={find}
              onChange={(e) => setFind(e.target.value)}
              placeholder="Cari…"
              style={{ width: 180 }}
            />
            <Input
              size="small"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Catatan sumber (kata baru)"
              style={{ flex: '1 1 200px' }}
            />
            <Button size="small" onClick={() => setAppliedNotes(notes.trim())} disabled={!notes.trim()}>
              Terapkan
            </Button>
            {canVerify ? (
              <Button
                size="small"
                onClick={() =>
                  setWords((current) =>
                    current.map((word) => {
                      const ready = word.lemma.trim().length > 0 && activeMeanings(word).length > 0;
                      return { ...word, verify: ready, verified: ready ? word.verified : false };
                    }),
                  )
                }
              >
                Semua tayang
              </Button>
            ) : null}
            {canVerify ? (
              <Button
                size="small"
                onClick={() =>
                  setWords((current) =>
                    current.map((word) => {
                      const ready = word.lemma.trim().length > 0 && activeMeanings(word).length > 0;
                      return ready ? { ...word, verify: true, verified: true } : word;
                    }),
                  )
                }
              >
                Semua verif
              </Button>
            ) : null}
            {canVerify ? (
              <Button
                size="small"
                type="text"
                onClick={() => setWords((current) => current.map((word) => ({ ...word, verify: false, verified: false })))}
              >
                Lepas
              </Button>
            ) : null}
          </Flex>
          {appliedNotes ? (
            <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 8, fontSize: 12 }}>
              Catatan: {appliedNotes}
            </Typography.Text>
          ) : null}
          <ImportSheet
            canVerify={canVerify}
            words={words.map((word) => ({
              id: word.id,
              lemma: word.lemma,
              verify: word.verify,
              verified: word.verified,
              importStatus: word.importStatus,
              importError: word.importError,
              message: word.lemma.trim()
                ? word.importError || server[word.lemma.trim().toLowerCase()]?.message
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
                current.map((word) =>
                  word.id === wordId ? { ...word, verify, verified: verify ? word.verified : false } : word,
                ),
              )
            }
            onVerified={(wordId, verified) =>
              setWords((current) =>
                current.map((word) =>
                  word.id === wordId ? { ...word, verified, verify: verified ? true : word.verify } : word,
                ),
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
