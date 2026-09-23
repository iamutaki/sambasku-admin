import { useRef } from 'react';
import { FileImageOutlined, InboxOutlined, LoadingOutlined, RedoOutlined } from '@ant-design/icons';
import { Alert, App as AntdApp, Button, Card, Image, Input, Progress, Space, Switch, Typography, Upload } from 'antd';
import type { UploadFile, UploadProps } from 'antd';
import { Form } from 'antd';
import type { WordImageFormValue } from '../domain/create-word';
import { useUploadWordImage } from '../application/use-upload-word-image';
import { displayImageUrl } from '@/shared/utils/display-image-url';

const { Text } = Typography;

const MAX_IMAGES = 10; // cermin validator API (images[] max 10)
const MAX_SIZE_MB = 5;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Section "7. Gambar (opsional)" untuk form tambah & edit kata
 * (05-support-image). Daftar gambar hidup di form store (field `images`)
 * - sumber kebenaran untuk prefill edit dan body submit. Upload terjadi
 * saat file dipilih: token backend → POST langsung ke CDN ImageKit.
 * Menghapus dari daftar TIDAK menghapus file di CDN (orphan diterima -
 * bersih manual dari dashboard ImageKit; tidak ada delete API ter-wire).
 */
export function WordImagesField() {
  const form = Form.useFormInstance();
  const images: WordImageFormValue[] = Form.useWatch('images', form) ?? [];
  const { upload, unavailable } = useUploadWordImage();
  const { message } = AntdApp.useApp();
  // File asli dipinggirkan agar tombol Ulangi bisa upload ulang (tidak
  // disimpan di form store - File bukan data serializable).
  const fileByUid = useRef(new Map<string, File>());

  const setImages = (next: WordImageFormValue[]) => form.setFieldsValue({ images: next });

  const patch = (uid: string, changes: Partial<WordImageFormValue>) =>
    setImages(images.map((img) => (img.uid === uid ? { ...img, ...changes } : img)));

  /** EKSKLUSIF client-side - cermin superRefine API (400 kalau >1 dikirim). */
  const setPrimary = (uid: string, value: boolean) =>
    setImages(images.map((img) => (img.uid === uid ? { ...img, is_primary: value } : { ...img, is_primary: false })));

  const remove = (uid: string) => {
    const img = images.find((i) => i.uid === uid);
    if (img?.localUrl) URL.revokeObjectURL(img.localUrl);
    fileByUid.current.delete(uid);
    setImages(images.filter((img) => img.uid !== uid));
  };

  const beforeUpload: UploadProps['beforeUpload'] = (file: UploadFile) => {
    const typed = file as unknown as File;
    if (!ACCEPTED_TYPES.includes(typed.type)) {
      message.warning(`${typed.name}: hanya jpg/png/webp yang didukung`);
      return Upload.LIST_IGNORE;
    }
    if (typed.size > MAX_SIZE_MB * 1024 * 1024) {
      message.warning(`${typed.name}: melebihi ${MAX_SIZE_MB}MB`);
      return Upload.LIST_IGNORE;
    }
    if (images.length >= MAX_IMAGES) {
      message.warning(`Maksimal ${MAX_IMAGES} gambar per kata`);
      return Upload.LIST_IGNORE;
    }
    return true;
  };

  const customRequest: UploadProps['customRequest'] = async ({ file, onSuccess, onError }) => {
    const raw = file as File & { uid: string };
    fileByUid.current.set(raw.uid, raw);
    // Preview instan dari file lokal (blob URL) - user langsung lihat
    // gambar yang dipilih tanpa menunggu byte terkirim ke CDN.
    const localUrl = URL.createObjectURL(raw);
    setImages([...images, { uid: raw.uid, fileName: raw.name, status: 'uploading', localUrl, progress: 0 }]);
    try {
      const uploaded = await upload(raw, (percent) => patchFresh(raw.uid, form, { progress: percent }));
      // images di closure bisa basi kalau dua file selesai berdekatan -
      // patch by-uid dari nilai form TERKINI.
      patchFresh(raw.uid, form, {
        status: 'done',
        url: uploaded.url,
        provider_file_id: uploaded.file_id,
        sha: uploaded.sha,
      });
      URL.revokeObjectURL(localUrl); // preview CDN (img.url) sudah menggantikan
      onSuccess?.(uploaded);
    } catch (err) {
      patchFresh(raw.uid, form, { status: 'error' });
      message.error(`Gagal mengunggah ${raw.name}`);
      onError?.(err as Error);
    }
  };

  const retry = async (img: WordImageFormValue) => {
    const file = fileByUid.current.get(img.uid);
    if (!file) {
      message.info('File tidak tersedia lagi - hapus baris ini lalu pilih ulang filenya');
      return;
    }
    patchFresh(img.uid, form, { status: 'uploading', progress: 0 });
    try {
      const uploaded = await upload(file, (percent) => patchFresh(img.uid, form, { progress: percent }));
      patchFresh(img.uid, form, {
        status: 'done',
        url: uploaded.url,
        provider_file_id: uploaded.file_id,
        sha: uploaded.sha,
      });
      if (img.localUrl) URL.revokeObjectURL(img.localUrl);
    } catch {
      patchFresh(img.uid, form, { status: 'error' });
      message.error(`Gagal mengunggah ${file.name}`);
    }
  };

  if (unavailable) {
    return (
      <Alert
        type="warning"
        showIcon
        message="Penyimpanan gambar belum dikonfigurasi"
        description="Isi PUBLIC_IMAGE_GITHUB_* di environment API untuk mengaktifkan upload gambar. Kata tetap bisa disimpan tanpa gambar."
      />
    );
  }

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <Text type="secondary" style={{ display: 'block' }}>
        Maksimal {MAX_IMAGES} gambar (jpg/png/webp, maks {MAX_SIZE_MB}MB). Unggah terjadi
        saat file dipilih; teks alternatif &amp; penanda utama diisi setelah selesai.
      </Text>

      <Upload.Dragger
        multiple
        showUploadList={false}
        accept=".jpg,.jpeg,.png,.webp"
        beforeUpload={beforeUpload}
        customRequest={customRequest}
        disabled={images.length >= MAX_IMAGES}
      >
        <p className="ant-upload-drag-icon"><InboxOutlined /></p>
        <p className="ant-upload-text">Klik atau seret gambar ke sini</p>
        <p className="ant-upload-hint">Gambar ilustrasi untuk entri kata ini</p>
      </Upload.Dragger>

      {images.map((img) => (
        <Card key={img.uid} size="small">
          <Space align="start" wrap>
            {img.url ? (
              <Image
                src={displayImageUrl(img.url, { width: 160 }) ?? img.url}
                alt={img.alt_text ?? img.fileName}
                width={72}
                height={72}
                style={{ objectFit: 'cover' }}
                fallback={img.url}
              />
            ) : img.localUrl ? (
              <Image
                src={img.localUrl}
                alt={img.fileName}
                width={72}
                height={72}
                preview={false}
                style={{ objectFit: 'cover', opacity: img.status === 'uploading' ? 0.55 : 1 }}
              />
            ) : (
              <div
                style={{
                  width: 72,
                  height: 72,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(0,0,0,0.04)',
                  borderRadius: 8,
                }}
              >
                {img.status === 'error' ? <FileImageOutlined style={{ fontSize: 22, opacity: 0.4 }} /> : <LoadingOutlined style={{ fontSize: 22 }} />}
              </div>
            )}

            <div style={{ minWidth: 260, flex: 1 }}>
              <Text strong ellipsis style={{ display: 'block', maxWidth: 360 }}>
                {img.fileName ?? img.url}
              </Text>
              {img.status === 'uploading' ? (
                <Progress percent={img.progress ?? 0} size="small" status="active" style={{ maxWidth: 320, margin: 0 }} />
              ) : null}
              {img.status === 'error' ? (
                <Space>
                  <Text type="danger">Gagal mengunggah</Text>
                  <Button size="small" icon={<RedoOutlined />} onClick={() => retry(img)}>Ulangi</Button>
                </Space>
              ) : null}
              {img.status === 'done' ? (
                <Space direction="vertical" size={4} style={{ width: '100%', marginTop: 4 }}>
                  <Input
                    placeholder="Teks alternatif / deskripsi singkat (opsional)"
                    value={img.alt_text}
                    maxLength={500}
                    onChange={(e) => patch(img.uid, { alt_text: e.target.value })}
                  />
                  <Space>
                    <Switch
                      size="small"
                      checkedChildren="Utama"
                      unCheckedChildren="Utama"
                      checked={img.is_primary ?? false}
                      onChange={(v) => setPrimary(img.uid, v)}
                    />
                    <Text type="secondary">Hanya satu gambar utama per kata</Text>
                  </Space>
                </Space>
              ) : null}
            </div>

            <Button type="text" danger onClick={() => remove(img.uid)}>
              Hapus
            </Button>
          </Space>
        </Card>
      ))}
    </Space>
  );
}

/** patch by-uid membaca nilai form TERKINI (bukan closure yang bisa basi). */
function patchFresh(
  uid: string,
  form: ReturnType<typeof Form.useFormInstance>,
  changes: Partial<WordImageFormValue>,
) {
  const current = (form.getFieldValue('images') as WordImageFormValue[] | undefined) ?? [];
  form.setFieldsValue({
    images: current.map((img) => (img.uid === uid ? { ...img, ...changes } : img)),
  });
}
