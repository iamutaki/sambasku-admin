import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Space, Typography } from 'antd';
import { publicAudioUrlCandidates } from '@/shared/utils/public-audio-url';

const { Text, Link } = Typography;

export interface SafeAudioPlayerProps {
  url: string | null | undefined;
  /** Lebar maks player; default 420 */
  maxWidth?: number | string;
  style?: React.CSSProperties;
}

/**
 * `<audio controls>` dengan fallback URL + pesan jelas saat gagal load.
 * Native control abu-abu/tidak bisa diklik biasanya karena src 404 — tanpa
 * onError user mengira tombolnya rusak.
 */
export function SafeAudioPlayer({ url, maxWidth = 420, style }: SafeAudioPlayerProps) {
  const candidates = useMemo(() => publicAudioUrlCandidates(url), [url]);
  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState(candidates.length === 0);

  useEffect(() => {
    setIndex(0);
    setFailed(candidates.length === 0);
  }, [candidates]);

  const src = candidates[index] ?? '';

  if (!src || failed) {
    return (
      <Alert
        type="warning"
        showIcon
        message="Audio tidak dapat diputar"
        description={
          <Space direction="vertical" size={4}>
            <Text type="secondary">
              File tidak ditemukan di CDN (sering karena URL repo lama atau upload gagal).
            </Text>
            {url ? (
              <Link href={url} target="_blank" rel="noreferrer">
                Buka pranala tersimpan
              </Link>
            ) : (
              <Text type="secondary">URL audio kosong.</Text>
            )}
          </Space>
        }
      />
    );
  }

  return (
    <Space direction="vertical" size={6} style={{ width: '100%', maxWidth, ...style }}>
      <audio
        key={src}
        controls
        preload="metadata"
        src={src}
        style={{ width: '100%' }}
        onError={() => {
          if (index + 1 < candidates.length) {
            setIndex((i) => i + 1);
            return;
          }
          setFailed(true);
        }}
      />
      {index > 0 ? (
        <Text type="secondary" style={{ fontSize: 12 }}>
          Memakai URL cadangan (CDN repo baru).
        </Text>
      ) : null}
      <Button type="link" size="small" href={src} target="_blank" rel="noreferrer" style={{ padding: 0 }}>
        Buka di tab baru
      </Button>
    </Space>
  );
}
