import { useEffect, useMemo, useRef, useState } from 'react';
import { DeleteOutlined, PlusOutlined, SaveOutlined, SendOutlined } from '@ant-design/icons';
import {
  Alert,
  App as AntdApp,
  Button,
  Card,
  Collapse,
  Col,
  Flex,
  Form,
  Grid,
  Input,
  Popconfirm,
  Row,
  Select,
  Space,
  Tag,
  Typography,
  theme,
} from 'antd';
import { useNavigate, useParams } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/shared/components/page-header';
import { PageLoading } from '@/shared/components/page-loading';
import { ApiError } from '@/shared/api/error';
import { useAuth } from '@/shared/auth/use-auth';
import { fieldToNamePath, pickDefaultDialectId, pickDefaultLanguageIds } from '../application/create-word-utils';
import { buildUpdateWordBody, wordDetailToFormValues } from '../application/word-detail-mappers';
import { hasUploadingImages } from '../application/create-word-utils';
import { useUpdateWord } from '../application/use-update-word';
import { useWordDetail } from '../application/use-word-detail';
import { useCategoryOptions, useDialectOptions, useLanguageOptions, useWordClassOptions } from '../application/use-reference-data';
import type { CreateWordFormValues } from '../domain/create-word';
import { WORD_STATUS_LABELS } from '../domain/word';
import {
  MeaningFields,
  RelatedWordItem,
  WordExampleAudiosSection,
  WordLemmaAudiosSection,
  WordVariantsField,
  buildRelationOptions,
  buildWordClassOptions,
  wordTypeOptions,
} from './word-form-blocks';
import { WordImagesField } from './word-images-field';

const { Text } = Typography;

/**
 * Halaman Edit Kata - FULL REPLACE PUT /api/v1/admin/words/:id
 * (docs/admin/02-edit-kata.md + docs/api/05-api-edit-kata.md).
 * Memakai ulang seluruh blok form create-word (word-form-blocks.tsx) dan
 * prefill dari GET /admin/words/:id (semua status bisa dibuka).
 *
 * Perbedaan dari create:
 * - relasi HANYA bentuk link (allowInline=false) - Form B dilarang di edit
 * - published → draft = sengaja di-unpublish (konfirmasi)
 * - rejected → published = aktivasi ulang (konfirmasi)
 * - contributor dilarang (guard di router + tombol disembunyikan)
 */
