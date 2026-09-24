import { useEffect, useRef, useState } from 'react';
import {
  CheckCircleOutlined,
  CloseOutlined,
  FileImageOutlined,
  InboxOutlined,
  LoadingOutlined,
  PlusOutlined,
  GlobalOutlined,
  RedoOutlined,
} from '@ant-design/icons';
import { Alert, App as AntdApp, Button, Image, Input, Progress, Space, Switch, Tag, Typography, Upload } from 'antd';
import type { UploadProps } from 'antd';
import type { WordImageFormValue } from '../domain/create-word';
import { useUploadWordImage } from '../application/use-upload-word-image';
import { displayImageUrl } from '@/shared/utils/display-image-url';
import { MediaExplorerModal } from './media-explorer-modal';
import type { ShareBackgroundItem } from '../infrastructure/share-backgrounds-api';
import { STOCK_PROVIDER_LABELS } from '../infrastructure/share-backgrounds-api';

const { Text } = Typography;

const MAX_IMAGES = 10; // cermin validator API (images[] max 10)
const MAX_SIZE_MB = 5;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export interface WordImagesFieldProps {
  /** Controlled by Form.Item name="images" */
  value?: WordImageFormValue[];
  onChange?: (next: WordImageFormValue[]) => void;
}

/**
 * Section "7. Gambar (opsional)" untuk form tambah & edit kata.
 * Preview pakai state lokal (langsung re-render saat file dipilih).
 * Upload dijalankan manual dari beforeUpload (return false) — lebih andal
 * daripada customRequest untuk daftar controlled.
 * Media Explorer: URL stock eksternal tanpa upload.
 */
