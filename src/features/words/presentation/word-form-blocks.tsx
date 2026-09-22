import { useCallback, useMemo, useState } from 'react';
import {
  AudioOutlined,
  BookOutlined,
  CheckOutlined,
  DeleteOutlined,
  PlusOutlined,
  StopOutlined,
} from '@ant-design/icons';
import type { FormInstance } from 'antd/es/form';
import {
  App as AntdApp,
  Alert,
  Button,
  Card,
  Col,
  Divider,
  Flex,
  Form,
  Input,
  InputNumber,
  Row,
  Segmented,
  Select,
  Space,
  Switch,
  Tag,
  Tooltip,
  Typography,
  Upload,
  theme,
} from 'antd';
import type { UploadProps } from 'antd';
import { AFFIX_TYPES, AFFIX_TYPE_LABELS, EXAMPLE_SOURCE_TYPES, EXAMPLE_SOURCE_LABELS, RELATION_TYPES, RELATION_TYPE_LABELS, TRANSLATION_TYPES, TRANSLATION_TYPE_LABELS, VARIANT_TYPES, VARIANT_TYPE_LABELS, type CreateWordMeaningFormValue, type RelationType, type WordClassOption } from '../domain/create-word';
import { WORD_TYPES, WORD_TYPE_LABELS } from '../domain/word';
import type { DefaultLanguageIds } from '../application/create-word-utils';
import { matchWordClassId } from '../application/match-word-class';
import { WordSearchSelect } from './word-search-select';
import { KbbiDefinitionPickerModal } from './kbbi-definition-picker-modal';
import {
  formatRecordingClock,
  MAX_RECORDING_SECONDS,
  useAudioRecorder,
} from '../application/use-audio-recorder';
import { useUploadPronunciationAudio } from '../application/use-upload-pronunciation-audio';
import { validatePronunciationAudioFile } from '../infrastructure/pronunciation-audio-api';
import type { WordDetailAudio } from '../domain/word-detail';
import { mergeAudiosForExamples } from '../application/example-audios';
import { useAuth } from '@/shared/auth/use-auth';
import { AudioTrimEditor } from './audio-trim-editor';
import type { TrimAudioResult } from '../application/trim-audio';

const { Text } = Typography;

type MeaningCompletenessMode = 'both' | 'definition_only' | 'padanan_only';

function syncMeaningCompleteness(form: FormInstance, absolutePath: (string | number)[]) {
  const hasDef = form.getFieldValue([...absolutePath, 'is_have_definition']) === true;
  const hasPadanan = form.getFieldValue([...absolutePath, 'is_have_translation']) === true;
  const mode: MeaningCompletenessMode | undefined =
    hasDef && hasPadanan
      ? 'both'
      : hasDef
        ? 'definition_only'
        : hasPadanan
          ? 'padanan_only'
          : undefined;
  form.setFieldValue([...absolutePath, 'meaning_completeness'], mode);
}

function setHaveDefinition(
  form: FormInstance,
  absolutePath: (string | number)[],
  next: boolean,
) {
  form.setFieldValue([...absolutePath, 'is_have_definition'], next);
  // Pastikan flag pasangan explicit false (utils: undefined = punya definisi).
  if (form.getFieldValue([...absolutePath, 'is_have_translation']) == null) {
    form.setFieldValue([...absolutePath, 'is_have_translation'], false);
  }
  if (!next) {
    form.setFieldValue([...absolutePath, 'definition'], '-');
  } else if (
    (form.getFieldValue([...absolutePath, 'definition']) as string | undefined)?.trim() === '-'
  ) {
    form.setFieldValue([...absolutePath, 'definition'], '');
  }
  syncMeaningCompleteness(form, absolutePath);
}

function setHavePadanan(
  form: FormInstance,
  absolutePath: (string | number)[],
  defaultLanguageIds: DefaultLanguageIds,
  next: boolean,
) {
  form.setFieldValue([...absolutePath, 'is_have_translation'], next);
  if (form.getFieldValue([...absolutePath, 'is_have_definition']) == null) {
    form.setFieldValue([...absolutePath, 'is_have_definition'], false);
  }
  if (!next) {
    form.setFieldValue([...absolutePath, 'translations'], []);
  } else if (!(form.getFieldValue([...absolutePath, 'translations']) as unknown[])?.length) {
    form.setFieldValue([...absolutePath, 'translations'], [
      { language_id: defaultLanguageIds.targetId, translation_type: 'direct' },
    ]);
  }
  syncMeaningCompleteness(form, absolutePath);
}

