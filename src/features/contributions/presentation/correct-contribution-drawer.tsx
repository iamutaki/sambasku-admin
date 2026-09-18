import { useEffect, useMemo, useState } from 'react';
import { DeleteOutlined, PlusOutlined, SaveOutlined } from '@ant-design/icons';
import {
  Alert,
  App as AntdApp,
  Button,
  Card,
  Collapse,
  Col,
  Drawer,
  Flex,
  Form,
  Input,
  Row,
  Select,
  Space,
  Switch,
  Typography,
  type FormInstance,
} from 'antd';
import { fieldToNamePath, pickDefaultLanguageIds } from '@/features/words/application/create-word-utils';
import { useCategoryOptions, useDialectOptions, useLanguageOptions, useWordClassOptions } from '@/features/words/application/use-reference-data';
import {
  MeaningFields,
  RelatedWordItem,
  affixTypeOptions,
  buildRelationOptions,
  buildWordClassOptions,
  exampleSourceOptions,
  variantTypeOptions,
  wordTypeOptions,
} from '@/features/words/presentation/word-form-blocks';
import { ApiError } from '@/shared/api/error';
import type { ContributionDetailView } from '../domain/contribution';
import type { CorrectFormValues } from '../application/correct-contribution';
import { buildCorrectContribution, wordEntityToFormValues } from '../application/correct-contribution';
import { useCorrectContribution } from '../application/use-correct-contribution';

const { Text } = Typography;

export interface CorrectContributionDrawerProps {
  detail: ContributionDetailView;
  open: boolean;
  zIndex: number;
  onCancel: () => void;
}

/**
 * Drawer koreksi (nested di atas drawer review): verifikator menimpa isi
 * kontribusi dengan payload penuh per entity_type. Setiap field di-pre-fill
 * dari isi lama (replace semantics di server). `publish=false` = koreksi
 * disimpan tapi entitas tetap menunggu review.
 */
export function CorrectContributionDrawer({ detail, open, zIndex, onCancel }: CorrectContributionDrawerProps) {
  const { message } = AntdApp.useApp();
  const [form] = Form.useForm<CorrectFormValues>();
  const mutation = useCorrectContribution(detail.contribution.id);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const entityType = detail.entityType;
  const isWord = entityType === 'word';
  const [publish, setPublish] = useState(true);

  // Pre-fill saat terbuka (sekali per entity; antd Form.List butuh nilai
  // sebelum render kolom agar array terisi). destroyOnHidden me-reset state
  // submit error antar bukaan - reset cukup di awal handleSubmit.
  useEffect(() => {
    if (!open) return;
    if (isWord) {
      form.setFieldsValue(wordEntityToFormValues(detail.word!));
    } else {
      form.setFieldsValue(detail.child!.fields as CorrectFormValues);
    }
  }, [open, isWord, detail, form]);

  const handleSubmit = async () => {
    setSubmitError(null);
    try {
      const values = await form.validateFields();
      await mutation.mutateAsync(
        buildCorrectContribution(entityType, values, { comment: undefined, publish }),
        { onSuccess: () => message.success('Koreksi diterapkan.') },
      );
      onCancel();
    } catch (err) {
      if (err instanceof ApiError) {
        const fieldErrors = err.fieldErrors();
        if (Object.keys(fieldErrors).length > 0) {
          type CorrectFieldName = Parameters<typeof form.setFields>[0][number]['name'];
          form.setFields(
            Object.entries(fieldErrors).map(([field, msg]) => {
              // validator kata menamai path `word.meanings.0.…`; form kata
              // menyimpan di `meanings.0.…` (tanpa prefix word).
              const path = field.startsWith('word.') ? field.slice('word.'.length) : field;
              return { name: fieldToNamePath(path) as unknown as CorrectFieldName, errors: [msg] };
            }),
          );
          return;
        }
        setSubmitError(err.message);
      } else {
        setSubmitError('Gagal menyimpan koreksi. Coba lagi.');
      }
    }
  };

  const titlePrefix = isWord ? detail.word!.lemma : detail.child!.wordLemma ?? 'entri';
  const width = isWord ? 'min(720px, 100vw)' : 560;

  return (
    <Drawer
      title={`Koreksi Kontribusi - ${titlePrefix}`}
      open={open}
      onClose={onCancel}
      zIndex={zIndex}
      width={width}
      destroyOnHidden
      footer={
        <Flex justify="flex-end" gap={8}>
          <Button onClick={onCancel}>Batal</Button>
          <Button type="primary" icon={<SaveOutlined />} loading={mutation.isPending} onClick={handleSubmit}>
            Simpan Koreksi
          </Button>
        </Flex>
      }
    >
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        {submitError ? (
          <Alert type="error" showIcon message="Gagal menyimpan koreksi" description={submitError} closable onClose={() => setSubmitError(null)} />
        ) : null}

        {isWord ? (
          <CorrectWordForm form={form} />
        ) : entityType === 'pronunciation' ? (
          <CorrectPronunciationForm form={form} />
        ) : entityType === 'word_image' ? (
          <CorrectWordImageForm form={form} />
        ) : (
          <CorrectExampleForm form={form} />
        )}

        <Card size="small" title="Penerbitan">
          <Space direction="vertical" size={4}>
            <Flex align="center" gap={8}>
              <Switch checked={publish} onChange={setPublish} />
              <Text>Langsung tayang &amp; tandai terverifikasi</Text>
            </Flex>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Matikan bila koreksi hanya ditimpa dan entitas tetap menunggu review.
            </Text>
          </Space>
        </Card>
      </Space>
    </Drawer>
  );
}

