import { useEffect, useMemo, useRef, useState } from 'react';
import { DeleteOutlined, PlusOutlined, SaveOutlined, SendOutlined } from '@ant-design/icons';
import {
  Alert,
  App as AntdApp,
  Button,
  Card,
  Collapse,
  Col,
  Divider,
  Flex,
  Form,
  Grid,
  Input,
  InputNumber,
  Row,
  Segmented,
  Select,
  Space,
  Switch,
  Typography,
  theme,
} from 'antd';
import { useNavigate } from '@tanstack/react-router';
import { PageHeader } from '@/shared/components/page-header';
import { ApiError } from '@/shared/api/error';
import { useAuth } from '@/shared/auth/use-auth';
import { buildCreateWordBody, fieldToNamePath, pickDefaultLanguageIds, type DefaultLanguageIds } from '../application/create-word-utils';
import { useCreateWord } from '../application/use-create-word';
import { useCategoryOptions, useDialectOptions, useLanguageOptions, useWordClassOptions } from '../application/use-reference-data';
import {
  AFFIX_TYPES,
  AFFIX_TYPE_LABELS,
  EXAMPLE_SOURCE_TYPES,
  EXAMPLE_SOURCE_LABELS,
  RELATION_TYPES,
  RELATION_TYPE_LABELS,
  TRANSLATION_TYPES,
  TRANSLATION_TYPE_LABELS,
  VARIANT_TYPES,
  VARIANT_TYPE_LABELS,
  type CreateWordMeaningFormValue,
  type CreateWordFormValues,
  type RelationType,
  type WordClassOption,
} from '../domain/create-word';
import { WORD_TYPES, WORD_TYPE_LABELS, type WordStatus } from '../domain/word';
import { WordSearchSelect } from './word-search-select';

const { Text } = Typography;

const wordTypeOptions = WORD_TYPES.map((t) => ({ value: t, label: WORD_TYPE_LABELS[t] }));
const translationTypeOptions = TRANSLATION_TYPES.map((t) => ({ value: t, label: TRANSLATION_TYPE_LABELS[t] }));
const variantTypeOptions = VARIANT_TYPES.map((t) => ({ value: t, label: VARIANT_TYPE_LABELS[t] }));
const affixTypeOptions = AFFIX_TYPES.map((t) => ({ value: t, label: AFFIX_TYPE_LABELS[t] }));
const exampleSourceOptions = EXAMPLE_SOURCE_TYPES.map((t) => ({ value: t, label: EXAMPLE_SOURCE_LABELS[t] }));

const inlineStatusLabels: Record<WordStatus, string> = {
  draft: 'Draft',
  pending_review: 'Menunggu Review',
  published: 'Tayang',
  rejected: 'Ditolak',
};