/** Opsi checklist: kotak kiri + label, lebar penuh (bukan radio). */
function KnowledgeToggleChip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  const { token } = theme.useToken();

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        height: 44,
        padding: '0 14px',
        margin: 0,
        cursor: 'pointer',
        borderRadius: token.borderRadiusLG ?? 8,
        border: selected
          ? `1.5px solid ${token.colorPrimary}`
          : `1px solid ${token.colorBorder}`,
        background: selected ? token.colorPrimaryBg : token.colorBgContainer,
        color: selected ? token.colorPrimary : token.colorText,
        fontWeight: selected ? 600 : 500,
        fontSize: token.fontSize,
        lineHeight: 1.2,
        textAlign: 'left',
        transition: 'border-color 0.15s ease, background 0.15s ease, color 0.15s ease',
      }}
    >
      <span
        aria-hidden
        style={{
          width: 16,
          height: 16,
          flexShrink: 0,
          borderRadius: 4,
          border: selected
            ? `1.5px solid ${token.colorPrimary}`
            : `1.5px solid ${token.colorTextQuaternary}`,
          background: selected ? token.colorPrimary : token.colorBgContainer,
          color: token.colorTextLightSolid,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {selected ? <CheckOutlined style={{ fontSize: 10 }} /> : null}
      </span>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {label}
      </span>
    </button>
  );
}

function knowledgeHint(wantDefinition: boolean, wantPadanan: boolean): string {
  if (!wantDefinition && !wantPadanan) {
    return 'Centang Definisi dan/atau Terjemahan. Form makna muncul setelah itu.';
  }
  if (wantDefinition && wantPadanan) {
    return 'Isi terjemahan dan uraian definisi.';
  }
  if (wantDefinition) {
    return 'Isi uraian makna. Terjemahan bisa dilengkapi nanti.';
  }
  return 'Isi terjemahan saja. Definisi bisa dilengkapi nanti.';
}

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
  /**
   * Create-only: izinkan rekam audio per contoh (draft lokal).
   * Diunggah berurutan setelah POST create (GET detail → example_id).
   */
  enablePendingExampleAudio?: boolean;
  pendingExampleAudios?: Record<string, PendingPronunciationAudio | null>;
  onPendingExampleAudioChange?: (
    key: string,
    meta: { meaningIndex: number; exampleIndex: number; sourceSentence: string },
    next: PendingPronunciationAudio | null,
  ) => void;
  dialectOptionsForExampleAudio?: { value: string; label: string }[];
  defaultDialectIdForExampleAudio?: string | null;
}