export function WordImagesField({ value, onChange }: WordImagesFieldProps) {
  const [images, setLocalImages] = useState<WordImageFormValue[]>(() => value ?? []);
  // Keep latest list for async upload handlers without reading/writing refs during render
  // (react-hooks/refs). Updated only in setImages + the controlled-value effect below.
  const imagesRef = useRef(value ?? []);
  const [explorerOpen, setExplorerOpen] = useState(false);
  useEffect(() => {
    if (value === undefined) return;
    if (value === imagesRef.current) return;
    if (sameImageList(value, imagesRef.current)) return;
    imagesRef.current = value;
    setLocalImages(value);
  }, [value]);

  const { upload, unavailable } = useUploadWordImage();
  const { message } = AntdApp.useApp();
  const fileByUid = useRef(new Map<string, File>());

  const setImages = (next: WordImageFormValue[]) => {
    imagesRef.current = next;
    setLocalImages(next);
    onChange?.(next);
  };

  const patch = (uid: string, changes: Partial<WordImageFormValue>) =>
    setImages(imagesRef.current.map((img) => (img.uid === uid ? { ...img, ...changes } : img)));

  const setPrimary = (uid: string, primary: boolean) =>
    setImages(
      imagesRef.current.map((img) =>
        img.uid === uid ? { ...img, is_primary: primary } : { ...img, is_primary: false },
      ),
    );

  const remove = (uid: string) => {
    const img = imagesRef.current.find((i) => i.uid === uid);
    if (img?.localUrl) URL.revokeObjectURL(img.localUrl);
    fileByUid.current.delete(uid);
    setImages(imagesRef.current.filter((img) => img.uid !== uid));
  };

  const addStockImage = (item: ShareBackgroundItem) => {
    if (imagesRef.current.length >= MAX_IMAGES) {
      message.warning(`Maksimal ${MAX_IMAGES} gambar per kata`);
      return;
    }
    const photographer =
      item.photographer.trim() ||
      STOCK_PROVIDER_LABELS[item.provider] ||
      item.provider;
    const uid = `stock-${item.provider}-${item.id}-${imagesRef.current.length}`;
    const isPrimary = imagesRef.current.length === 0;
    setImages([
      ...imagesRef.current,
      {
        uid,
        fileName: `${photographer} · ${item.provider}`,
        status: 'done',
        url: item.url,
        provider: item.provider,
        provider_file_id: item.id,
        alt_text: `Foto: ${photographer} / ${item.provider}`,
        is_primary: isPrimary,
      },
    ]);
  };

  const startUpload = async (file: File, uid: string) => {
    fileByUid.current.set(uid, file);
    const localUrl = URL.createObjectURL(file);

    // Preview SEGERA — sebelum jaringan.
    setImages([
      ...imagesRef.current,
      { uid, fileName: file.name, status: 'uploading', localUrl, progress: 0 },
    ]);

    try {
      const uploaded = await upload(file, (percent) => patch(uid, { progress: percent }));
      const oldLocal = imagesRef.current.find((i) => i.uid === uid)?.localUrl;
      patch(uid, {
        status: 'done',
        url: uploaded.url,
        provider_file_id: uploaded.file_id,
        sha: uploaded.sha,
        localUrl: undefined,
      });
      if (oldLocal) queueMicrotask(() => URL.revokeObjectURL(oldLocal));
    } catch {
      patch(uid, { status: 'error' });
      message.error(`Gagal mengunggah ${file.name}`);
    }
  };

  /**
   * Tangkap file di sini, tampilkan preview, upload sendiri.
   * `return false` mencegah Upload Ant Design mengirim XHR default /
   * mengandalkan customRequest (yang sering tidak memicu update UI).
   */
  const beforeUpload: UploadProps['beforeUpload'] = (file) => {
    const typed = file as File & { uid?: string };
    if (!ACCEPTED_TYPES.includes(typed.type)) {
      message.warning(`${typed.name}: hanya jpg/png/webp yang didukung`);
      return Upload.LIST_IGNORE;
    }
    if (typed.size > MAX_SIZE_MB * 1024 * 1024) {
      message.warning(`${typed.name}: melebihi ${MAX_SIZE_MB}MB`);
      return Upload.LIST_IGNORE;
    }
    if (imagesRef.current.length >= MAX_IMAGES) {
      message.warning(`Maksimal ${MAX_IMAGES} gambar per kata`);
      return Upload.LIST_IGNORE;
    }

    // Prefer Ant Design's RcFile.uid; fall back to pure File fields (no Date.now/Math.random —
    // those trip react-hooks/purity even inside this event callback under eslint-plugin-react-hooks).
    const uid =
      typed.uid ?? `f-${typed.name}-${typed.size}-${typed.lastModified}-${imagesRef.current.length}`;
    void startUpload(typed, uid);
    return false;
  };

  const retry = async (img: WordImageFormValue) => {
    const file = fileByUid.current.get(img.uid);
    if (!file) {
      message.info('File tidak tersedia lagi - hapus baris ini lalu pilih ulang filenya');
      return;
    }
    patch(img.uid, { status: 'uploading', progress: 0 });
    try {
      const uploaded = await upload(file, (percent) => patch(img.uid, { progress: percent }));
      const oldLocal = imagesRef.current.find((i) => i.uid === img.uid)?.localUrl;
      patch(img.uid, {
        status: 'done',
        url: uploaded.url,
        provider_file_id: uploaded.file_id,
        sha: uploaded.sha,
        localUrl: undefined,
      });
      if (oldLocal) queueMicrotask(() => URL.revokeObjectURL(oldLocal));
    } catch {
      patch(img.uid, { status: 'error' });
      message.error(`Gagal mengunggah ${file.name}`);
    }
  };

  const atLimit = images.length >= MAX_IMAGES;
  const uploadingCount = images.filter((i) => i.status === 'uploading').length;

  const selectedPanel =
    images.length > 0 ? (
      <div
        style={{
          border: '1px solid rgba(0,0,0,0.1)',
          borderRadius: 8,
          padding: 12,
          background: 'rgba(22, 119, 255, 0.04)',
        }}
      >
        <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 12 }} wrap>
          <Space size={8} wrap>
            <Text strong>{images.length} gambar dipilih</Text>
            {uploadingCount > 0 ? (
              <Tag icon={<LoadingOutlined />} color="processing">
                {uploadingCount} sedang diunggah
              </Tag>
            ) : images.some((i) => i.status === 'error') ? (
              <Tag color="error">Sebagian gagal</Tag>
            ) : (
              <Tag icon={<CheckCircleOutlined />} color="success">
                Siap disimpan
              </Tag>
            )}
          </Space>
          <Text type="secondary">
            {images.length}/{MAX_IMAGES}
          </Text>
        </Space>

        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          {images.map((img) => (
            <div
              key={img.uid}
              style={{
                display: 'flex',
                gap: 12,
                alignItems: 'flex-start',
                flexWrap: 'wrap',
                padding: 10,
                borderRadius: 8,
                background: '#fff',
                border: '1px solid rgba(0,0,0,0.06)',
              }}
            >
              <ImageThumb img={img} onRemove={() => remove(img.uid)} />

              <div style={{ minWidth: 220, flex: 1 }}>
                <Text strong ellipsis style={{ display: 'block', maxWidth: 360 }}>
                  {img.fileName ?? img.url}
                </Text>
                {img.provider ? (
                  <Tag style={{ marginTop: 4 }}>{img.provider}</Tag>
                ) : null}
                {img.status === 'uploading' ? (
                  <Progress
                    percent={img.progress ?? 0}
                    size="small"
                    status="active"
                    style={{ maxWidth: 320, margin: '4px 0 0' }}
                  />
                ) : null}
                {img.status === 'error' ? (
                  <Space style={{ marginTop: 4 }}>
                    <Text type="danger">Gagal mengunggah</Text>
                    <Button size="small" icon={<RedoOutlined />} onClick={() => retry(img)}>
                      Ulangi
                    </Button>
                  </Space>
                ) : null}
                {img.status === 'done' ? (
                  <Space direction="vertical" size={4} style={{ width: '100%', marginTop: 6 }}>
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
            </div>
          ))}
        </Space>
      </div>
    ) : null;

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <Text type="secondary" style={{ display: 'block' }}>
        Maksimal {MAX_IMAGES} gambar (jpg/png/webp, maks {MAX_SIZE_MB}MB) atau dari Media
        Explorer. Unggah terjadi saat file dipilih; teks alternatif &amp; penanda utama diisi
        setelah selesai.
      </Text>

      {unavailable ? (
        <Alert
          type="warning"
          showIcon
          message="Penyimpanan gambar belum dikonfigurasi"
          description="Isi PUBLIC_IMAGE_GITHUB_* di environment API untuk mengaktifkan upload file. Media Explorer (URL stock) tetap bisa dipakai. Kata tetap bisa disimpan tanpa gambar."
        />
      ) : null}

      {selectedPanel}

      {!atLimit ? (
        <Button icon={<GlobalOutlined />} onClick={() => setExplorerOpen(true)}>
          Pilih dari Media Explorer
        </Button>
      ) : null}

      {!unavailable && !atLimit ? (
        <Upload.Dragger
          multiple
          showUploadList={false}
          accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
          beforeUpload={beforeUpload}
        >
          {images.length === 0 ? (
            <>
              <p className="ant-upload-drag-icon"><InboxOutlined /></p>
              <p className="ant-upload-text">Klik atau seret gambar ke sini</p>
              <p className="ant-upload-hint">Gambar ilustrasi untuk entri kata ini</p>
            </>
          ) : (
            <>
              <p className="ant-upload-drag-icon"><PlusOutlined /></p>
              <p className="ant-upload-text">Tambah gambar lagi</p>
              <p className="ant-upload-hint">
                {images.length} sudah dipilih — sisa kuota {MAX_IMAGES - images.length}
              </p>
            </>
          )}
        </Upload.Dragger>
      ) : null}

      {!unavailable && atLimit ? (
        <Alert
          type="info"
          showIcon
          message={`Batas ${MAX_IMAGES} gambar tercapai. Hapus salah satu untuk menambah yang baru.`}
        />
      ) : null}

      <MediaExplorerModal
        open={explorerOpen}
        onClose={() => setExplorerOpen(false)}
        onSelect={addStockImage}
      />
    </Space>
  );
}