export function CreateWordPage() {
  const navigate = useNavigate();
  const { message } = AntdApp.useApp();
  const { user } = useAuth();
  const { token: { colorFillAlter } } = theme.useToken();
  const { md } = Grid.useBreakpoint();

  const [form] = Form.useForm<CreateWordFormValues>();
  const createMutation = useCreateWord();
  const [submitError, setSubmitError] = useState<string | null>(null);

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

  // Isi nilai awal bahasa sumber (tersimpan tersembunyi di form store) sekali.
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current || !directionReady) return;
    seeded.current = true;
    form.setFieldsValue({ language_id: defaultLanguageIds.sourceId, word_type: 'word' });
  }, [directionReady, defaultLanguageIds.sourceId, form]);

  const wordClassOptions = useMemo(() => {
    const wcs = wordClassQuery.data ?? [];
    const byId = new Map(wcs.map((wc) => [wc.id, wc]));
    const label = (wc: WordClassOption): string => {
      const parent = wc.parent_id ? byId.get(wc.parent_id) : undefined;
      return parent ? `${label(parent)} › ${wc.name}` : wc.name;
    };
    return wcs.map((wc) => ({ value: wc.id, label: label(wc) }));
  }, [wordClassQuery.data]);

  const categoryOptions = useMemo(
    () =>
      (categoryQuery.data ?? [])
        .map((c) => ({ value: c.id, label: c.name }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [categoryQuery.data],
  );

  // has_component hanya sah untuk entri frasa (idiom/peribahasa/ungkapan).
  const relationOptions = useMemo(
    () =>
      RELATION_TYPES.filter((t) => !(wordType === 'word' && t === 'has_component')).map((t) => ({
        value: t,
        label: RELATION_TYPE_LABELS[t],
      })),
    [wordType],
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
      const values = await form.validateFields();
      await createMutation.mutateAsync(
        buildCreateWordBody(values, status),
        {
          onSuccess: (result) => {
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
            navigate({ to: '/words' });
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
      <PageHeader title="Tambah Kata Baru" subtitle="Form kosakata lengkap - kata, makna, terjemahan, contoh, dan relasi." />
      <Form form={form} layout="vertical" requiredMark disabled={createMutation.isPending}>
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          {submitError ? (
            <Alert type="error" showIcon message="Gagal menyimpan kata" description={submitError} closable onClose={() => setSubmitError(null)} />
          ) : null}

          {/* 1. Data kata dasar */}
          <Card title="1. Data Kata Dasar">
            <Row gutter={16}>
              <Col xs={24} md={12} lg={10}>
                <Form.Item name="language_id" noStyle rules={[{ required: true, message: 'Bahasa wajib dipilih' }]}>
                  <Input type="hidden" />
                </Form.Item>
                <Form.Item
                  name="lemma"
                  label="Kata Sambas (Lemma)"
                  rules={[{ required: true, message: 'Kata wajib diisi' }, { whitespace: true, message: 'Kata tidak boleh hanya spasi' }]}
                >
                  <Input placeholder="mis. makatn" maxLength={255} allowClear />
                </Form.Item>
              </Col>
              <Col xs={24} md={6} lg={4}>
                <Form.Item name="word_type" label="Jenis Entri">
                  <Select options={wordTypeOptions} />
                </Form.Item>
              </Col>
              <Col xs={24} md={6} lg={4}>
                <Form.Item name="dialect_id" label="Dialek">
                  <Select
                    options={(dialectQuery.data ?? []).map((d) => ({ value: d.id, label: d.name }))}
                    loading={dialectQuery.isFetching}
                    placeholder="Umum / tidak ada"
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
                        wordClassOptions={wordClassOptions}
                        wordClassLoading={wordClassQuery.isLoading}
                        defaultLanguageIds={defaultLanguageIds}
                        showOrderIndex
                        translationsRequired
                        orderIndexInitial={field.name + 1}
                      />
                    </Card>
                  ))}

                  <Button
                    type="dashed"
                    block
                    icon={<PlusOutlined />}
                    onClick={() =>
                      add(
                        defaultLanguageIds.targetId
                          ? { order_index: meaningFields.length + 1, translations: [{ language_id: defaultLanguageIds.targetId, translation_type: 'direct' }] }
                          : { order_index: meaningFields.length + 1 },
                      )
                    }
                  >
                    + Tambah Makna
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
                label: '5. Bentuk Turunan (opsional)',
                children: (
                  <Form.List name="variants">
                    {(fields, { add, remove }) => (
                      <Space direction="vertical" size={8} style={{ width: '100%' }}>
                        {fields.map((field) => (
                          <Row key={field.key} gutter={12} align="top">
                            <Col flex="180px">
                              <Form.Item name={[field.name, 'form']} label="Bentuk" rules={[{ required: true, message: 'Wajib' }]}>
                                <Input placeholder="mis. memakan" />
                              </Form.Item>
                            </Col>
                            <Col flex="140px">
                              <Form.Item name={[field.name, 'variant_type']} label="Jenis" initialValue="alternative">
                                <Select options={variantTypeOptions} />
                              </Form.Item>
                            </Col>
                            <Col flex="150px">
                              <Form.Item name={[field.name, 'affix_type']} label="Tipe Afiks">
                                <Select allowClear placeholder="tanpa afiks" options={affixTypeOptions} />
                              </Form.Item>
                            </Col>
                            <Col flex="130px">
                              <Form.Item name={[field.name, 'affix_value']} label="Nilai Afiks">
                                <Input placeholder="mis. me-" />
                              </Form.Item>
                            </Col>
                            <Col flex="32px">
                              <Form.Item label=" ">
                                <Button type="text" danger icon={<DeleteOutlined />} onClick={() => remove(field.name)} />
                              </Form.Item>
                            </Col>
                          </Row>
                        ))}
                        <Button type="dashed" block icon={<PlusOutlined />} onClick={() => add()}>
                          Tambah Bentuk Turunan
                        </Button>
                      </Space>
                    )}
                  </Form.List>
                ),
              },
              {
                key: 'pronunciation',
                label: '6. Pengucapan (opsional)',
                children: (
                  <>
                    <Row gutter={16}>
                      <Col xs={24} md={6} lg={4}>
                        <Form.Item name={['pronunciation', 'notation']} label="Notasi" initialValue="ipa">
                          <Select options={[{ value: 'ipa', label: 'IPA' }]} />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={18} lg={20}>
                        <Form.Item name={['pronunciation', 'value']} label="Teks Pengucapan">
                          <Input placeholder="/makatn/" />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Text type="secondary">Fitur audio pengucapan (rekaman penutur asli) menyusul.</Text>
                  </>
                ),
              },
            ]}
          />
        </Space>
      </Form>

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