// ---------------------------------------------------------------------------
// Form koreksi KATA - pemakai penuh blok create-word (word-form-blocks)
// ---------------------------------------------------------------------------

function CorrectWordForm({ form }: { form: FormInstance<CorrectFormValues> }) {
  const wordClassQuery = useWordClassOptions();
  const categoryQuery = useCategoryOptions();
  const languagesQuery = useLanguageOptions();
  const wordType = Form.useWatch('word_type', form) ?? 'word';

  const languages = useMemo(() => languagesQuery.data ?? [], [languagesQuery.data]);
  const defaultLanguageIds = useMemo(() => pickDefaultLanguageIds(languages), [languages]);
  const sourceLanguageId = (form.getFieldValue('language_id') as string | undefined) ?? defaultLanguageIds.sourceId;
  const dialectQuery = useDialectOptions(sourceLanguageId);

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
  const relationOptions = useMemo(() => buildRelationOptions(wordType), [wordType]);

  return (
    <Form form={form} layout="vertical" requiredMark disabled={false}>
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <Card size="small" title="1. Data Kata Dasar">
          <Row gutter={12} wrap>
            <Col xs={24}>
              <Form.Item name="language_id" noStyle>
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
            <Col xs={24} md={8}>
              <Form.Item name="word_type" label="Jenis Entri">
                <Select options={wordTypeOptions} />
              </Form.Item>
            </Col>
            <Col xs={24} md={16}>
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

        <Card size="small" title="2. Makna / Arti">
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
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
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

        <Card size="small" title="3. Kategori / Glosarium">
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

        <Collapse
          items={[
            {
              key: 'relations',
              label: '4. Relasi Kata (opsional)',
              children: (
                <>
                  <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
                    Relasi kata terkait (sinonim/antonim/dll.) milik entri. Menautkan ke kata yang sudah ada,
                    atau membuat kata baru sekaligus.
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
                        <Row key={field.key} gutter={12} align="top" wrap>
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
                  <Row gutter={12}>
                    <Col xs={24} md={6}>
                      <Form.Item name={['pronunciation', 'notation']} label="Notasi" initialValue="ipa">
                        <Select options={[{ value: 'ipa', label: 'IPA' }]} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={18}>
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
  );
}

// ---------------------------------------------------------------------------
// Form koreksi entity ANAK (pronunciation / word_image / example)
// ---------------------------------------------------------------------------

function CorrectPronunciationForm({ form }: { form: FormInstance<CorrectFormValues> }) {
  return (
    <Form form={form} layout="vertical" requiredMark>
      <Form.Item name="value" label="Teks Pengucapan" rules={[{ required: true, message: 'Teks pengucapan wajib diisi' }]}>
        <Input placeholder="/makatn/" maxLength={500} />
      </Form.Item>
      <Row gutter={12}>
        <Col xs={24} md={8}>
          <Form.Item name="notation" label="Notasi" initialValue="ipa">
            <Select options={[{ value: 'ipa', label: 'IPA' }]} />
          </Form.Item>
        </Col>
        <Col xs={24} md={16}>
          <Form.Item name="dialect_id" label="Dialek (id)">
            <Input placeholder="ID dialek goal, biarkan kosong bila umum / tidak ada" allowClear />
          </Form.Item>
        </Col>
      </Row>
      <Form.Item name="audio_url" label="URL Audio">
        <Input placeholder="https://…" allowClear />
      </Form.Item>
      <Form.Item name="speaker_name" label="Nama Penutur">
        <Input placeholder="mis. Pak Samsul" allowClear />
      </Form.Item>
      <Form.Item name="notes" label="Catatan">
        <Input.TextArea rows={2} placeholder="Opsional" />
      </Form.Item>
    </Form>
  );
}

function CorrectWordImageForm({ form }: { form: FormInstance<CorrectFormValues> }) {
  const isPrimary = Form.useWatch('is_primary', form) ?? false;
  return (
    <Form form={form} layout="vertical" requiredMark>
      <Form.Item name="url" label="URL Gambar" rules={[{ required: true, message: 'URL gambar wajib diisi' }]}>
        <Input placeholder="https://…" allowClear />
      </Form.Item>
      <Form.Item
        name="provider_file_id"
        label="File ID (penyedia)"
        rules={[{ required: true, message: 'File ID wajib diisi' }]}
      >
        <Input placeholder="mis. 01J… (ULID asli di penyedia file)" allowClear />
      </Form.Item>
      <Form.Item name="alt_text" label="Alt Text">
        <Input placeholder="Deskripsi singkat gambar (opsional)" allowClear />
      </Form.Item>
      <Form.Item name="is_primary" label="Gambar Utama" valuePropName="checked">
        <Switch checked={isPrimary} />
      </Form.Item>
    </Form>
  );
}

function CorrectExampleForm({ form }: { form: FormInstance<CorrectFormValues> }) {
  return (
    <Form form={form} layout="vertical" requiredMark>
      <Form.Item
        name="source_sentence"
        label="Kalimat"
        rules={[{ required: true, message: 'Kalimat wajib diisi' }]}
      >
        <Input.TextArea rows={2} placeholder="Kami udah makatn tadi." />
      </Form.Item>
      <Form.Item name="target_sentence" label="Terjemahan Kalimat">
        <Input.TextArea rows={2} placeholder="Kami sudah makan tadi." allowClear />
      </Form.Item>
      <Form.Item name="source_type" label="Sumber">
        <Select options={exampleSourceOptions} allowClear placeholder="Pilih sumber (opsional)" />
      </Form.Item>
      <Form.Item name="notes" label="Catatan">
        <Input.TextArea rows={2} placeholder="Opsional" />
      </Form.Item>
    </Form>
  );
}