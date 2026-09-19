import { useMemo, useState } from 'react';
import { BookOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { App as AntdApp, Button, Card, Col, Divider, Form, Input, InputNumber, Row, Segmented, Select, Space, Switch, Typography } from 'antd';
import { AFFIX_TYPES, AFFIX_TYPE_LABELS, EXAMPLE_SOURCE_TYPES, EXAMPLE_SOURCE_LABELS, RELATION_TYPES, RELATION_TYPE_LABELS, TRANSLATION_TYPES, TRANSLATION_TYPE_LABELS, VARIANT_TYPES, VARIANT_TYPE_LABELS, type CreateWordMeaningFormValue, type RelationType, type WordClassOption } from '../domain/create-word';
import { WORD_TYPES, WORD_TYPE_LABELS } from '../domain/word';
import type { DefaultLanguageIds } from '../application/create-word-utils';
import { matchWordClassId } from '../application/match-word-class';
import { WordSearchSelect } from './word-search-select';
import { KbbiDefinitionPickerModal } from './kbbi-definition-picker-modal';

const { Text } = Typography;

// ------- Opsi dropdown bersama (dipakai form buat & koreksi) -------
export const wordTypeOptions = WORD_TYPES.map((t) => ({ value: t, label: WORD_TYPE_LABELS[t] }));
export const translationTypeOptions = TRANSLATION_TYPES.map((t) => ({ value: t, label: TRANSLATION_TYPE_LABELS[t] }));
export const variantTypeOptions = VARIANT_TYPES.map((t) => ({ value: t, label: VARIANT_TYPE_LABELS[t] }));
export const affixTypeOptions = AFFIX_TYPES.map((t) => ({ value: t, label: AFFIX_TYPE_LABELS[t] }));
export const exampleSourceOptions = EXAMPLE_SOURCE_TYPES.map((t) => ({ value: t, label: EXAMPLE_SOURCE_LABELS[t] }));

/**
 * Tipe relasi yang sah berdasarkan jenis entri (has_component hanya untuk
 * frasa - kontrak: komponen hanya didekomposisi dari idiom/peribahasa).
 */
export function buildRelationOptions(wordType: string | undefined): { value: RelationType; label: string }[] {
  return RELATION_TYPES.filter((t) => !(wordType === 'word' && t === 'has_component')).map((t) => ({
    value: t,
    label: RELATION_TYPE_LABELS[t],
  }));
}

/** Label kelas kata: "Verba (Kata Kerja)" - alias membantu user awam. */
function formatWordClassLabel(name: string, alias: string | null | undefined): string {
  return alias ? `${name} (${alias})` : name;
}

/**
 * Opsi kelas kata berhierarki (induk › anak) - dipakai pemilih "Kelas Kata".
 */
export function buildWordClassOptions(
  options: { id: string; code: string; name: string; alias?: string | null; parent_id: string | null }[],
): {
  value: string;
  label: string;
}[] {
  const byId = new Map(options.map((wc) => [wc.id, wc]));
  const label = (wc: {
    id: string;
    name: string;
    alias?: string | null;
    parent_id: string | null;
  }): string => {
    const self = formatWordClassLabel(wc.name, wc.alias);
    const parent = wc.parent_id ? byId.get(wc.parent_id) : undefined;
    return parent ? `${label(parent)} › ${self}` : self;
  };
  return options.map((wc) => ({ value: wc.id, label: label(wc) }));
}

// ---------------------------------------------------------------------------
// Blok makna/terjemahan/contoh yang dipakai bersama: makna INDUK, makna kata
// inline (inherit=false), override makna (inherit=true), dan makna pada form
// KOREKSI kata. Setiap field memakai `name` RELATIF ke konteks Form.List
// tempat komponen dirender (antd meng-resolution path lewat prefix List).
// ---------------------------------------------------------------------------

export interface MeaningFieldsProps {
  /** path relatif ke objek makna/override di dalam konteks Form.List saat ini */
  name: (string | number)[];
  /**
   * Path absolut dari root form ke objek makna (untuk setFieldValue saat
   * apply hasil KBBI). Contoh: ['meanings', 0] atau
   * ['related_words', 0, 'word', 'meanings', 1].
   */
  absolutePath: (string | number)[];
  wordClassOptions: { value: string; label: string }[];
  /** Raw list untuk match code/label KBBI → word_class_id */
  wordClasses?: WordClassOption[];
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

export function MeaningFields({
  name,
  absolutePath,
  wordClassOptions,
  wordClasses = [],
  wordClassLoading = false,
  defaultLanguageIds,
  showMeaningPicker = false,
  meaningOptions = [],
  showOrderIndex = false,
  orderIndexInitial,
  translationsRequired = true,
}: MeaningFieldsProps) {
  const form = Form.useFormInstance();
  const { message } = AntdApp.useApp();
  const [kbbiOpen, setKbbiOpen] = useState(false);

  const translations = Form.useWatch([...absolutePath, 'translations'], form) as
    | Array<{ translation_text?: string }>
    | undefined;
  const kbbiPrefill = (translations?.[0]?.translation_text ?? '').trim();

  return (
    <>
      {showMeaningPicker ? (
        <Form.Item
          name={[...name, 'meaning_index']}
          label="Makna induk yang diubah"
          rules={[{ required: true, message: 'Pilih makna induk' }]}
        >
          <Select options={meaningOptions} placeholder="Pilih makna induk…" showSearch optionFilterProp="label" />
        </Form.Item>
      ) : null}

      {/* Urutan UX (selaras mobile + 12-api): Terjemahan (+ KBBI) → Kelas kata → Definisi */}
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
                    label={
                      tf.name === 0 ? (
                        <Space size={8}>
                          <span>Terjemahan Indonesia</span>
                          <Button
                            type="link"
                            size="small"
                            icon={<BookOutlined />}
                            onClick={(e) => {
                              e.preventDefault();
                              setKbbiOpen(true);
                            }}
                            style={{ padding: 0, height: 'auto' }}
                          >
                            Ambil dari KBBI
                          </Button>
                        </Space>
                      ) : (
                        'Terjemahan Indonesia'
                      )
                    }
                    rules={[{ required: true, message: 'Terjemahan wajib diisi' }]}
                  >
                    <Input placeholder="Padanan dalam bahasa Indonesia" />
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

      <Row gutter={16} style={{ marginTop: 8 }}>
        {showMeaningPicker ? (
          <Col xs={24} md={14} lg={16}>
            <Form.Item name={[...name, 'word_class_id']} label="Kelas Kata (override)">
              <Select
                showSearch
                optionFilterProp="label"
                options={wordClassOptions}
                allowClear
                placeholder="Ikut induk (biarkan kosong)"
              />
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

      <KbbiDefinitionPickerModal
        open={kbbiOpen}
        initialLemma={kbbiPrefill}
        onClose={() => setKbbiOpen(false)}
        onSelect={(suggestion) => {
          form.setFieldValue([...absolutePath, 'definition'], suggestion.definition);

          const matchedId = matchWordClassId(
            wordClasses,
            suggestion.word_class_code,
            suggestion.word_class_label,
          );
          if (matchedId) {
            form.setFieldValue([...absolutePath, 'word_class_id'], matchedId);
          }

          // Lemma KBBI = padanan Indonesia → isi terjemahan pertama
          const lemmaId = suggestion.lemma.trim();
          if (lemmaId) {
            const current =
              (form.getFieldValue([...absolutePath, 'translations']) as
                | Array<Record<string, unknown>>
                | undefined) ?? [];
            const first = current[0] ?? {};
            const next = [
              {
                ...first,
                language_id:
                  (first.language_id as string | undefined) ||
                  defaultLanguageIds.targetId ||
                  undefined,
                translation_type: (first.translation_type as string | undefined) || 'direct',
                translation_text: lemmaId,
              },
              ...current.slice(1),
            ];
            form.setFieldValue([...absolutePath, 'translations'], next);
          }

          const parts = ['Definisi'];
          if (matchedId) parts.push('kelas kata');
          if (lemmaId) parts.push('terjemahan');
          message.success(`${parts.join(', ')} diisi dari KBBI - silakan review`);
        }}
      />

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

export interface RelatedWordItemProps {
  field: { key: number; name: number };
  remove: () => void;
  relationOptions: { value: RelationType; label: string }[];
  wordClassOptions: { value: string; label: string }[];
  wordClasses?: WordClassOption[];
  wordClassLoading?: boolean;
  defaultLanguageIds: DefaultLanguageIds;
  /** false = mode edit (Form B inline dilarang, 05-api-edit-kata.md) → tampil
   * HANYA bentuk link ke kata lama; Segmented pemilih bentuk disembunyikan. */
  allowInline?: boolean;
}

export function RelatedWordItem({
  field,
  remove,
  relationOptions,
  wordClassOptions,
  wordClasses = [],
  wordClassLoading = false,
  defaultLanguageIds,
  allowInline = true,
}: RelatedWordItemProps) {
  const form = Form.useFormInstance();
  const watchedMode = Form.useWatch(['related_words', field.name, 'mode'], form);
  const mode = allowInline ? (watchedMode ?? 'link') : 'link';

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
        {allowInline ? (
          <Col xs={24} md={12} lg={10}>
            <Form.Item
              name={[field.name, 'mode']}
              label="Bentuk"
              rules={[{ required: true, message: 'Pilih bentuk' }]}
            >
              <Segmented options={modeOptions} />
            </Form.Item>
          </Col>
        ) : null}
        <Col xs={24} md={allowInline ? 8 : 12} lg={allowInline ? 6 : 14}>
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
          wordClasses={wordClasses}
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

export interface InlineWordEditorProps {
  /** indeks item di related_words (dipakai path absolut form) */
  name: number;
  wordClassOptions: { value: string; label: string }[];
  wordClasses?: WordClassOption[];
  wordClassLoading?: boolean;
  defaultLanguageIds: DefaultLanguageIds;
  meaningOptions: { value: number; label: string }[];
}

export function InlineWordEditor({
  name,
  wordClassOptions,
  wordClasses = [],
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
                      absolutePath={['related_words', name, 'word', 'meaning_overrides', ov.name]}
                      wordClassOptions={wordClassOptions}
                      wordClasses={wordClasses}
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
                    absolutePath={['related_words', name, 'word', 'meanings', m.name]}
                    wordClassOptions={wordClassOptions}
                    wordClasses={wordClasses}
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

// ---------------------------------------------------------------------------
// Variasi penulisan & bentuk turunan (11-api-variasi-penulisan.md).
// Ejaan alternatif (default) = variasi penulisan tanpa afiks; afiks hanya
// relevan untuk tipe fleksi/turunan/pengulangan.
// ---------------------------------------------------------------------------

const MAX_VARIANTS = 20; // cermin validator API

interface VariantRowProps {
  field: { key: number; name: number };
  remove: (index: number) => void;
}

/** Satu baris variasi - afiks disembunyikan untuk tipe 'alternative'
 * (mirror validasi server: 400 bila alternative membawa afiks). */
function VariantRow({ field, remove }: VariantRowProps) {
  const form = Form.useFormInstance();
  const variantType = Form.useWatch(['variants', field.name, 'variant_type'], form);
  const isAlternative = variantType === 'alternative' || variantType === undefined;
  const lemma = ((Form.useWatch('lemma', form) as string | undefined) ?? '').trim().toLowerCase();

  const clearAffixIfAlternative = (value: string) => {
    if (value !== 'alternative') return;
    const variants = (form.getFieldValue('variants') as Array<Record<string, unknown>>) ?? [];
    form.setFieldsValue({
      variants: variants.map((item, i) =>
        i === field.name ? { ...item, affix_type: undefined, affix_value: undefined } : item,
      ),
    });
  };

  return (
    <Row gutter={12} align="top">
      <Col xs={24} md={8} lg={7}>
        <Form.Item
          name={[field.name, 'form']}
          label="Bentuk"
          rules={[
            { required: true, message: 'Wajib' },
            {
              validator: (_, value: string | undefined) => {
                const v = (value ?? '').trim().toLowerCase();
                if (!v) return Promise.resolve();
                // Mirror validator API (11): variasi ≠ lemma induk
                if (lemma && v === lemma) {
                  return Promise.reject(
                    new Error('Sama persis dengan lemma - tidak perlu dicatat sebagai variasi'),
                  );
                }
                // Dedup antar-item (UI tidak mengelola dialek per variasi)
                const variants = (form.getFieldValue('variants') as Array<{ form?: string }>) ?? [];
                const dup = variants.some(
                  (item, i) => i !== field.name && (item.form ?? '').trim().toLowerCase() === v,
                );
                if (dup) return Promise.reject(new Error('Variasi duplikat dalam daftar'));
                return Promise.resolve();
              },
            },
          ]}
        >
          <Input placeholder={isAlternative ? "mis. ketex, kettek, kete'" : 'mis. memakan'} maxLength={255} />
        </Form.Item>
      </Col>
      <Col xs={24} md={7} lg={5}>
        <Form.Item name={[field.name, 'variant_type']} label="Jenis" initialValue="alternative">
          <Select options={variantTypeOptions} onChange={clearAffixIfAlternative} />
        </Form.Item>
      </Col>
      {!isAlternative ? (
        <>
          <Col xs={24} md={5} lg={4}>
            <Form.Item name={[field.name, 'affix_type']} label="Tipe Afiks">
              <Select allowClear placeholder="tanpa afiks" options={affixTypeOptions} />
            </Form.Item>
          </Col>
          <Col xs={24} md={4} lg={3}>
            <Form.Item name={[field.name, 'affix_value']} label="Nilai Afiks">
              <Input placeholder="mis. me-" maxLength={50} />
            </Form.Item>
          </Col>
        </>
      ) : null}
      <Col flex="32px">
        <Form.Item label=" ">
          <Button type="text" danger icon={<DeleteOutlined />} onClick={() => remove(field.name)} />
        </Form.Item>
      </Col>
    </Row>
  );
}

/** Section variasi penulisan + bentuk turunan (dipakai create & edit). */
export function WordVariantsField() {
  const form = Form.useFormInstance();
  const variants = Form.useWatch('variants', form) ?? [];

  return (
    <Form.List name="variants">
      {(fields, { add, remove }) => (
        <Space direction="vertical" size={8} style={{ width: '100%' }}>
          <Typography.Text type="secondary">
            Ejaan lain dari kata ini (mis. ketek → ketex, kettek, kete&apos;) atau bentuk
            turunan berafiks. Dipakai pencarian: mencari &quot;ketex&quot; menemukan entri ini.
          </Typography.Text>
          {fields.map((field) => (
            <VariantRow key={field.key} field={field} remove={remove} />
          ))}
          <Button
            type="dashed"
            block
            icon={<PlusOutlined />}
            disabled={variants.length >= MAX_VARIANTS}
            onClick={() => add({ variant_type: 'alternative' })}
          >
            Tambah Variasi / Bentuk Turunan
          </Button>
        </Space>
      )}
    </Form.List>
  );
}