// ---------------------------------------------------------------------------
// Blok makna/terjemahan/contoh yang dipakai bersama: makna INDUK, makna kata
// inline (inherit=false), dan override makna (inherit=true). Setiap field
// memakai `name` RELATIF ke konteks Form.List tempat komponen dirender
// (antd meng-resolution path lewat konteks prefix Form.List).
// ---------------------------------------------------------------------------

interface MeaningFieldsProps {
  /** path relatif ke objek makna/override di dalam konteks Form.List saat ini */
  name: (string | number)[];
  wordClassOptions: { value: string; label: string }[];
  wordClassLoading?: boolean;
  defaultLanguageIds: DefaultLanguageIds;
  /** mode override (inherit=true): tampil pemilih meaning_index, kelas kata opsional */
  showMeaningPicker?: boolean;
  /** opsi pemilih makna induk (index → label); wajib saat showMeaningPicker */
  meaningOptions?: { value: number; label: string }[];
  /** tampilkan input order_index (makna penuh) */
  showOrderIndex?: boolean;
  /** initialValue input order_index sesuai posisi di daftar */
  orderIndexInitial?: number;
  /** terjemahan minimal 1 (makna penuh) vs opsional (override - ikut induk) */
  translationsRequired?: boolean;
}

function MeaningFields({
  name,
  wordClassOptions,
  wordClassLoading = false,
  defaultLanguageIds,
  showMeaningPicker = false,
  meaningOptions = [],
  showOrderIndex = false,
  orderIndexInitial,
  translationsRequired = true,
}: MeaningFieldsProps) {
  return (
    <>
      <Row gutter={16}>
        {showMeaningPicker ? (
          <Col xs={24} md={14} lg={16}>
            <Form.Item
              name={[...name, 'meaning_index']}
              label="Makna induk yang diubah"
              rules={[{ required: true, message: 'Pilih makna induk' }]}
            >
              <Select options={meaningOptions} placeholder="Pilih makna induk…" showSearch optionFilterProp="label" />
            </Form.Item>
          </Col>
        ) : (
          <Col xs={24} md={14} lg={16}>
            <Form.Item
              name={[...name, 'word_class_id']}
              label="Kelas Kata"
              rules={[{ required: true, message: 'Kelas kata wajib dipilih' }]}
            >
              <Select
                showSearch
                optionFilterProp="label"
                options={wordClassOptions}
                loading={wordClassLoading}
                placeholder="Pilih kelas kata (mis. Verba › Verba Transitif)"
              />
            </Form.Item>
          </Col>
        )}
        {showOrderIndex ? (
          <Col xs={24} md={6} lg={4}>
            <Form.Item name={[...name, 'order_index']} label="Urutan Tampil" initialValue={orderIndexInitial ?? 1}>
              <InputNumber min={1} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        ) : null}
      </Row>

      {showMeaningPicker ? (
        <Form.Item name={[...name, 'word_class_id']} label="Kelas Kata (override)">
          <Select
            showSearch
            optionFilterProp="label"
            options={wordClassOptions}
            allowClear
            placeholder="Ikut induk (biarkan kosong)"
          />
        </Form.Item>
      ) : null}

      <Form.Item
        name={[...name, 'definition']}
        label={showMeaningPicker ? 'Definisi (override)' : 'Definisi Konseptual'}
        rules={[{ required: !showMeaningPicker, message: 'Definisi wajib diisi' }]}
      >
        <Input.TextArea
          rows={2}
          placeholder={showMeaningPicker ? 'Biarkan kosong bila tetap memakai definisi induk' : 'Aktivitas memasukkan makanan ke mulut'}
        />
      </Form.Item>

      <Divider titlePlacement="start" plain>
        Terjemahan
      </Divider>
      <Form.List
        name={[...name, 'translations']}
        rules={
          translationsRequired
            ? [
                {
                  validator: (_, value) =>
                    Array.isArray(value) && value.length > 0
                      ? Promise.resolve()
                      : Promise.reject(new Error('Minimal 1 terjemahan per makna')),
                },
              ]
            : []
        }
      >
        {(transFields, { add: addTranslation, remove: removeTranslation }) => (
          <Space direction="vertical" size={8} style={{ width: '100%' }}>
            {transFields.map((tf) => (
              <Row key={tf.key} gutter={12} align="top">
                <Col flex="auto">
                  <Form.Item name={[tf.name, 'language_id']} noStyle rules={[{ required: true, message: 'Wajib' }]}>
                    <Input type="hidden" />
                  </Form.Item>
                  <Form.Item
                    name={[tf.name, 'translation_text']}
                    label="Terjemahan"
                    rules={[{ required: true, message: 'Terjemahan wajib diisi' }]}
                  >
                    <Input placeholder="Terjemahan ke Indonesia" />
                  </Form.Item>
                </Col>
                <Col flex="140px">
                  <Form.Item name={[tf.name, 'translation_type']} label="Tipe" initialValue="direct">
                    <Select options={translationTypeOptions} />
                  </Form.Item>
                </Col>
                <Col flex="32px">
                  <Form.Item label=" ">
                    <Button
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      disabled={transFields.length <= 1}
                      onClick={() => removeTranslation(tf.name)}
                    />
                  </Form.Item>
                </Col>
              </Row>
            ))}
            <Button
              type="dashed"
              block
              icon={<PlusOutlined />}
              onClick={() => addTranslation(defaultLanguageIds.targetId ? { language_id: defaultLanguageIds.targetId, translation_type: 'direct' } : {})}
            >
              Tambah Terjemahan
            </Button>
          </Space>
        )}
      </Form.List>

      <Divider titlePlacement="start" plain>
        Contoh Kalimat (opsional)
      </Divider>
      <Form.List name={[...name, 'examples']}>
        {(exampleFields, { add: addExample, remove: removeExample }) => (
          <Space direction="vertical" size={8} style={{ width: '100%' }}>
            {exampleFields.map((ef) => (
              <Row key={ef.key} gutter={12} align="top" wrap>
                <Col flex="auto">
                  <Form.Item name={[ef.name, 'source_language_id']} noStyle rules={[{ required: true, message: 'Wajib' }]}>
                    <Input type="hidden" />
                  </Form.Item>
                  <Form.Item name={[ef.name, 'target_language_id']} noStyle>
                    <Input type="hidden" />
                  </Form.Item>
                  <Form.Item
                    name={[ef.name, 'source_sentence']}
                    label="Kalimat Sambas"
                    rules={[{ required: true, message: 'Contoh wajib diisi' }]}
                  >
                    <Input.TextArea rows={1} autoSize placeholder="Kami udah makatn tadi." />
                  </Form.Item>
                </Col>
                <Col flex="140px">
                  <Form.Item name={[ef.name, 'source_type']} label="Sumber" initialValue="native_speaker">
                    <Select options={exampleSourceOptions} />
                  </Form.Item>
                </Col>
                <Col flex="32px">
                  <Form.Item label=" ">
                    <Button type="text" danger icon={<DeleteOutlined />} onClick={() => removeExample(ef.name)} />
                  </Form.Item>
                </Col>
                <Col flex="auto">
                  <Form.Item name={[ef.name, 'target_sentence']} label="Terjemahan Kalimat">
                    <Input.TextArea rows={1} autoSize placeholder="Kami sudah makan tadi." />
                  </Form.Item>
                </Col>
              </Row>
            ))}
            <Button
              type="dashed"
              block
              icon={<PlusOutlined />}
              onClick={() =>
                addExample(
                  defaultLanguageIds.sourceId
                    ? {
                        source_language_id: defaultLanguageIds.sourceId,
                        target_language_id: defaultLanguageIds.targetId,
                        source_type: 'native_speaker',
                      }
                    : {},
                )
              }
            >
              Tambah Contoh
            </Button>
          </Space>
        )}
      </Form.List>
    </>
  );
}