export function EditWordPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { message } = AntdApp.useApp();
  const { user } = useAuth();
  const { token: { colorFillAlter } } = theme.useToken();
  const { md } = Grid.useBreakpoint();

  const { id } = useParams({ from: '/console-layout/words/$id/edit' });

  const [form] = Form.useForm<CreateWordFormValues>();
  const updateMutation = useUpdateWord();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const isContributor = user?.role === 'contributor';

  // Contributor dilarang (05-api-edit-kata.md): jangan bakar request prefill,
  // tampilkan 403 alih-alih halaman kosong.
  const detailQuery = useWordDetail(id, { enabled: !isContributor });
  const detail = detailQuery.data;

  const wordType = Form.useWatch('word_type', form) ?? 'word';

  const languageQuery = useLanguageOptions();
  const wordClassQuery = useWordClassOptions();
  const categoryQuery = useCategoryOptions();

  const languages = useMemo(() => languageQuery.data ?? [], [languageQuery.data]);
  const defaultLanguageIds = useMemo(() => pickDefaultLanguageIds(languages), [languages]);

  // Dialek di-preload pakai bahasa SUMBER default (Sambas). Kata yang sedang
  // diedit biasanya memang bahasa Sambas; bila detail membawa bahasa lain,
  // opsi dialek dihitung dari bahasa lead itu - cukup pendekatan best-effort,
  // Select tetap menampilkan nilai terpilih bahkan sebelum opsi tersedia.
  const leadLanguageId = useMemo(
    () => detail?.language_id ?? defaultLanguageIds.sourceId,
    [detail, defaultLanguageIds.sourceId],
  );
  const dialectQuery = useDialectOptions(leadLanguageId);

  // Prefill form SATU KALI dari detail yang sudah SETTLE. Jangan prefill saat
  // masih isPending (belum ada data) ATAU isFetching (refetch di latar belakang
  // sedang berjalan, mis. cache lama ada): kalau prefill dari cache yang sudah
  // usang, seeded=true mengunci form ke nilai pra-edit sebelum data baru tiba.
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current || detailQuery.isPending || detailQuery.isFetching) return;
    seeded.current = true;
    if (detail) {
      form.setFieldsValue(wordDetailToFormValues(detail));
    }
  }, [detail, detailQuery.isPending, detailQuery.isFetching, form]);

  // Kata lama tanpa dialect_id → isi default (umum); jangan overwrite nilai yang sudah ada.
  useEffect(() => {
    if (!seeded.current || !dialectQuery.data?.length) return;
    const current = form.getFieldValue('dialect_id') as string | undefined | null;
    if (current) return;
    const defaultId = pickDefaultDialectId(dialectQuery.data);
    if (defaultId) form.setFieldsValue({ dialect_id: defaultId });
  }, [dialectQuery.data, form, detail]);

  const currentStatus = detail?.status;

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

  const dialectOptions = useMemo(
    () => (dialectQuery.data ?? []).map((d) => ({ value: d.id, label: d.name })),
    [dialectQuery.data],
  );

  const dialectName = (dialectId: string | null | undefined) => {
    if (!dialectId) return '-';
    return dialectOptions.find((d) => d.value === dialectId)?.label ?? dialectId;
  };

  const defaultDialectId = useMemo(
    () =>
      (form.getFieldValue('dialect_id') as string | undefined) ??
      pickDefaultDialectId(dialectQuery.data ?? []) ??
      null,
    [dialectQuery.data, form, detail],
  );

  const refreshAudios = () => {
    void queryClient.invalidateQueries({ queryKey: ['words', 'detail', id] });
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

  const submit = async (status: 'draft' | 'published') => {
    setSubmitError(null);
    try {
      await form.validateFields();
      // `images` di-set via setFieldsValue tanpa Form.Item name (kelola
      // manual di WordImagesField) - validateFields() menyaringnya keluar,
      // jadi ambil nilai dari full store.
      const values = form.getFieldsValue(true) as CreateWordFormValues;
      if (hasUploadingImages(values.images)) {
        message.warning('Masih ada gambar yang terunggah - tunggu selesai lalu simpan lagi.');
        return;
      }
      await updateMutation.mutateAsync(
        { id, body: buildUpdateWordBody(values, status) },
        {
          onSuccess: (result) => {
            // Toast JUJUR soal perubahan status (approval gate + UI semantics):
            // rejected → published = hidup lagi; published → draft = di-unpublish.
            const reactivated = currentStatus === 'rejected' && result.status === 'published';
            const unPublished = currentStatus === 'published' && result.status === 'draft';
            const messages: Record<string, string> = {
              draft: unPublished
                ? `Kata "${result.lemma}" di-unpublish (tidak lagi di kamus publik)`
                : `Perubahan "${result.lemma}" disimpan (${WORD_STATUS_LABELS[result.status] ?? result.status})`,
              published: reactivated
                ? `Kata yang ditolak "${result.lemma}" diaktifkan kembali dan ditayangkan`
                : `Kata "${result.lemma}" berhasil dipublikasikan`,
            };
            message.success(messages[result.status] ?? `Kata "${result.lemma}" disimpan`);
            result.warnings?.forEach((w) => message.warning(w.message));
            navigate({ to: '/words' });
          },
          onError: handleSubmitError,
        },
      );
    } catch {
      // Validasi form gagal - error inline antd sudah tampil, tidak ada aksi.
    }
  };

  // 403 alih-alih halaman kosong saat contributor menebak URL route edit.
  if (isContributor) {
    return (
      <>
        <PageHeader title="Edit Kata" subtitle="Akses terbatas untuk verifikator." />
        <Alert
          type="error"
          showIcon
          message="403 - Akses ditolak"
          description="Kontributor tidak dapat mengubah entri existing. Perubahan atas entri yang sudah ada lewat jalur kontribusi (antrean review)."
          action={
            <Button onClick={() => navigate({ to: '/words' })} style={{ whiteSpace: 'nowrap' }}>
              Kembali ke Daftar
            </Button>
          }
        />
      </>
    );
  }

  if (detailQuery.isPending) {
    return <PageLoading tip="Memuat detail kata…" />;
  }

  if (detailQuery.isError || !detail) {
    return (
      <>
        <PageHeader title="Edit Kata" subtitle="Gagal memuat detail kata." />
        <Alert
          type="error"
          showIcon
          message="Tidak dapat membuka kata ini"
          description={detailQuery.error?.message ?? 'Kata tidak ditemukan atau akses ditolak.'}
          action={
            <Button onClick={() => navigate({ to: '/words' })} style={{ whiteSpace: 'nowrap' }}>
              Kembali ke Daftar
            </Button>
          }
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Edit Kata"
        subtitle={
          <Space wrap>
            <Text>Form kosakata lengkap - kata, makna, terjemahan, contoh, dan relasi.</Text>
            <Tag color={currentStatus === 'published' ? 'green' : currentStatus === 'rejected' ? 'red' : currentStatus === 'pending_review' ? 'orange' : 'default'}>
              {WORD_STATUS_LABELS[currentStatus ?? 'draft']}
            </Tag>
            {currentStatus === 'published' ? (
              <Text type="secondary">Simpan sebagai Draft akan menghapus kata dari tayang.</Text>
            ) : null}
            {currentStatus === 'rejected' ? (
              <Text type="secondary">Kata ditolak - "Simpan & Publikasikan" akan menayangkan ulang.</Text>
            ) : null}
          </Space>
        }
      />
      <Form form={form} layout="vertical" requiredMark disabled={updateMutation.isPending}>
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
                      Edit hanya menautkan ke kata yang sudah ada - buat kata sinonim/antonim baru lewat
                      "Tambah Kata", lalu tautkan di sini.
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
                              allowInline={false}
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
                label: '6. Pengucapan & Audio (opsional)',
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
                          <Input placeholder="/makatn/" />
                        </Form.Item>
                      </Col>
                    </Row>
                    <div>
                      <Text strong style={{ display: 'block', marginBottom: 8 }}>
                        Audio pelafalan lemma (kata)
                      </Text>
                      <WordLemmaAudiosSection
                        wordId={id}
                        lemma={detail?.lemma ?? ''}
                        audios={detail?.audios ?? []}
                        dialectLabel={dialectName}
                        dialectOptions={dialectOptions}
                        defaultDialectId={defaultDialectId}
                        onUploaded={refreshAudios}
                      />
                    </div>
                    <div>
                      <Text strong style={{ display: 'block', marginBottom: 8 }}>
                        Audio pelafalan contoh kalimat
                      </Text>
                      <WordExampleAudiosSection
                        wordId={id}
                        lemma={detail?.lemma ?? ''}
                        examples={(detail?.meanings ?? []).flatMap((m) =>
                          m.examples.map((e) => ({
                            id: e.id,
                            source_sentence: e.source_sentence,
                            target_sentence: e.target_sentence,
                            audios: e.audios,
                          })),
                        )}
                        audios={detail?.audios ?? []}
                        dialectLabel={dialectName}
                        dialectOptions={dialectOptions}
                        defaultDialectId={defaultDialectId}
                        onUploaded={refreshAudios}
                      />
                    </div>
                  </Space>
                ),
              },
              {
                key: 'images',
                label: '7. Gambar (opsional)',
                children: <WordImagesField />,
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
          {currentStatus === 'published' ? (
            <Text type="warning">"Simpan sebagai Draft" menurunkan status menjadi draft (tidak tayang).</Text>
          ) : null}
        </div>
        <Space wrap style={{ width: md ? undefined : '100%' }}>
          <Button block={!md} onClick={() => navigate({ to: '/words' })}>
            Batal
          </Button>
          {currentStatus === 'published' ? (
            <Popconfirm
              title="Hapus kata dari tayang?"
              description="Menyimpan sebagai draft akan menurunkan status kata ini dan menghilangkannya dari kamus publik."
              okText="Hapus dari Tayang"
              cancelText="Batal"
              okButtonProps={{ danger: true }}
              onConfirm={() => submit('draft')}
            >
              <Button block={!md} icon={<SaveOutlined />} loading={updateMutation.isPending}>
                Simpan sebagai Draft
              </Button>
            </Popconfirm>
          ) : (
            <Button block={!md} icon={<SaveOutlined />} loading={updateMutation.isPending} onClick={() => submit('draft')}>
              Simpan sebagai Draft
            </Button>
          )}
          {currentStatus === 'rejected' ? (
            <Popconfirm
              title="Aktifkan kata ini?"
              description="Kata yang ditolak akan dihidupkan kembali dan tayang di kamus publik."
              okText="Aktifkan"
              cancelText="Batal"
              onConfirm={() => submit('published')}
            >
              <Button block={!md} type="primary" icon={<SendOutlined />} loading={updateMutation.isPending}>
                Simpan &amp; Publikasikan
              </Button>
            </Popconfirm>
          ) : (
            <Button block={!md} type="primary" icon={<SendOutlined />} loading={updateMutation.isPending} onClick={() => submit('published')}>
              Simpan &amp; Publikasikan
            </Button>
          )}
        </Space>
      </Flex>
    </>
  );
}