function ImageThumb({
  img,
  onRemove,
}: {
  img: WordImageFormValue;
  onRemove: () => void;
}) {
  const size = 88;
  const src = thumbSrc(img);
  const uploading = img.status === 'uploading';
  const errored = img.status === 'error';

  return (
    <div
      style={{
        position: 'relative',
        width: size,
        height: size,
        borderRadius: 8,
        overflow: 'hidden',
        background: 'rgba(0,0,0,0.06)',
        border: errored
          ? '1px solid #ff4d4f'
          : img.is_primary
            ? '2px solid #1677ff'
            : '1px solid rgba(0,0,0,0.08)',
        flexShrink: 0,
      }}
    >
      {src ? (
        <Image
          src={src}
          alt={img.alt_text ?? img.fileName}
          width={size}
          height={size}
          preview={Boolean(img.url)}
          style={{ objectFit: 'cover', opacity: uploading ? 0.55 : 1 }}
          fallback={img.url}
        />
      ) : (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {errored ? (
            <FileImageOutlined style={{ fontSize: 22, opacity: 0.4 }} />
          ) : (
            <LoadingOutlined style={{ fontSize: 22 }} />
          )}
        </div>
      )}

      {uploading ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(255,255,255,0.45)',
          }}
        >
          <LoadingOutlined style={{ fontSize: 20 }} />
        </div>
      ) : null}

      {img.is_primary && img.status === 'done' ? (
        <Tag
          color="blue"
          style={{ position: 'absolute', left: 4, bottom: 4, margin: 0, lineHeight: '18px', paddingInline: 4 }}
        >
          Utama
        </Tag>
      ) : null}

      <Button
        type="primary"
        danger
        size="small"
        icon={<CloseOutlined />}
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        aria-label={`Hapus ${img.fileName ?? 'gambar'}`}
        style={{
          position: 'absolute',
          top: 4,
          right: 4,
          width: 22,
          height: 22,
          minWidth: 22,
          padding: 0,
          borderRadius: '50%',
        }}
      />
    </div>
  );
}

function thumbSrc(img: WordImageFormValue): string | undefined {
  if (img.localUrl) return img.localUrl;
  if (img.url) return displayImageUrl(img.url, { width: 200 }) ?? img.url;
  return undefined;
}

function sameImageList(a: WordImageFormValue[], b: WordImageFormValue[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((img, i) => {
    const other = b[i];
    return (
      img.uid === other?.uid &&
      img.status === other.status &&
      img.url === other.url &&
      img.provider === other.provider &&
      img.localUrl === other.localUrl &&
      img.progress === other.progress &&
      img.alt_text === other.alt_text &&
      img.is_primary === other.is_primary
    );
  });
}