// ---------------------------------------------------------------------------
// Satu item daftar "Relasi Kata" - memilih bentuk: ketuk ke kata yang SUDAH
// ada (Form A) atau BUAT kata baru sekaligus (Form B, kontrak 04).
// ---------------------------------------------------------------------------

interface RelatedWordItemProps {
  field: { key: number; name: number };
  remove: () => void;
  relationOptions: { value: RelationType; label: string }[];
  wordClassOptions: { value: string; label: string }[];
  wordClassLoading?: boolean;
  defaultLanguageIds: DefaultLanguageIds;
}

function RelatedWordItem({
  field,
  remove,
  relationOptions,
  wordClassOptions,
  wordClassLoading = false,
  defaultLanguageIds,
}: RelatedWordItemProps) {
  const form = Form.useFormInstance();
  const mode = Form.useWatch(['related_words', field.name, 'mode'], form) ?? 'link';

  // Makna induk untuk memilih meaning_index override (index = posisi di
  // daftar "Makan / Arti", 0-based - selaras dengan build + validator).
  const parentMeanings = Form.useWatch('meanings', form) as CreateWordMeaningFormValue[] | undefined;
  const meaningOptions = useMemo(
    () =>
      (parentMeanings ?? []).map((meaning, i) => ({
        value: i,
        label: `Makna ${i + 1}: ${meaning.definition?.trim() ? meaning.definition.trim().slice(0, 60) : 'tanpa definisi'}`,
      })),
    [parentMeanings],
  );

  const modeOptions = [
    { value: 'link', label: 'Kata lama (sudah ada)' },
    { value: 'inline', label: 'Kata baru (buat sekaligus)' },
  ];

  return (
    <Card
      size="small"
      title={`Relasi ${field.name + 1}`}
      extra={
        <Button type="text" danger icon={<DeleteOutlined />} onClick={remove}>
          Hapus
        </Button>
      }
    >
      <Row gutter={12} align="top" wrap>
        <Col xs={24} md={12} lg={10}>
          <Form.Item
            name={[field.name, 'mode']}
            label="Bentuk"
            rules={[{ required: true, message: 'Pilih bentuk' }]}
          >
            <Segmented options={modeOptions} />
          </Form.Item>
        </Col>
        <Col xs={24} md={8} lg={6}>
          <Form.Item name={[field.name, 'relation_type']} label="Tipe Relasi" rules={[{ required: true, message: 'Wajib' }]}>
            <Select options={relationOptions} />
          </Form.Item>
        </Col>
      </Row>

      {mode === 'link' ? (
        <Form.Item name={[field.name, 'word_id']} label="Kata terkait" rules={[{ required: true, message: 'Pilih kata' }]}>
          <WordSearchSelect />
        </Form.Item>
      ) : (
        <InlineWordEditor
          name={field.name}
          wordClassOptions={wordClassOptions}
          wordClassLoading={wordClassLoading}
          defaultLanguageIds={defaultLanguageIds}
          meaningOptions={meaningOptions}
        />
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Editor kata baru INLINE (Form B) - lemma + ikutan definisi induk dengan
// override satu-per-satu, atau makna diisi mandiri (inherit=false).
// ---------------------------------------------------------------------------

interface InlineWordEditorProps {
  /** indeks item di related_words (dipakai path absolut form) */
  name: number;
  wordClassOptions: { value: string; label: string }[];
  wordClassLoading?: boolean;
  defaultLanguageIds: DefaultLanguageIds;
  meaningOptions: { value: number; label: string }[];
}

function InlineWordEditor({
  name,
  wordClassOptions,
  wordClassLoading = false,
  defaultLanguageIds,
  meaningOptions,
}: InlineWordEditorProps) {
  const form = Form.useFormInstance();
  const inherit = Form.useWatch(['related_words', name, 'word', 'inherit_meanings'], form) ?? true;

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <Row gutter={16} wrap>
        <Col xs={24} md={12} lg={10}>
          <Form.Item
            name={[name, 'word', 'lemma']}
            label="Lemma Kata Baru"
            rules={[{ required: true, message: 'Kata baru wajib diisi' }, { whitespace: true, message: 'Kata tidak boleh hanya spasi' }]}
          >
            <Input placeholder="mis. ngamakn" maxLength={255} allowClear />
          </Form.Item>
        </Col>
        <Col xs={24} md={6} lg={5}>
          <Form.Item name={[name, 'word', 'word_type']} label="Jenis Entri">
            <Select options={wordTypeOptions} allowClear placeholder="Ikut induk" />
          </Form.Item>
        </Col>
        <Col xs={24} md={6} lg={6}>
          <Form.Item
            name={[name, 'word', 'inherit_meanings']}
            label="Definisi & Makna"
            initialValue
            valuePropName="checked"
          >
            <Switch checkedChildren="Ikut induk" unCheckedChildren="Isi sendiri" />
          </Form.Item>
        </Col>
      </Row>

      <Form.Item name={[name, 'word', 'notes']} label="Catatan Tambahan">
        <Input.TextArea rows={1} autoSize placeholder="mis. Varian lisan, lafal daerah (opsional)" />
      </Form.Item>

      {inherit ? (
        <>
          <Text type="secondary">
            Kata baru ini mengikuti definisi/makna induk. Override di bawah mengubah makna hasil salinan
            SATU PER SATU - field yang dikosongkan tetap memakai definisi induk.
          </Text>
          <Form.List name={[name, 'word', 'meaning_overrides']}>
            {(overrideFields, { add, remove }) => (
              <Space direction="vertical" size={8} style={{ width: '100%' }}>
                {overrideFields.map((ov) => (
                  <Card
                    key={ov.key}
                    size="small"
                    title={`Override Makna ${ov.name + 1}`}
                    extra={
                      <Button type="text" danger icon={<DeleteOutlined />} onClick={() => remove(ov.name)}>
                        Hapus
                      </Button>
                    }
                  >
                    <MeaningFields
                      name={[ov.name]}
                      wordClassOptions={wordClassOptions}
                      wordClassLoading={wordClassLoading}
                      defaultLanguageIds={defaultLanguageIds}
                      showMeaningPicker
                      meaningOptions={meaningOptions}
                      translationsRequired={false}
                    />
                  </Card>
                ))}
                <Button
                  type="dashed"
                  block
                  icon={<PlusOutlined />}
                  onClick={() =>
                    add(
                      defaultLanguageIds.targetId
                        ? { translations: [{ language_id: defaultLanguageIds.targetId, translation_type: 'direct' }] }
                        : {},
                    )
                  }
                >
                  Tambah Override Makna
                </Button>
              </Space>
            )}
          </Form.List>
        </>
      ) : (
        <Form.List
          name={[name, 'word', 'meanings']}
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
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              {meaningFields.map((m) => (
                <Card
                  key={m.key}
                  size="small"
                  title={`Makna ${m.name + 1}`}
                  extra={
                    <Button
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      disabled={meaningFields.length <= 1}
                      onClick={() => remove(m.name)}
                    >
                      Hapus
                    </Button>
                  }
                >
                  <MeaningFields
                    name={[m.name]}
                    wordClassOptions={wordClassOptions}
                    wordClassLoading={wordClassLoading}
                    defaultLanguageIds={defaultLanguageIds}
                    showOrderIndex
                    orderIndexInitial={m.name + 1}
                    translationsRequired
                  />
                </Card>
              ))}
              <Button
                type="dashed"
                block
                icon={<PlusOutlined />}
                onClick={() =>
                  add(
                    defaultLanguageIds.targetId
                      ? { order_index: meaningFields.length + 1, translations: [{ language_id: defaultLanguageIds.targetId, translation_type: 'direct' }] }
                      : { order_index: meaningFields.length + 1 },
                  )
                }
              >
                + Tambah Makna
              </Button>
            </Space>
          )}
        </Form.List>
      )}
    </Space>
  );
}