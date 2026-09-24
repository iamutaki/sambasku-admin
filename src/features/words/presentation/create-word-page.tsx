import { useEffect, useMemo, useRef, useState } from 'react';
import { BookOutlined, DeleteOutlined, PlusOutlined, SaveOutlined, SendOutlined } from '@ant-design/icons';
import {
  Alert,
  App as AntdApp,
  Button,
  Card,
  Checkbox,
  Collapse,
  Col,
  Flex,
  Form,
  Grid,
  Input,
  Row,
  Segmented,
  Select,
  Space,
  Typography,
  theme,
} from 'antd';
import { useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/shared/components/page-header';
import { ApiError } from '@/shared/api/error';
import { useAuth } from '@/shared/auth/use-auth';
import { buildCreateWordBody, fieldToNamePath, hasUploadingImages, pickDefaultDialectId, pickDefaultLanguageIds, pickUmumWordClassId } from '../application/create-word-utils';
import { matchWordClassId } from '../application/match-word-class';
import { useCreateWord } from '../application/use-create-word';
import {
  uploadPendingAudiosAfterCreate,
  type PendingExampleAudioDraft,
} from '../application/upload-pending-audios-after-create';
import { useCategoryOptions, useDialectOptions, useLanguageOptions, useWordClassOptions } from '../application/use-reference-data';
import type { CreateWordFormValues } from '../domain/create-word';
import { type WordStatus } from '../domain/word';
import {
  MeaningFields,
  PendingPronunciationAudioField,
  RelatedWordItem,
  UsageLabelsFields,
  WordVariantsField,
  buildRelationOptions,
  buildWordClassOptions,
  wordTypeOptions,
  type PendingPronunciationAudio,
} from './word-form-blocks';
import { WordImagesField } from './word-images-field';
import { KbbiDefinitionPickerModal } from './kbbi-definition-picker-modal';

const { Text } = Typography;

type FormFillMode = 'simple' | 'full';

const inlineStatusLabels: Record<WordStatus, string> = {
  draft: 'Draft',
  pending_review: 'Menunggu Review',
  published: 'Tayang',
  rejected: 'Ditolak',
  taken_down: 'Ditarik',
};

type MissDirection = 'lemma' | 'translation';

function readMissSearchParams(): {
  fromMiss?: string;
  term?: string;
  direction?: MissDirection;
} {
  // Baca dari URL (validateSearch di router /words/new)
  const p = new URLSearchParams(window.location.search);
  const fromMiss = p.get('from_miss') ?? undefined;
  const term = p.get('term') ?? undefined;
  const raw = p.get('direction');
  const direction: MissDirection | undefined =
    raw === 'lemma' || raw === 'translation' ? raw : undefined;
  return { fromMiss, term, direction };
}

export function CreateWordPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { message } = AntdApp.useApp();
  const { user } = useAuth();
  const { token: { colorFillAlter } } = theme.useToken();
  const { md } = Grid.useBreakpoint();

  const [form] = Form.useForm<CreateWordFormValues>();
  const createMutation = useCreateWord();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fillMode, setFillMode] = useState<FormFillMode>('simple');
  const [kbbiOpen, setKbbiOpen] = useState(false);
  const [pendingAudio, setPendingAudio] = useState<PendingPronunciationAudio | null>(null);
  /** Draft audio per contoh — diunggah berurutan setelah create + GET detail. */
  const [pendingExampleAudios, setPendingExampleAudios] = useState<
    Record<string, PendingPronunciationAudio | null>
  >({});
  const pendingExampleMetaRef = useRef<
    Record<string, { meaningIndex: number; exampleIndex: number; sourceSentence: string }>
  >({});
  const missParams = useMemo(() => readMissSearchParams(), []);

  const wordType = Form.useWatch('word_type', form) ?? 'word';
  const isContributor = user?.role === 'contributor';

  const languageQuery = useLanguageOptions();
  const wordClassQuery = useWordClassOptions();
  const categoryQuery = useCategoryOptions();

  const languages = useMemo(() => languageQuery.data ?? [], [languageQuery.data]);

  // Arah entri DIKUNCI: lemma selalu bahasa sumber (Sambas), terjemahan
  // selalu bahasa target (Indonesia). Kamus ini memang Sambas → Indonesia,
  // jadi form tidak perlu (malah tidak boleh) menanyakan bahasa. Backend
  // tetap generik; yang opinionated hanya UI ini.
  const defaultLanguageIds = useMemo(() => pickDefaultLanguageIds(languages), [languages]);
  const sourceLanguage = useMemo(
    () => languages.find((l) => l.id === defaultLanguageIds.sourceId) ?? null,
    [languages, defaultLanguageIds.sourceId],
  );
  const targetLanguage = useMemo(
    () => languages.find((l) => l.id === defaultLanguageIds.targetId) ?? null,
    [languages, defaultLanguageIds.targetId],
  );

  // Data referensi bahasa belum lengkap (Sambas/Indonesia belum ada) →
  // kunci submit, jangan biarkan entri terkirim dengan bahasa yang salah.
  const directionReady = Boolean(sourceLanguage && targetLanguage);

  const dialectQuery = useDialectOptions(defaultLanguageIds.sourceId);
  const umumWordClassId = useMemo(
    () => pickUmumWordClassId(wordClassQuery.data ?? []),
    [wordClassQuery.data],
  );

  // Isi nilai awal bahasa sumber (tersimpan tersembunyi di form store) sekali.
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current || !directionReady) return;
    seeded.current = true;
    const isTranslationMiss = missParams.direction === 'translation';
    form.setFieldsValue({
      language_id: defaultLanguageIds.sourceId,
      word_type: 'word',
      ...(missParams.term && !isTranslationMiss ? { lemma: missParams.term } : {}),
      meanings: [
        {
          word_class_id: umumWordClassId,
          definition: '',
          is_have_definition: false,
          is_have_translation: true,
          order_index: 1,
          translations: defaultLanguageIds.targetId
            ? [
                {
                  language_id: defaultLanguageIds.targetId,
                  translation_type: 'direct' as const,
                  translation_text: isTranslationMiss && missParams.term ? missParams.term : '',
                },
              ]
            : [],
        },
      ],
    });
  }, [
    directionReady,
    defaultLanguageIds.sourceId,
    defaultLanguageIds.targetId,
    form,
    missParams,
    umumWordClassId,
  ]);

  // Dialek default (is_default / umum) - sekali, hanya jika user belum pilih.
  const dialectSeeded = useRef(false);
  useEffect(() => {
    if (dialectSeeded.current || !dialectQuery.data?.length) return;
    const current = form.getFieldValue('dialect_id') as string | undefined;
    if (current) {
      dialectSeeded.current = true;
      return;
    }
    const defaultId = pickDefaultDialectId(dialectQuery.data);
    if (!defaultId) return;
    dialectSeeded.current = true;
    form.setFieldsValue({ dialect_id: defaultId });
  }, [dialectQuery.data, form]);

  // Kelas kata `umum` pada makna yang masih kosong. Sekali, jangan timpa pilihan user.
  const wordClassSeeded = useRef(false);
  useEffect(() => {
    if (wordClassSeeded.current || !umumWordClassId || !seeded.current) return;
    const meanings = form.getFieldValue('meanings') as { word_class_id?: string }[] | undefined;
    if (!Array.isArray(meanings) || meanings.length === 0) return;
    wordClassSeeded.current = true;
    if (meanings.every((m) => m?.word_class_id)) return;
    form.setFieldsValue({
      meanings: meanings.map((m) => (m?.word_class_id ? m : { ...m, word_class_id: umumWordClassId })),
    });
  }, [umumWordClassId, directionReady, form]);

  const wordClassOptions = useMemo(
    () => buildWordClassOptions(wordClassQuery.data ?? []),
    [wordClassQuery.data],
  );

  const categoryOptions = useMemo(
    () =>
      (categoryQuery.data ?? [])
        .map((c) => ({ value: c.id, label: c.name }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [categoryQuery.data],
  );

  // has_component hanya sah untuk entri frasa (idiom/peribahasa/ungkapan).
  const relationOptions = useMemo(() => buildRelationOptions(wordType), [wordType]);

  const dialectOptions = useMemo(
    () => (dialectQuery.data ?? []).map((d) => ({ value: d.id, label: d.name })),
    [dialectQuery.data],
  );

  const defaultDialectId = useMemo(
    () => pickDefaultDialectId(dialectQuery.data ?? []) ?? null,
    [dialectQuery.data],
  );

  const handleSubmitError = (err: unknown) => {
    if (err instanceof ApiError) {
      const fieldErrors = err.fieldErrors();
      const entries = Object.entries(fieldErrors);
      if (entries.length > 0) {
        type CreateWordFieldName = Parameters<typeof form.setFields>[0][number]['name'];
        form.setFields(
          entries.map(([field, msg]) => ({
            name: fieldToNamePath(field) as unknown as CreateWordFieldName,
            errors: [msg],
          })),
        );
      }
      if (err.status === 429) {
        setSubmitError('Terlalu banyak permintaan. Silakan coba lagi beberapa saat.');
      } else if (err.status === 401 || err.status === 403) {
        setSubmitError(err.message);
      } else if (Object.keys(fieldErrors).length === 0) {
        setSubmitError(err.message);
      }
    } else {
      setSubmitError('Gagal menyimpan kata. Coba lagi.');
    }
  };

  const submit = async (status: 'draft' | 'published') => {
    setSubmitError(null);
    try {
      if (fillMode === 'simple') {
        const translation =
          String(
            form.getFieldValue(['meanings', 0, 'translations', 0, 'translation_text']) ?? '',
          ).trim();
        const definition = String(form.getFieldValue(['meanings', 0, 'definition']) ?? '').trim();
        if (!translation && !definition) {
          message.warning('Isi terjemahan Indonesia atau penjelasan arti');
          return;
        }
        const dialectId =
          (form.getFieldValue('dialect_id') as string | undefined) || defaultDialectId || undefined;
        const classId =
          (form.getFieldValue(['meanings', 0, 'word_class_id']) as string | undefined) ||
          umumWordClassId;
        if (!classId) {
          message.warning('Data kelas kata belum siap. Coba lagi sebentar.');
          return;
        }
        form.setFieldsValue({
          word_type: 'word',
          dialect_id: dialectId,
          category_ids: [],
          related_words: [],
          variants: [],
          notes: undefined,
          pronunciation: undefined,
          images: [],
          meanings: [
            {
              word_class_id: classId,
              definition: definition || '-',
              is_have_definition: definition.length > 0,
              is_have_translation: translation.length > 0,
              order_index: 1,
              translations:
                translation && defaultLanguageIds.targetId
                  ? [
                      {
                        language_id: defaultLanguageIds.targetId,
                        translation_type: 'direct' as const,
                        translation_text: translation,
                      },
                    ]
                  : [],
              examples: [],
            },
          ],
        });
      }

      await form.validateFields(fillMode === 'simple' ? ['lemma', 'language_id'] : undefined);

      const values = form.getFieldsValue(true) as CreateWordFormValues;
      // Gambar yang masih terunggah tidak akan terkirim (buildImages hanya
      // ambil yang selesai) - tahan submit supaya tidak ada yang hilang diam-diam.
      if (fillMode === 'full' && hasUploadingImages(values.images)) {
        message.warning('Masih ada gambar yang terunggah - tunggu selesai lalu simpan lagi.');
        return;
      }
      await createMutation.mutateAsync(
        buildCreateWordBody(values, status, { searchMissId: missParams.fromMiss }),
        {
          onSuccess: (result) => {
            void (async () => {
              const messages: Record<string, string> = {
                draft: `Draft "${result.lemma}" disimpan`,
                pending_review: `Kata "${result.lemma}" disimpan dan menunggu review`,
                published: `Kata "${result.lemma}" berhasil dipublikasikan`,
                rejected: `Kata "${result.lemma}" disimpan (ditolak)`,
              };
              message.success(messages[result.status] ?? `Kata "${result.lemma}" disimpan`);
              result.warnings?.forEach((w) => message.warning(w.message));

              // 04-api-sinonim-inline.md - kata inline ikut dibuat dalam satu
              // request. Tampilkan ringkasan per entitas (status = kebenaran
              // akhir dari backend, approval gate per entitas).
              const inlines = result.inline_created_words ?? [];
              if (inlines.length > 0) {
                message.info(
                  `${inlines.length} kata terkait ikut dibuat: ${inlines
                    .map((i) => `${i.lemma} (${inlineStatusLabels[i.status] ?? i.status})`)
                    .join(', ')}`,
                  6,
                );
                for (const inline of inlines) {
                  inline.warnings?.forEach((w) => message.warning(`${inline.lemma}: ${w.message}`));
                }
              }

              // Sequence audio: lemma → GET detail → audio contoh (butuh example_id).
              const exampleDrafts: PendingExampleAudioDraft[] = [];
              for (const [key, audio] of Object.entries(pendingExampleAudios)) {
                if (!audio) continue;
                const meta = pendingExampleMetaRef.current[key];
                if (!meta) continue;
                const sentence =
                  meta.sourceSentence.trim() ||
                  String(
                    (values.meanings?.[meta.meaningIndex] as { examples?: { source_sentence?: string }[] })
                      ?.examples?.[meta.exampleIndex]?.source_sentence ?? '',
                  ).trim();
                if (!sentence) continue;
                exampleDrafts.push({
                  meaningIndex: meta.meaningIndex,
                  exampleIndex: meta.exampleIndex,
                  sourceSentence: sentence,
                  audio,
                });
              }

              if (fillMode === 'full' && (pendingAudio || exampleDrafts.length > 0)) {
                const uploadResult = await uploadPendingAudiosAfterCreate({
                  wordId: result.word_id,
                  lemmaAudio: pendingAudio,
                  exampleAudios: exampleDrafts,
                });
                if (uploadResult.lemmaOk) {
                  message.success('Audio pelafalan lemma diunggah');
                  setPendingAudio(null);
                }
                if (uploadResult.exampleOk > 0) {
                  message.success(
                    `${uploadResult.exampleOk} audio contoh diunggah`,
                  );
                  setPendingExampleAudios({});
                  pendingExampleMetaRef.current = {};
                }
                for (const err of uploadResult.errors) {
                  message.warning(
                    `Kata tersimpan, tapi: ${err}. Unggah ulang di halaman detail bila perlu.`,
                  );
                }
              }

              await queryClient.invalidateQueries({ queryKey: ['words'] });
              if (missParams.fromMiss) {
                void queryClient.invalidateQueries({ queryKey: ['search-misses'] });
              }
              navigate({ to: '/words' });
            })();
          },
          onError: handleSubmitError,
        },
      );
    } catch {
      // Validasi form gagal - error inline antd sudah tampil, tidak ada aksi.
    }
  };

  return (
    <>
      <PageHeader
        title="Tambah Kata Baru"
        subtitle={
          fillMode === 'simple'
            ? 'Mode sederhana - kata Sambas, terjemahan, dan penjelasan arti. Dialek & kelas kata diisi otomatis (umum).'
            : 'Form lengkap - kata, makna, terjemahan, contoh, dan relasi.'
        }
      />
      <Form form={form} layout="vertical" requiredMark disabled={createMutation.isPending}>
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          {missParams.fromMiss ? (
            <Alert
              type="info"
              showIcon
              message={`Dari pencarian: ${missParams.term ?? '-'} (${
                missParams.direction === 'translation' ? 'Indonesia → Sambas' : 'Sambas → Indonesia'
              })`}
            />
          ) : null}
          {submitError ? (
            <Alert type="error" showIcon message="Gagal menyimpan kata" description={submitError} closable onClose={() => setSubmitError(null)} />
          ) : null}

          <Card size="small">
            <Flex align="center" gap={12} wrap>
              <Text type="secondary">Cara mengisi</Text>
              <Segmented
                value={fillMode}
                onChange={(v) => setFillMode(v as FormFillMode)}
                options={[
                  { value: 'simple', label: 'Sederhana' },
                  { value: 'full', label: 'Lengkap' },
                ]}
              />
            </Flex>
          </Card>

          <Form.Item name="language_id" noStyle rules={[{ required: true, message: 'Bahasa wajib dipilih' }]}>
            <Input type="hidden" />
          </Form.Item>

          {fillMode === 'simple' ? (
            <Card title="Kata">
              <Form.Item name="word_type" hidden initialValue="word">
                <Input />
              </Form.Item>
              <Form.Item name="dialect_id" hidden>
                <Input />
              </Form.Item>
              <Form.Item name={['meanings', 0, 'word_class_id']} hidden>
                <Input />
              </Form.Item>
              <Form.Item name={['meanings', 0, 'is_have_definition']} hidden>
                <Input />
              </Form.Item>
              <Form.Item name={['meanings', 0, 'is_have_translation']} hidden>
                <Input />
              </Form.Item>
              <Form.Item name={['meanings', 0, 'order_index']} hidden initialValue={1}>
                <Input />
              </Form.Item>
              <Form.Item name={['meanings', 0, 'translations', 0, 'language_id']} hidden>
                <Input />
              </Form.Item>
              <Form.Item name={['meanings', 0, 'translations', 0, 'translation_type']} hidden initialValue="direct">
                <Input />
              </Form.Item>
              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="lemma"
                    label="Kata / ungkapan Sambas"
                    rules={[
                      { required: true, message: 'Kata wajib diisi' },
                      { whitespace: true, message: 'Kata tidak boleh hanya spasi' },
                    ]}
                  >
                    <Input placeholder="Isi kata, peribahasa, atau ungkapan" maxLength={255} allowClear />
                  </Form.Item>
                  <Form.Item name="lemma_allows_comma" valuePropName="checked" style={{ marginTop: -12 }}>
                    <Checkbox>Lemma memang mengandung koma (bukan multi-kata)</Checkbox>
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    name={['meanings', 0, 'translations', 0, 'translation_text']}
                    label="Terjemahan Indonesia"
                    extra="Tekan ikon buku untuk mencari penjelasan arti di KBBI"
                  >
                    <Input
                      placeholder="Satu kata/frasa setara di Indonesia"
                      allowClear
                      suffix={
                        <Button
                          type="text"
                          size="small"
                          icon={<BookOutlined />}
                          aria-label="Ambil dari KBBI"
                          onClick={() => setKbbiOpen(true)}
                        />
                      }
                    />
                  </Form.Item>
                  <Form.Item
                    name={['meanings', 0, 'translations', 0, 'translation_allows_comma']}
                    valuePropName="checked"
                    style={{ marginTop: -12 }}
                  >
                    <Checkbox>Padanan memang mengandung koma (bukan multi-makna)</Checkbox>
                  </Form.Item>
                </Col>
                <Col xs={24}>
                  <Form.Item
                    name={['meanings', 0, 'definition']}
                    label="Penjelasan arti"
                    extra="Opsional. Boleh dikosongkan jika sudah ada terjemahan."
                  >
                    <Input.TextArea rows={2} placeholder="Jelaskan arti kata ini (opsional)" />
                  </Form.Item>
                </Col>
                <Col xs={24}>
                  <UsageLabelsFields />
                </Col>
              </Row>
            </Card>
          ) : (
            <>
          {/* 1. Data kata dasar */}
          <Card title="1. Data Kata Dasar">
            <Row gutter={16}>
              <Col xs={24} md={12} lg={10}>
                <Form.Item
                  name="lemma"
                  label="Kata / ungkapan Sambas"
                  rules={[{ required: true, message: 'Kata wajib diisi' }, { whitespace: true, message: 'Kata tidak boleh hanya spasi' }]}
                >
                  <Input placeholder="Isi kata, peribahasa, atau ungkapan" maxLength={255} allowClear />
                </Form.Item>
                <Form.Item name="lemma_allows_comma" valuePropName="checked" style={{ marginTop: -12 }}>
                  <Checkbox>Lemma memang mengandung koma (bukan multi-kata)</Checkbox>
                </Form.Item>
              </Col>
              <Col xs={24} md={6} lg={4}>
                <Form.Item name="word_type" label="Jenis">
                  <Select options={wordTypeOptions} />
                </Form.Item>
              </Col>
              <Col xs={24} md={6} lg={4}>
                <Form.Item name="dialect_id" label="Dialek">
                  <Select
                    options={(dialectQuery.data ?? []).map((d) => ({ value: d.id, label: d.name }))}
                    loading={dialectQuery.isFetching}
                    placeholder="Pilih dialek"
                    allowClear
                  />
                </Form.Item>
              </Col>
              <Col xs={24}>
                <Form.Item name="notes" label="Catatan Tambahan">
                  <Input.TextArea rows={2} placeholder="Catatan internal tentang entri ini (opsional)" />
                </Form.Item>
              </Col>
            </Row>
          </Card>

          {/* 2. Makna / arti */}
          <Card title="2. Makna / Arti">
            <Form.List
              name="meanings"
              rules={[
                {
                  validator: (_, value) =>
                    Array.isArray(value) && value.length > 0
                      ? Promise.resolve()
                      : Promise.reject(new Error('Minimal harus ada 1 makna')),
                },
              ]}
            >
              {(meaningFields, { add, remove }) => (
                <Space direction="vertical" size={16} style={{ width: '100%' }}>
                  {meaningFields.map((field) => (
                    <Card
                      key={field.key}
                      size="small"
                      title={`Makna ${field.name + 1}`}
                      extra={
                        <Button
                          type="text"
                          danger
                          icon={<DeleteOutlined />}
                          disabled={meaningFields.length <= 1}
                          onClick={() => remove(field.name)}
                        >
                          Hapus
                        </Button>
                      }
                    >
                      <MeaningFields
                        name={[field.name]}
                        absolutePath={['meanings', field.name]}
                        wordClassOptions={wordClassOptions}
                        wordClasses={wordClassQuery.data ?? []}
                        wordClassLoading={wordClassQuery.isLoading}
                        defaultLanguageIds={defaultLanguageIds}
                        showOrderIndex
                        translationsRequired
                        orderIndexInitial={field.name + 1}
                        enablePendingExampleAudio
                        pendingExampleAudios={pendingExampleAudios}
                        dialectOptionsForExampleAudio={dialectOptions}
                        defaultDialectIdForExampleAudio={defaultDialectId}
                        onPendingExampleAudioChange={(key, meta, next) => {
                          pendingExampleMetaRef.current[key] = meta;
                          if (!next) delete pendingExampleMetaRef.current[key];
                          setPendingExampleAudios((prev) => {
                            const copy = { ...prev };
                            if (next) copy[key] = next;
                            else delete copy[key];
                            return copy;
                          });
                        }}
                      />
                    </Card>
                  ))}

                  <Button
                    type="dashed"
                    block
                    icon={<PlusOutlined />}
                    onClick={() =>
                      add({
                        order_index: meaningFields.length + 1,
                        ...(umumWordClassId ? { word_class_id: umumWordClassId } : {}),
                        ...(defaultLanguageIds.targetId
                          ? {
                              translations: [
                                { language_id: defaultLanguageIds.targetId, translation_type: 'direct' as const },
                              ],
                            }
                          : {}),
                      })
                    }
                  >
                    Tambah Makna
                  </Button>
                </Space>
              )}
            </Form.List>
          </Card>

          {/* 3. Kategori / glosarium */}
          <Card title="3. Kategori / Glosarium">
            <Form.Item name="category_ids" label="Pilih kategori">
              <Select
                mode="multiple"
                allowClear
                showSearch
                optionFilterProp="label"
                options={categoryOptions}
                loading={categoryQuery.isLoading}
                placeholder="mis. Kekerabatan, Makanan, Alam"
              />
            </Form.Item>
          </Card>

          <Card title="3b. Register & Peringatan">
            <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
              Penanda gaya bahasa dan peringatan konten (bukan kategori topik).
            </Text>
            <UsageLabelsFields />
          </Card>

          {/* 4-6. Bagian opsional (collapsible) */}
          <Collapse
            items={[
              {
                key: 'relations',
                label: '4. Relasi Kata (opsional)',
                children: (
                  <>
                    <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
                      Relasi bisa menautkan ke kata yang sudah ada, ATAU langsung membuat kata
                      sinonim/antonim baru sekaligus dalam satu request (kontrak
                      04-api-sinonim-inline.md).
                    </Text>
                    <Form.List name="related_words">
                      {(fields, { add, remove }) => (
                        <Space direction="vertical" size={12} style={{ width: '100%' }}>
                          {fields.map((field) => (
                            <RelatedWordItem
                              key={field.key}
                              field={field}
                              remove={() => remove(field.name)}
                              relationOptions={relationOptions}
                              wordClassOptions={wordClassOptions}
                              wordClasses={wordClassQuery.data ?? []}
                              wordClassLoading={wordClassQuery.isLoading}
                              defaultLanguageIds={defaultLanguageIds}
                            />
                          ))}
                          <Button type="dashed" block icon={<PlusOutlined />} onClick={() => add({ mode: 'link' })}>
                            Tambah Relasi
                          </Button>
                        </Space>
                      )}
                    </Form.List>
                  </>
                ),
              },
              {
                key: 'variants',
                label: '5. Variasi & Bentuk Turunan (opsional)',
                children: <WordVariantsField />,
              },
              {
                key: 'pronunciation',
                label: '6. Pengucapan (opsional)',
                children: (
                  <Space direction="vertical" size={16} style={{ width: '100%' }}>
                    <Row gutter={16}>
                      <Col xs={24} md={6} lg={4}>
                        <Form.Item name={['pronunciation', 'notation']} label="Notasi" initialValue="ipa">
                          <Select options={[{ value: 'ipa', label: 'IPA' }]} />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={18} lg={20}>
                        <Form.Item name={['pronunciation', 'value']} label="Teks Pengucapan">
                          <Input placeholder="/kata/" />
                        </Form.Item>
                      </Col>
                    </Row>
                    <div>
                      <Text strong style={{ display: 'block', marginBottom: 8 }}>
                        Audio pelafalan
                      </Text>
                      <PendingPronunciationAudioField
                        dialectOptions={dialectOptions}
                        defaultDialectId={
                          (form.getFieldValue('dialect_id') as string | undefined) ?? defaultDialectId
                        }
                        value={pendingAudio}
                        onChange={setPendingAudio}
                      />
                    </div>
                  </Space>
                ),
              },
              {
                key: 'images',
                label: '7. Gambar (opsional)',
                forceRender: true,
                children: (
                  <Form.Item name="images" initialValue={[]} noStyle>
                    <WordImagesField />
                  </Form.Item>
                ),
              },
            ]}
          />
            </>
          )}
        </Space>
      </Form>

      <KbbiDefinitionPickerModal
        open={kbbiOpen}
        initialLemma={String(
          form.getFieldValue(['meanings', 0, 'translations', 0, 'translation_text']) ?? '',
        )}
        onClose={() => setKbbiOpen(false)}
        onSelect={(suggestion) => {
          const matchedId = matchWordClassId(
            wordClassQuery.data ?? [],
            suggestion.word_class_code,
            suggestion.word_class_label,
          );
          const lemmaId = suggestion.lemma.trim();
          form.setFieldsValue({
            meanings: [
              {
                ...(form.getFieldValue('meanings')?.[0] ?? {}),
                word_class_id: matchedId || umumWordClassId,
                definition: suggestion.definition,
                is_have_definition: true,
                is_have_translation: Boolean(lemmaId),
                order_index: 1,
                translations: [
                  {
                    language_id: defaultLanguageIds.targetId,
                    translation_type: 'direct' as const,
                    translation_text: lemmaId,
                  },
                ],
              },
            ],
          });
          const parts = ['Penjelasan arti'];
          if (matchedId) parts.push('kelas kata');
          if (lemmaId) parts.push('terjemahan');
          message.success(`${parts.join(', ')} diisi dari KBBI - silakan review`);
        }}
      />

      <Flex
        justify={md ? 'space-between' : 'flex-start'}
        align="center"
        vertical={!md}
        wrap
        gap={12}
        style={{ marginTop: 24, paddingTop: 16, borderTop: `1px solid ${colorFillAlter}` }}
      >
        <div>
          {isContributor ? (
            <Text type="warning">Sebagai kontributor, "Simpan & Publikasikan" akan menghasilkan status "Menunggu Review".</Text>
          ) : null}
        </div>
        <Space wrap style={{ width: md ? undefined : '100%' }}>
          <Button block={!md} onClick={() => navigate({ to: '/words' })}>Batal</Button>
          <Button block={!md} icon={<SaveOutlined />} loading={createMutation.isPending} onClick={() => submit('draft')}>
            Simpan sebagai Draft
          </Button>
          <Button block={!md} type="primary" icon={<SendOutlined />} loading={createMutation.isPending} onClick={() => submit('published')}>
            Simpan &amp; Publikasikan
          </Button>
        </Space>
      </Flex>
    </>
  );
}
