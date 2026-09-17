import { useEffect, useMemo, useRef, useState } from 'react';
import { DeleteOutlined, PlusOutlined, SaveOutlined, SendOutlined } from '@ant-design/icons';
import { Alert, App as AntdApp, Button, Card, Collapse, Col, Divider, Flex, Form, Input, InputNumber, Row, Select, Space, Typography, theme } from 'antd';
import { useNavigate } from '@tanstack/react-router';
import { PageHeader } from '@/shared/components/page-header';
import { ApiError } from '@/shared/api/error';
import { useAuth } from '@/shared/auth/use-auth';
import { buildCreateWordBody, fieldToNamePath, pickDefaultLanguageIds } from '../application/create-word-utils';
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
  type CreateWordFormValues,
  type WordClassOption,
} from '../domain/create-word';
import { WORD_TYPES, WORD_TYPE_LABELS } from '../domain/word';
import { WordSearchSelect } from './word-search-select';

const { Text } = Typography;

const wordTypeOptions = WORD_TYPES.map((t) => ({ value: t, label: WORD_TYPE_LABELS[t] }));
const translationTypeOptions = TRANSLATION_TYPES.map((t) => ({ value: t, label: TRANSLATION_TYPE_LABELS[t] }));
const variantTypeOptions = VARIANT_TYPES.map((t) => ({ value: t, label: VARIANT_TYPE_LABELS[t] }));
const affixTypeOptions = AFFIX_TYPES.map((t) => ({ value: t, label: AFFIX_TYPE_LABELS[t] }));
const exampleSourceOptions = EXAMPLE_SOURCE_TYPES.map((t) => ({ value: t, label: EXAMPLE_SOURCE_LABELS[t] }));