/** Key draft audio contoh di form create: maknaIndex:contohIndex */
export function pendingExampleAudioKey(meaningIndex: number, exampleIndex: number): string {
  return `${meaningIndex}:${exampleIndex}`;
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
  enablePendingExampleAudio = false,
  pendingExampleAudios = {},
  onPendingExampleAudioChange,
  dialectOptionsForExampleAudio = [],
  defaultDialectIdForExampleAudio = null,
}: MeaningFieldsProps) {
  const form = Form.useFormInstance();
  const { message } = AntdApp.useApp();
  const [kbbiOpen, setKbbiOpen] = useState(false);

  const meaningIndex =
    typeof absolutePath[absolutePath.length - 1] === 'number'
      ? (absolutePath[absolutePath.length - 1] as number)
      : -1;

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

      {/* Selaras mobile: dua toggle independen (Terjemahan / Definisi). */}
      {translationsRequired ? (
        <>
          <Divider titlePlacement="start" plain>
            Apa yang diketahui
          </Divider>
          <Form.Item name={[...name, 'meaning_completeness']} hidden>
            <Input />
          </Form.Item>
          <Form.Item name={[...name, 'is_have_definition']} hidden>
            <Input />
          </Form.Item>
          <Form.Item name={[...name, 'is_have_translation']} hidden>
            <Input />
          </Form.Item>
          <Form.Item noStyle shouldUpdate>
            {() => {
              const wantDefinition =
                form.getFieldValue([...absolutePath, 'is_have_definition']) === true;
              const wantPadanan =
                form.getFieldValue([...absolutePath, 'is_have_translation']) === true;
              return (
                <Space direction="vertical" size={8} style={{ width: '100%', marginBottom: 12 }}>
                  <Row gutter={8}>
                    <Col span={12}>
                      <KnowledgeToggleChip
                        label="Terjemahan"
                        selected={wantPadanan}
                        onClick={() =>
                          setHavePadanan(form, absolutePath, defaultLanguageIds, !wantPadanan)
                        }
                      />
                    </Col>
                    <Col span={12}>
                      <KnowledgeToggleChip
                        label="Definisi"
                        selected={wantDefinition}
                        onClick={() => setHaveDefinition(form, absolutePath, !wantDefinition)}
                      />
                    </Col>
                  </Row>
                  <Typography.Text type="secondary">
                    {knowledgeHint(wantDefinition, wantPadanan)}
                  </Typography.Text>
                </Space>
              );
            }}
          </Form.Item>
        </>
      ) : (
        <Divider titlePlacement="start" plain>
          Terjemahan kata Indonesia
        </Divider>
      )}

      <Form.Item noStyle shouldUpdate>
        {() => {
          const wantDefinition =
            form.getFieldValue([...absolutePath, 'is_have_definition']) === true;
          const wantPadanan =
            form.getFieldValue([...absolutePath, 'is_have_translation']) === true;
          const modePicked = wantDefinition || wantPadanan;
          if (translationsRequired && !modePicked) {
            return null;
          }
          const hasPadanan = !translationsRequired || wantPadanan;
          const hasDef = !translationsRequired || wantDefinition;

          return (
            <>
              {!hasPadanan ? (
                <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
                  Tanpa terjemahan - definisi uraian sudah cukup. Bisa dilengkapi nanti.
                </Typography.Text>
              ) : (
                <Form.List
                  name={[...name, 'translations']}
                  rules={
                    translationsRequired
                      ? [
                          {
                            validator: (_, value) => {
                              if (form.getFieldValue([...absolutePath, 'is_have_translation']) === false) {
                                return Promise.resolve();
                              }
                              return Array.isArray(value) && value.length > 0
                                ? Promise.resolve()
                                : Promise.reject(new Error('Minimal 1 terjemahan, atau pilih “Definisi”'));
                            },
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
                            <Form.Item
                              name={[tf.name, 'language_id']}
                              noStyle
                              rules={[{ required: true, message: 'Wajib' }]}
                            >
                              <Input type="hidden" />
                            </Form.Item>
                            <Form.Item
                              name={[tf.name, 'translation_text']}
                              label="Terjemahan Indonesia"
                              extra={
                                tf.name === 0
                                  ? 'Tekan icon buku untuk mencari definisi di KBBI'
                                  : undefined
                              }
                              rules={[{ required: true, message: 'Terjemahan wajib diisi' }]}
                            >
                              <Input
                                placeholder="Satu kata/frasa setara di Indonesia"
                                suffix={
                                  tf.name === 0 ? (
                                    <Tooltip title="Ambil dari KBBI">
                                      <Button
                                        type="text"
                                        size="small"
                                        icon={<BookOutlined />}
                                        aria-label="Ambil dari KBBI"
                                        onClick={(e) => {
                                          e.preventDefault();
                                          setKbbiOpen(true);
                                        }}
                                      />
                                    </Tooltip>
                                  ) : undefined
                                }
                              />
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
                                disabled={transFields.length <= 1 && translationsRequired}
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
                        onClick={() =>
                          addTranslation(
                            defaultLanguageIds.targetId
                              ? { language_id: defaultLanguageIds.targetId, translation_type: 'direct' }
                              : {},
                          )
                        }
                      >
                        Tambah Terjemahan
                      </Button>
                    </Space>
                  )}
                </Form.List>
              )}

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
                    <Form.Item
                      name={[...name, 'order_index']}
                      label="Urutan Tampil"
                      initialValue={orderIndexInitial ?? 1}
                    >
                      <InputNumber min={1} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                ) : null}
              </Row>

              {!hasDef ? (
                <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
                  Tanpa definisi - isi terjemahan dulu. Definisi bisa dilengkapi nanti.
                </Typography.Text>
              ) : (
                <Form.Item
                  name={[...name, 'definition']}
                  label={showMeaningPicker ? 'Definisi (override)' : 'Definisi Konseptual'}
                  rules={[{ required: !showMeaningPicker, message: 'Definisi wajib diisi' }]}
                >
                  <Input.TextArea
                    rows={2}
                    placeholder={
                      showMeaningPicker
                        ? 'Biarkan kosong bila tetap memakai definisi induk'
                        : 'Aktivitas memasukkan makanan ke mulut'
                    }
                  />
                </Form.Item>
              )}
            </>
          );
        }}
      </Form.Item>

      <KbbiDefinitionPickerModal
        open={kbbiOpen}
        initialLemma={kbbiPrefill}
        onClose={() => setKbbiOpen(false)}
        onSelect={(suggestion) => {
          setHaveDefinition(form, absolutePath, true);
          setHavePadanan(form, absolutePath, defaultLanguageIds, true);
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
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        message={
          enablePendingExampleAudio
            ? 'Audio contoh bisa direkam sekarang'
            : 'Audio contoh direkam setelah kata tersimpan'
        }
        description={
          enablePendingExampleAudio
            ? 'Rekam per contoh di bawah. Setelah kata disimpan, API mengunggah audio berurutan (create → ambil ID contoh → upload).'
            : 'Isi teks contoh di sini, lalu simpan. Rekam audio ada di halaman Detail / Edit (bagian Audio contoh kalimat).'
        }
      />
      <Form.List name={[...name, 'examples']}>
        {(exampleFields, { add: addExample, remove: removeExample }) => (
          <Space direction="vertical" size={8} style={{ width: '100%' }}>
            {exampleFields.map((ef) => (
              <div key={ef.key}>
                <Row gutter={12} align="top" wrap>
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
                      <Button
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => {
                          if (enablePendingExampleAudio && meaningIndex >= 0) {
                            const key = pendingExampleAudioKey(meaningIndex, ef.name);
                            onPendingExampleAudioChange?.(
                              key,
                              { meaningIndex, exampleIndex: ef.name, sourceSentence: '' },
                              null,
                            );
                          }
                          removeExample(ef.name);
                        }}
                      />
                    </Form.Item>
                  </Col>
                  <Col flex="auto">
                    <Form.Item name={[ef.name, 'target_sentence']} label="Terjemahan Kalimat">
                      <Input.TextArea rows={1} autoSize placeholder="Kami sudah makan tadi." />
                    </Form.Item>
                  </Col>
                </Row>
                {enablePendingExampleAudio && meaningIndex >= 0 && onPendingExampleAudioChange ? (
                  <div style={{ marginTop: 8, marginBottom: 8 }}>
                    <Text type="secondary" style={{ display: 'block', marginBottom: 6 }}>
                      Audio contoh (opsional) — diunggah otomatis setelah simpan
                    </Text>
                    <PendingPronunciationAudioField
                      dialectOptions={dialectOptionsForExampleAudio}
                      defaultDialectId={defaultDialectIdForExampleAudio}
                      value={pendingExampleAudios[pendingExampleAudioKey(meaningIndex, ef.name)] ?? null}
                      onChange={(next) => {
                        const sentence = String(
                          form.getFieldValue([...absolutePath, 'examples', ef.name, 'source_sentence']) ?? '',
                        ).trim();
                        onPendingExampleAudioChange(
                          pendingExampleAudioKey(meaningIndex, ef.name),
                          {
                            meaningIndex,
                            exampleIndex: ef.name,
                            sourceSentence: sentence,
                          },
                          next,
                        );
                      }}
                    />
                  </div>
                ) : null}
              </div>
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
                Tambah Makna
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

// ---------------------------------------------------------------------------
// Audio pelafalan (word_audios) — upload multipart + daftar pemutar
// ---------------------------------------------------------------------------

/**
 * Nama penutur awal = username akun yang sedang login.
 * Setelah admin mengubah kolom, nilai sesi tidak menimpa lagi.
 */
function useSessionSpeakerName(existing?: string | null): [string, (next: string) => void] {
  const { user } = useAuth();
  const sessionName = user?.username?.trim() ?? '';
  const [draft, setDraft] = useState(() => existing?.trim() ?? '');
  const [touched, setTouched] = useState(() => Boolean(existing?.trim()));

  // Belum diubah user → tampilkan session username (derive, bukan effect).
  const speakerName = touched ? draft : draft || sessionName;

  const update = useCallback((next: string) => {
    setTouched(true);
    setDraft(next);
  }, []);

  return [speakerName, update];
}

export function formatAudioFileSize(bytes: number | null | undefined): string {
  if (bytes == null || bytes <= 0) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatAudioDurationMs(ms: number | null | undefined): string {
  if (ms == null || ms <= 0) return '-';
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec} dtk`;
  const min = Math.floor(sec / 60);
  const rem = sec % 60;
  return rem ? `${min} m ${rem} dtk` : `${min} m`;
}

export interface WordAudioPlayerRowProps {
  audio: WordDetailAudio;
  parentLemma: string;
  dialectLabel: string;
  /** true = audio contoh kalimat (bukan lemma) */
  isExample?: boolean;
}

export function WordAudioPlayerRow({
  audio,
  parentLemma,
  dialectLabel,
  isExample = false,
}: WordAudioPlayerRowProps) {
  return (
    <Flex gap={12} wrap align="flex-start" style={{ width: '100%' }}>
      <audio controls src={audio.url} preload="metadata" style={{ minWidth: 240, maxWidth: '100%' }} />
      <Space direction="vertical" size={2} style={{ flex: 1, minWidth: 200 }}>
        <Space size={4} wrap>
          {audio.is_primary ? <Tag color="geekblue">Utama</Tag> : null}
          {audio.status && audio.status !== 'published' ? <Tag>{audio.status}</Tag> : null}
          {isExample ? <Tag>Contoh</Tag> : <Tag color="purple">Lemma</Tag>}
        </Space>
        <Text type="secondary">
          Lemma: {parentLemma}
          {' · '}
          Dialek: {dialectLabel}
        </Text>
        <Text type="secondary">
          Penutur: {audio.speaker_name?.trim() || '-'}
          {' · '}
          Durasi: {formatAudioDurationMs(audio.duration_ms)}
          {' · '}
          Ukuran: {formatAudioFileSize(audio.file_size ?? null)}
        </Text>
      </Space>
    </Flex>
  );
}

export interface PronunciationAudioUploadProps {
  wordId: string;
  /** Jika diisi, audio ditaut ke contoh kalimat (example_id). */
  exampleId?: string;
  dialectOptions: { value: string; label: string }[];
  defaultDialectId?: string | null;
  onUploaded?: () => void;
  compact?: boolean;
}

/**
 * Rekam mikrofon (MediaRecorder) atau pilih file → potong → upload multipart.
 * Dipakai di detail, edit, dan inline contoh.
 */
export function PronunciationAudioUpload({
  wordId,
  exampleId,
  dialectOptions,
  defaultDialectId,
  onUploaded,
  compact = false,
}: PronunciationAudioUploadProps) {
  const { message } = AntdApp.useApp();
  const uploadMutation = useUploadPronunciationAudio(wordId);
  const recorder = useAudioRecorder();
  const [speakerName, setSpeakerName] = useSessionSpeakerName();
  const [dialectId, setDialectId] = useState<string | undefined>(
    defaultDialectId ?? undefined,
  );
  /** File dipilih (bukan dari recorder) — masuk editor potong. */
  const [pickedDraft, setPickedDraft] = useState<{
    blob: Blob;
    previewUrl: string;
  } | null>(null);

  const clearPickedDraft = () => {
    if (pickedDraft?.previewUrl) URL.revokeObjectURL(pickedDraft.previewUrl);
    setPickedDraft(null);
  };

  const uploadFile = async (file: File, durationMs?: number) => {
    const err = validatePronunciationAudioFile(file);
    if (err) {
      message.warning(err);
      return;
    }
    try {
      await uploadMutation.mutateAsync({
        file,
        fields: {
          ...(dialectId ? { dialect_id: dialectId } : {}),
          ...(exampleId ? { example_id: exampleId } : {}),
          ...(speakerName.trim() ? { speaker_name: speakerName.trim() } : {}),
          ...(durationMs != null && durationMs > 0 ? { duration_ms: durationMs } : {}),
        },
      });
      message.success(exampleId ? 'Audio contoh diunggah' : 'Audio pelafalan diunggah');
      clearPickedDraft();
      recorder.reset();
      onUploaded?.();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Gagal mengunggah audio';
      message.error(msg);
    }
  };

  const handleTrimConfirm = async (result: TrimAudioResult) => {
    await uploadFile(result.file, result.durationMs);
  };

  const beforeUpload: UploadProps['beforeUpload'] = (file) => {
    const err = validatePronunciationAudioFile(file as File);
    if (err) {
      message.warning(err);
      return Upload.LIST_IGNORE;
    }
    return false;
  };

  const handleFileChange: UploadProps['onChange'] = (info) => {
    const raw = info.file.originFileObj ?? (info.file as unknown as File);
    if (!raw || !(raw instanceof File)) return;
    clearPickedDraft();
    recorder.reset();
    const previewUrl = URL.createObjectURL(raw);
    setPickedDraft({ blob: raw, previewUrl });
  };

  const trimSource =
    pickedDraft ??
    (recorder.state === 'preview' && recorder.blob && recorder.previewUrl
      ? { blob: recorder.blob, previewUrl: recorder.previewUrl }
      : null);

  const editing = Boolean(trimSource);

  return (
    <Space direction="vertical" size={8} style={{ width: '100%' }}>
      {!compact ? (
        <Text type="secondary">
          Rekam atau pilih file, lalu potong diam di awal/akhir sebelum unggah (maks.{' '}
          {MAX_RECORDING_SECONDS} dtk rekaman / 5 MB). Kontributor masuk antrean review;
          verifikator langsung tayang.
        </Text>
      ) : null}
      <Row gutter={8} wrap>
        <Col xs={24} md={10}>
          <Input
            placeholder="Nama penutur (opsional)"
            value={speakerName}
            onChange={(e) => setSpeakerName(e.target.value)}
            maxLength={255}
            allowClear
            disabled={recorder.state === 'recording' || uploadMutation.isPending || editing}
          />
        </Col>
        <Col xs={24} md={8}>
          <Select
            allowClear
            placeholder="Dialek (opsional)"
            options={dialectOptions}
            value={dialectId}
            onChange={(v) => setDialectId(v)}
            style={{ width: '100%' }}
            disabled={recorder.state === 'recording' || uploadMutation.isPending || editing}
          />
        </Col>
      </Row>

      {recorder.error ? <Alert type="warning" showIcon message={recorder.error} /> : null}

      {recorder.state === 'recording' ? (
        <Space wrap>
          <Tag color="red">Merekam {formatRecordingClock(recorder.elapsedMs)}</Tag>
          <Button danger icon={<StopOutlined />} onClick={() => recorder.stop()}>
            Stop
          </Button>
        </Space>
      ) : null}

      {trimSource ? (
        <AudioTrimEditor
          source={trimSource.blob}
          sourcePreviewUrl={trimSource.previewUrl}
          disabled={uploadMutation.isPending}
          confirmLabel={uploadMutation.isPending ? 'Mengunggah…' : 'Terapkan & unggah'}
          onConfirm={(result) => void handleTrimConfirm(result)}
          onCancel={() => {
            clearPickedDraft();
            recorder.reset();
          }}
          onRerecord={() => {
            clearPickedDraft();
            void recorder.start();
          }}
        />
      ) : null}

      {!editing && recorder.state === 'idle' ? (
        <Space wrap>
          <Button
            type="primary"
            icon={<AudioOutlined />}
            onClick={() => void recorder.start()}
            disabled={!recorder.supported || uploadMutation.isPending}
          >
            {exampleId ? 'Rekam audio contoh' : 'Rekam'}
          </Button>
          <Upload
            accept=".mp3,.m4a,.wav,.ogg,.webm,audio/*"
            showUploadList={false}
            beforeUpload={beforeUpload}
            onChange={handleFileChange}
            disabled={uploadMutation.isPending}
          >
            <Button loading={uploadMutation.isPending}>Pilih file</Button>
          </Upload>
          {!recorder.supported ? (
            <Text type="secondary">Rekaman tidak didukung di browser ini — pakai pilih file.</Text>
          ) : null}
        </Space>
      ) : null}
    </Space>
  );
}

/** Draft audio di form create (belum ada wordId) — diunggah setelah kata tersimpan. */
export interface PendingPronunciationAudio {
  file: File;
  durationMs: number;
  speakerName?: string;
  dialectId?: string;
  previewUrl: string;
}

export interface PendingPronunciationAudioFieldProps {
  dialectOptions: { value: string; label: string }[];
  defaultDialectId?: string | null;
  value: PendingPronunciationAudio | null;
  onChange: (next: PendingPronunciationAudio | null) => void;
}

/**
 * Section rekam/pilih audio untuk create kata — potong dulu, simpan lokal sampai submit.
 */
export function PendingPronunciationAudioField({
  dialectOptions,
  defaultDialectId,
  value,
  onChange,
}: PendingPronunciationAudioFieldProps) {
  const { message } = AntdApp.useApp();
  const recorder = useAudioRecorder();
  const [speakerName, setSpeakerName] = useSessionSpeakerName(value?.speakerName);
  const [dialectId, setDialectId] = useState<string | undefined>(
    value?.dialectId ?? defaultDialectId ?? undefined,
  );
  const [pickedDraft, setPickedDraft] = useState<{
    blob: Blob;
    previewUrl: string;
  } | null>(null);
  const [syncedValue, setSyncedValue] = useState(value);

  // Sinkronkan field lokal saat parent mengganti `value` (tanpa effect).
  if (value !== syncedValue) {
    setSyncedValue(value);
    if (value) {
      if (value.speakerName) setSpeakerName(value.speakerName);
      setDialectId(value.dialectId ?? undefined);
    }
  }

  const clearPickedDraft = () => {
    if (pickedDraft?.previewUrl) URL.revokeObjectURL(pickedDraft.previewUrl);
    setPickedDraft(null);
  };

  const clearPending = () => {
    if (value?.previewUrl) URL.revokeObjectURL(value.previewUrl);
    onChange(null);
    clearPickedDraft();
    recorder.reset();
  };

  const commitTrimmed = (result: TrimAudioResult) => {
    const err = validatePronunciationAudioFile(result.file);
    if (err) {
      message.warning(err);
      return;
    }
    if (value?.previewUrl) URL.revokeObjectURL(value.previewUrl);
    const previewUrl = URL.createObjectURL(result.file);
    clearPickedDraft();
    recorder.reset();
    onChange({
      file: result.file,
      durationMs: result.durationMs,
      speakerName: speakerName.trim() || undefined,
      dialectId,
      previewUrl,
    });
  };

  const beforeUpload: UploadProps['beforeUpload'] = (file) => {
    const err = validatePronunciationAudioFile(file as File);
    if (err) {
      message.warning(err);
      return Upload.LIST_IGNORE;
    }
    return false;
  };

  const handleFileChange: UploadProps['onChange'] = (info) => {
    const raw = info.file.originFileObj ?? (info.file as unknown as File);
    if (!raw || !(raw instanceof File)) return;
    if (value?.previewUrl) URL.revokeObjectURL(value.previewUrl);
    onChange(null);
    clearPickedDraft();
    recorder.reset();
    setPickedDraft({ blob: raw, previewUrl: URL.createObjectURL(raw) });
  };

  const trimSource =
    !value &&
    (pickedDraft ??
      (recorder.state === 'preview' && recorder.blob && recorder.previewUrl
        ? { blob: recorder.blob, previewUrl: recorder.previewUrl }
        : null));

  return (
    <Space direction="vertical" size={8} style={{ width: '100%' }}>
      <Text type="secondary">
        Rekam atau pilih file, potong diam di awal/akhir, lalu simpan kata — audio diunggah
        otomatis setelah kata tersimpan (maks. {MAX_RECORDING_SECONDS} dtk / 5 MB).
      </Text>
      <Row gutter={8} wrap>
        <Col xs={24} md={10}>
          <Input
            placeholder="Nama penutur (opsional)"
            value={speakerName}
            onChange={(e) => {
              setSpeakerName(e.target.value);
              if (value) {
                onChange({ ...value, speakerName: e.target.value.trim() || undefined });
              }
            }}
            maxLength={255}
            allowClear
            disabled={recorder.state === 'recording'}
          />
        </Col>
        <Col xs={24} md={8}>
          <Select
            allowClear
            placeholder="Dialek (opsional)"
            options={dialectOptions}
            value={dialectId}
            onChange={(v) => {
              setDialectId(v);
              if (value) onChange({ ...value, dialectId: v });
            }}
            style={{ width: '100%' }}
            disabled={recorder.state === 'recording'}
          />
        </Col>
      </Row>

      {recorder.error ? <Alert type="warning" showIcon message={recorder.error} /> : null}

      {recorder.state === 'recording' ? (
        <Space wrap>
          <Tag color="red">Merekam {formatRecordingClock(recorder.elapsedMs)}</Tag>
          <Button danger icon={<StopOutlined />} onClick={() => recorder.stop()}>
            Stop
          </Button>
        </Space>
      ) : null}

      {value ? (
        <Space direction="vertical" size={8} style={{ width: '100%' }}>
          <audio
            controls
            src={value.previewUrl}
            preload="metadata"
            style={{ width: '100%', maxWidth: 420 }}
          />
          <Space wrap>
            <Tag color="green">
              Siap diunggah saat simpan ({formatRecordingClock(value.durationMs)})
            </Tag>
            <Button icon={<DeleteOutlined />} onClick={clearPending}>
              Buang
            </Button>
            <Button
              icon={<AudioOutlined />}
              onClick={() => {
                clearPending();
                void recorder.start();
              }}
            >
              Rekam ulang
            </Button>
          </Space>
        </Space>
      ) : null}

      {trimSource ? (
        <AudioTrimEditor
          source={trimSource.blob}
          sourcePreviewUrl={trimSource.previewUrl}
          confirmLabel="Pakai potongan ini"
          onConfirm={commitTrimmed}
          onCancel={() => {
            clearPickedDraft();
            recorder.reset();
          }}
          onRerecord={() => {
            clearPickedDraft();
            void recorder.start();
          }}
        />
      ) : null}

      {!value && !trimSource && recorder.state === 'idle' ? (
        <Space wrap>
          <Button
            type="primary"
            icon={<AudioOutlined />}
            onClick={() => void recorder.start()}
            disabled={!recorder.supported}
          >
            Rekam
          </Button>
          <Upload
            accept=".mp3,.m4a,.wav,.ogg,.webm,audio/*"
            showUploadList={false}
            beforeUpload={beforeUpload}
            onChange={handleFileChange}
          >
            <Button>Pilih file</Button>
          </Upload>
        </Space>
      ) : null}
    </Space>
  );
}

export interface WordLemmaAudiosSectionProps {
  wordId: string;
  lemma: string;
  audios: WordDetailAudio[];
  dialectLabel: (dialectId: string | null | undefined) => string;
  dialectOptions: { value: string; label: string }[];
  defaultDialectId?: string | null;
  onUploaded?: () => void;
}

/** Daftar audio lemma + form rekam/unggah (halaman detail & edit kata). */
export function WordLemmaAudiosSection({
  wordId,
  lemma,
  audios,
  dialectLabel,
  dialectOptions,
  defaultDialectId,
  onUploaded,
}: WordLemmaAudiosSectionProps) {
  const lemmaAudios = audios.filter((a) => !a.example_id);

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      {lemmaAudios.length ? (
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          {lemmaAudios.map((a) => (
            <WordAudioPlayerRow
              key={a.id}
              audio={a}
              parentLemma={lemma}
              dialectLabel={dialectLabel(a.dialect_id)}
            />
          ))}
        </Space>
      ) : (
        <Text type="secondary">Belum ada rekaman audio lemma.</Text>
      )}
      <Card size="small" title="Rekam / unggah audio pelafalan lemma">
        <PronunciationAudioUpload
          wordId={wordId}
          dialectOptions={dialectOptions}
          defaultDialectId={defaultDialectId}
          onUploaded={onUploaded}
        />
      </Card>
    </Space>
  );
}

export interface ExampleAudiosInlineProps {
  wordId: string;
  lemma: string;
  exampleId: string;
  audios: WordDetailAudio[];
  dialectLabel: (dialectId: string | null | undefined) => string;
  dialectOptions: { value: string; label: string }[];
  defaultDialectId?: string | null;
  onUploaded?: () => void;
}

/**
 * Audio + rekam untuk satu contoh kalimat (butuh example_id dari API).
 */
export function ExampleAudiosInline({
  wordId,
  lemma,
  exampleId,
  audios,
  dialectLabel,
  dialectOptions,
  defaultDialectId,
  onUploaded,
}: ExampleAudiosInlineProps) {
  const exampleAudios = audios.filter((a) => a.example_id === exampleId);

  return (
    <Card
      size="small"
      title="Rekam audio untuk contoh ini"
      style={{ marginTop: 10 }}
      styles={{ body: { paddingTop: 12 } }}
    >
      {exampleAudios.length ? (
        <Space direction="vertical" size={8} style={{ width: '100%', marginBottom: 12 }}>
          {exampleAudios.map((a) => (
            <WordAudioPlayerRow
              key={a.id}
              audio={a}
              parentLemma={lemma}
              dialectLabel={dialectLabel(a.dialect_id)}
              isExample
            />
          ))}
        </Space>
      ) : (
        <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
          Belum ada audio. Tekan <Text strong>Rekam audio contoh</Text> di bawah.
        </Text>
      )}
      <PronunciationAudioUpload
        wordId={wordId}
        exampleId={exampleId}
        dialectOptions={dialectOptions}
        defaultDialectId={defaultDialectId}
        onUploaded={onUploaded}
        compact
      />
    </Card>
  );
}

export interface WordExampleAudiosSectionProps {
  wordId: string;
  lemma: string;
  /** Daftar contoh dari detail (makna → examples), termasuk audio nested. */
  examples: {
    id: string;
    source_sentence: string;
    target_sentence?: string | null;
    audios?: WordDetailAudio[];
  }[];
  audios: WordDetailAudio[];
  dialectLabel: (dialectId: string | null | undefined) => string;
  dialectOptions: { value: string; label: string }[];
  defaultDialectId?: string | null;
  onUploaded?: () => void;
}

/**
 * Bagian khusus rekam audio SEMUA contoh kalimat (detail & edit).
 * Create tidak bisa: example_id belum ada sampai kata disimpan.
 */
export function WordExampleAudiosSection({
  wordId,
  lemma,
  examples,
  audios,
  dialectLabel,
  dialectOptions,
  defaultDialectId,
  onUploaded,
}: WordExampleAudiosSectionProps) {
  const pool = mergeAudiosForExamples(audios, examples);

  if (examples.length === 0) {
    return (
      <Alert
        type="info"
        showIcon
        message="Belum ada contoh kalimat"
        description="Tambah contoh di form Edit Kata (bagian Makna → Contoh Kalimat), simpan, lalu kembali ke sini untuk merekam audio per contoh."
      />
    );
  }

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Text type="secondary">
        Setiap contoh punya tombol rekam sendiri. Audio contoh berbeda dari audio lemma
        (pelafalan kata).
      </Text>
      {examples.map((e, index) => (
        <div key={e.id}>
          <Text strong style={{ display: 'block', marginBottom: 4 }}>
            Contoh {index + 1}
          </Text>
          <Text italic>“{e.source_sentence}”</Text>
          {e.target_sentence ? (
            <Text type="secondary"> — {e.target_sentence}</Text>
          ) : null}
          <ExampleAudiosInline
            wordId={wordId}
            lemma={lemma}
            exampleId={e.id}
            audios={pool}
            dialectLabel={dialectLabel}
            dialectOptions={dialectOptions}
            defaultDialectId={defaultDialectId}
            onUploaded={onUploaded}
          />
        </div>
      ))}
    </Space>
  );
}