export function CreateWordPage() {
  const navigate = useNavigate();
  const { message } = AntdApp.useApp();
  const { user } = useAuth();
  const { token: { colorFillAlter } } = theme.useToken();

  const [form] = Form.useForm<CreateWordFormValues>();
  const createMutation = useCreateWord();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const languageId = Form.useWatch('language_id', form);
  const wordType = Form.useWatch('word_type', form) ?? 'word';
  const isContributor = user?.role === 'contributor';

  const languageQuery = useLanguageOptions();
  const dialectQuery = useDialectOptions(languageId);
  const wordClassQuery = useWordClassOptions();
  const categoryQuery = useCategoryOptions();

  const languages = useMemo(() => languageQuery.data ?? [], [languageQuery.data]);
  const languageOptions = useMemo(
    () => languages.map((l) => ({ value: l.id, label: l.native_name ? `${l.name} (${l.native_name})` : l.name })),
    [languages],
  );

  // Bahasa default: lemma = sumber (Sambas), terjemahan = target (Indonesia).
  // Dipilih deterministik oleh pickDefaultLanguageIds — tidak bergantung pada
  // urutan list bahasa dan tidak pernah memilih bahasa yang sama.
  const defaultLanguageIds = useMemo(() => pickDefaultLanguageIds(languages), [languages]);

  // Isi nilai awal sekali saat data bahasa siap.
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current || !defaultLanguageIds.sourceId) return;
    seeded.current = true;
    form.setFieldsValue({ language_id: defaultLanguageIds.sourceId, word_type: 'word' });
  }, [defaultLanguageIds.sourceId, form]);

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

  const clearDialect = () => form.setFieldValue('dialect_id', undefined);

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
            navigate({ to: '/words' });
          },
          onError: (err) => handleSubmitError(err),
        },
      );
    } catch {
      // Validasi form gagal — error inline antd sudah tampil, tidak ada aksi.
    }
  };

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

  return (
    <>
      <PageHeader title="Tambah Kata Baru" subtitle="Form kosakata lengkap — kata, makna, terjemahan, contoh, dan relasi." />
      <Form form={form} layout="vertical" requiredMark disabled={createMutation.isPending}>
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          {submitError ? (
            <Alert type="error" showIcon message="Gagal menyimpan kata" description={submitError} closable onClose={() => setSubmitError(null)} />
          ) : null}

          {/* 1. Data kata dasar */}
          <Card title="1. Data Kata Dasar">
            <Row gutter={16}>
              <Col xs={24} md={12} lg={8}>
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
                <Form.Item
                  name="language_id"
                  label="Bahasa"
                  rules={[{ required: true, message: 'Bahasa wajib dipilih' }]}
                >
                  <Select
                    options={languageOptions}
                    loading={languageQuery.isLoading}
                    disabled={languages.length <= 1}
                    onChange={clearDialect}
                    placeholder="Pilih bahasa"
                  />
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
                      <Row gutter={16}>
                        <Col xs={24} md={14} lg={16}>
                          <Form.Item
                            name={[field.name, 'word_class_id']}
                            label="Kelas Kata"
                            rules={[{ required: true, message: 'Kelas kata wajib dipilih' }]}
                          >
                            <Select
                              showSearch
                              optionFilterProp="label"
                              options={wordClassOptions}
                              loading={wordClassQuery.isLoading}
                              placeholder="Pilih kelas kata (mis. Verba › Verba Transitif)"
                            />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={6} lg={4}>
                          <Form.Item name={[field.name, 'order_index']} label="Urutan Tampil" initialValue={field.name + 1}>
                            <InputNumber min={1} style={{ width: '100%' }} />
                          </Form.Item>
                        </Col>
                      </Row>
                      <Form.Item
                        name={[field.name, 'definition']}
                        label="Definisi Konseptual"
                        rules={[{ required: true, message: 'Definisi wajib diisi' }]}
                      >
                        <Input.TextArea rows={2} placeholder="Aktivitas memasukkan makanan ke mulut" />
                      </Form.Item>

                      <Divider titlePlacement="start" plain>
                        Terjemahan
                      </Divider>
                      <Form.List
                        name={[field.name, 'translations']}
                        rules={[
                          {
                            validator: (_, value) =>
                              Array.isArray(value) && value.length > 0
                                ? Promise.resolve()
                                : Promise.reject(new Error('Minimal 1 terjemahan per makna')),
                          },
                        ]}
                      >
                        {(transFields, { add: addTranslation, remove: removeTranslation }) => (
                          <Space direction="vertical" size={8} style={{ width: '100%' }}>
                            {transFields.map((tf) => (
                              <Row key={tf.key} gutter={12} align="top">
                                <Col flex="150px">
                                  <Form.Item
                                    name={[tf.name, 'language_id']}
                                    label="Bahasa"
                                    rules={[{ required: true, message: 'Wajib' }]}
                                  >
                                    <Select options={languageOptions} loading={languageQuery.isLoading} placeholder="Bahasa" />
                                  </Form.Item>
                                </Col>
                                <Col flex="auto">
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
                      <Form.List name={[field.name, 'examples']}>
                        {(exampleFields, { add: addExample, remove: removeExample }) => (
                          <Space direction="vertical" size={8} style={{ width: '100%' }}>
                            {exampleFields.map((ef) => (
                              <Row key={ef.key} gutter={12} align="top" wrap>
                                <Col flex="150px">
                                  <Form.Item
                                    name={[ef.name, 'source_language_id']}
                                    label="Bh. Kalimat"
                                    rules={[{ required: true, message: 'Wajib' }]}
                                  >
                                    <Select options={languageOptions} loading={languageQuery.isLoading} placeholder="Bahasa" />
                                  </Form.Item>
                                </Col>
                                <Col flex="auto">
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
                                <Col flex="150px">
                                  <Form.Item name={[ef.name, 'target_language_id']} label="Bh. Terjemahan">
                                    <Select options={languageOptions} loading={languageQuery.isLoading} placeholder="Bahasa" />
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
                              onClick={() => addExample(defaultLanguageIds.sourceId ? { source_language_id: defaultLanguageIds.sourceId, source_type: 'native_speaker' } : {})}
                            >
                              Tambah Contoh
                            </Button>
                          </Space>
                        )}
                      </Form.List>
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
                  <Form.List name="related_words">
                    {(fields, { add, remove }) => (
                      <Space direction="vertical" size={8} style={{ width: '100%' }}>
                        {fields.map((field) => (
                          <Row key={field.key} gutter={12} align="top">
                            <Col flex="auto">
                              <Form.Item name={[field.name, 'word_id']} label="Kata terkait" rules={[{ required: true, message: 'Pilih kata' }]}>
                                <WordSearchSelect />
                              </Form.Item>
                            </Col>
                            <Col flex="180px">
                              <Form.Item name={[field.name, 'relation_type']} label="Tipe Relasi" rules={[{ required: true, message: 'Wajib' }]}>
                                <Select options={relationOptions} />
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
                          Tambah Relasi
                        </Button>
                      </Space>
                    )}
                  </Form.List>
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
        justify="space-between"
        align="center"
        wrap
        gap={12}
        style={{ marginTop: 24, paddingTop: 16, borderTop: `1px solid ${colorFillAlter}` }}
      >
        <div>
          {isContributor ? (
            <Text type="warning">Sebagai kontributor, "Simpan & Publikasikan" akan menghasilkan status "Menunggu Review".</Text>
          ) : null}
        </div>
        <Space>
          <Button onClick={() => navigate({ to: '/words' })}>Batal</Button>
          <Button icon={<SaveOutlined />} loading={createMutation.isPending} onClick={() => submit('draft')}>
            Simpan sebagai Draft
          </Button>
          <Button type="primary" icon={<SendOutlined />} loading={createMutation.isPending} onClick={() => submit('published')}>
            Simpan &amp; Publikasikan
          </Button>
        </Space>
      </Flex>
    </>
  );
}