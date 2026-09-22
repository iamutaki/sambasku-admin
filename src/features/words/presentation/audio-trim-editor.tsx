import { useEffect, useRef, useState } from 'react';
import { AudioOutlined, PauseCircleOutlined, PlayCircleOutlined, ScissorOutlined } from '@ant-design/icons';
import { Alert, Button, Flex, Slider, Space, Spin, Typography } from 'antd';
import {
  decodeAudioBlob,
  detectSpeechBounds,
  extractWaveformPeaks,
  trimAudioBlob,
  type TrimAudioResult,
} from '../application/trim-audio';
import { formatRecordingClock } from '../application/use-audio-recorder';

const { Text } = Typography;

export interface AudioTrimEditorProps {
  /** Blob rekaman / file asli. */
  source: Blob;
  sourcePreviewUrl?: string | null;
  disabled?: boolean;
  confirmLabel?: string;
  onConfirm: (result: TrimAudioResult) => void;
  onCancel: () => void;
  onRerecord?: () => void;
}

/**
 * Preview + potong diam di awal/akhir sebelum upload.
 * Player menampilkan HASIL POTONGAN (bukan file penuh); tombol Preview
 * memutar cuplikan dari buffer agar seeking WebM tidak bermasalah.
 */
export function AudioTrimEditor({
  source,
  sourcePreviewUrl,
  disabled = false,
  confirmLabel = 'Terapkan & unggah',
  onConfirm,
  onCancel,
  onRerecord,
}: AudioTrimEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fullAudioRef = useRef<HTMLAudioElement>(null);
  const clipAudioRef = useRef<HTMLAudioElement>(null);
  const playCtxRef = useRef<AudioContext | null>(null);
  const playSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [range, setRange] = useState<[number, number]>([0, 0]);
  const [peaks, setPeaks] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [playingSelection, setPlayingSelection] = useState(false);
  const [clipPreviewUrl, setClipPreviewUrl] = useState<string | null>(null);
  const [clipBuilding, setClipBuilding] = useState(false);
  const bufferRef = useRef<AudioBuffer | null>(null);

  /** Object URL lokal dari source — fallback jika parent tidak kirim previewUrl. */
  const [localSourceUrl, setLocalSourceUrl] = useState<string | null>(null);
  const fullPreviewUrl = sourcePreviewUrl || localSourceUrl;

  useEffect(() => {
    if (sourcePreviewUrl) {
      setLocalSourceUrl(null);
      return;
    }
    const url = URL.createObjectURL(source);
    setLocalSourceUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [source, sourcePreviewUrl]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const buffer = await decodeAudioBlob(source);
        if (cancelled) return;
        bufferRef.current = buffer;
        const d = buffer.duration;
        setDuration(d);
        setPeaks(extractWaveformPeaks(buffer, 140));
        const bounds = detectSpeechBounds(buffer);
        setRange([
          Number(bounds.startSec.toFixed(2)),
          Number(bounds.endSec.toFixed(2)),
        ]);
      } catch {
        if (!cancelled) {
          setError(
            'Gagal membaca audio untuk dipotong. Unggah tanpa potong atau rekam ulang.',
          );
          setDuration(0);
          setRange([0, 0]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      stopBufferPlayback();
    };
  }, [source]);

  // Bangun file preview potongan (debounced) agar <audio controls> = hasil crop.
  useEffect(() => {
    if (duration <= 0 || range[1] <= range[0]) return;
    let cancelled = false;
    setClipBuilding(true);
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const result = await trimAudioBlob(source, range[0], range[1], 'preview-clip');
          const url = URL.createObjectURL(result.blob);
          if (cancelled) {
            URL.revokeObjectURL(url);
            return;
          }
          setClipPreviewUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return url;
          });
        } catch {
          if (!cancelled) {
            setClipPreviewUrl((prev) => {
              if (prev) URL.revokeObjectURL(prev);
              return null;
            });
          }
        } finally {
          if (!cancelled) setClipBuilding(false);
        }
      })();
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [source, range, duration]);

  useEffect(() => {
    return () => {
      setClipPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || peaks.length === 0 || duration <= 0) return;
    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.clientWidth || 320;
    const cssH = 56;
    canvas.width = Math.floor(cssW * dpr);
    canvas.height = Math.floor(cssH * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    const [start, end] = range;
    const barW = cssW / peaks.length;
    const mid = cssH / 2;
    peaks.forEach((p, i) => {
      const t = (i / peaks.length) * duration;
      const inSel = t >= start && t <= end;
      const h = Math.max(2, p * (cssH * 0.9));
      ctx.fillStyle = inSel ? 'rgba(22, 119, 255, 0.85)' : 'rgba(0,0,0,0.18)';
      ctx.fillRect(i * barW, mid - h / 2, Math.max(1, barW - 1), h);
    });

    const x0 = (start / duration) * cssW;
    const x1 = (end / duration) * cssW;
    ctx.strokeStyle = 'rgba(22, 119, 255, 1)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x0, 0);
    ctx.lineTo(x0, cssH);
    ctx.moveTo(x1, 0);
    ctx.lineTo(x1, cssH);
    ctx.stroke();
  }, [peaks, range, duration]);

  const selectionMs = Math.max(0, Math.round((range[1] - range[0]) * 1000));

  function stopBufferPlayback() {
    try {
      playSourceRef.current?.stop();
    } catch {
      /* already stopped */
    }
    playSourceRef.current = null;
    void playCtxRef.current?.close().catch(() => undefined);
    playCtxRef.current = null;
    setPlayingSelection(false);
  }

  /** Preview andal: putar slice dari AudioBuffer (tidak bergantung seeking WebM). */
  const playSelectionFromBuffer = async () => {
    const buffer = bufferRef.current;
    if (!buffer || duration <= 0) return;

    stopBufferPlayback();
    clipAudioRef.current?.pause();
    fullAudioRef.current?.pause();

    const ctx = new AudioContext();
    playCtxRef.current = ctx;
    if (ctx.state === 'suspended') await ctx.resume();

    const node = ctx.createBufferSource();
    node.buffer = buffer;
    node.connect(ctx.destination);
    const start = range[0];
    const len = Math.max(0.05, range[1] - range[0]);
    playSourceRef.current = node;
    setPlayingSelection(true);
    node.onended = () => {
      setPlayingSelection(false);
      playSourceRef.current = null;
      void ctx.close().catch(() => undefined);
      if (playCtxRef.current === ctx) playCtxRef.current = null;
    };
    node.start(0, start, len);
  };

  const togglePreview = async () => {
    if (playingSelection) {
      stopBufferPlayback();
      return;
    }
    // Utamakan player clip jika sudah siap (native controls ikut sinkron)
    if (clipPreviewUrl && clipAudioRef.current) {
      const el = clipAudioRef.current;
      el.currentTime = 0;
      try {
        await el.play();
        setPlayingSelection(true);
        const onEnded = () => {
          setPlayingSelection(false);
          el.removeEventListener('ended', onEnded);
        };
        el.addEventListener('ended', onEnded);
        return;
      } catch {
        /* fallback buffer */
      }
    }
    await playSelectionFromBuffer();
  };

  const autoDetect = () => {
    const buffer = bufferRef.current;
    if (!buffer) return;
    stopBufferPlayback();
    const bounds = detectSpeechBounds(buffer);
    setRange([
      Number(bounds.startSec.toFixed(2)),
      Number(bounds.endSec.toFixed(2)),
    ]);
  };

  const handleConfirm = async () => {
    stopBufferPlayback();
    setBusy(true);
    setError(null);
    try {
      const result = await trimAudioBlob(source, range[0], range[1]);
      onConfirm(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memotong audio');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <Flex align="center" gap={8}>
        <Spin size="small" />
        <Text type="secondary">Menyiapkan editor potong…</Text>
      </Flex>
    );
  }

  return (
    <Space direction="vertical" size={10} style={{ width: '100%' }}>
      <Text strong>Potong rekaman sebelum unggah</Text>
      <Text type="secondary" style={{ display: 'block' }}>
        Geser rentang (bagian biru). Lalu tekan <Text strong>Preview potongan</Text> atau
        pakai player di bawah untuk mendengar hasil crop saja — bukan seluruh rekaman
        ({formatRecordingClock(selectionMs)} dari{' '}
        {formatRecordingClock(Math.round(duration * 1000))}).
      </Text>

      {error ? <Alert type="warning" showIcon message={error} /> : null}

      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: 56,
          display: 'block',
          borderRadius: 6,
          background: 'rgba(0,0,0,0.04)',
        }}
      />

      {duration > 0 ? (
        <Slider
          range
          min={0}
          max={Number(duration.toFixed(2))}
          step={0.01}
          value={range}
          disabled={disabled || busy}
          tooltip={{
            formatter: (v) => formatRecordingClock(Math.round((v ?? 0) * 1000)),
          }}
          onChange={(v) => {
            stopBufferPlayback();
            const [a, b] = v as [number, number];
            if (b - a < 0.1) return;
            setRange([a, b]);
          }}
        />
      ) : null}

      <div>
        <Flex align="center" gap={8} style={{ marginBottom: 6 }}>
          <Text strong style={{ fontSize: 13 }}>
            Preview hasil potongan
          </Text>
          {clipBuilding ? (
            <Text type="secondary" style={{ fontSize: 12 }}>
              Memperbarui…
            </Text>
          ) : null}
        </Flex>
        {clipPreviewUrl ? (
          <audio
            ref={clipAudioRef}
            key={clipPreviewUrl}
            src={clipPreviewUrl}
            preload="auto"
            controls
            style={{ width: '100%', maxWidth: 480 }}
            onPlay={() => {
              stopBufferPlayback();
              fullAudioRef.current?.pause();
              setPlayingSelection(true);
            }}
            onPause={() => setPlayingSelection(false)}
            onEnded={() => setPlayingSelection(false)}
          />
        ) : (
          <Text type="secondary" style={{ fontSize: 12 }}>
            Player potongan belum siap — pakai tombol Preview potongan di bawah.
          </Text>
        )}
      </div>

      {fullPreviewUrl ? (
        <details>
          <summary style={{ cursor: 'pointer', fontSize: 12, color: 'rgba(0,0,0,0.45)' }}>
            Dengarkan rekaman penuh (sebelum dipotong)
          </summary>
          <audio
            ref={fullAudioRef}
            src={fullPreviewUrl}
            preload="metadata"
            controls
            style={{ width: '100%', maxWidth: 480, marginTop: 8 }}
            onPlay={() => {
              stopBufferPlayback();
              clipAudioRef.current?.pause();
              setPlayingSelection(false);
            }}
          />
        </details>
      ) : null}

      <Space wrap>
        <Button
          type="default"
          icon={playingSelection ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
          onClick={() => void togglePreview()}
          disabled={disabled || busy || duration <= 0}
        >
          {playingSelection ? 'Stop preview' : 'Preview potongan'}
        </Button>
        <Button
          icon={<ScissorOutlined />}
          onClick={autoDetect}
          disabled={disabled || busy || !bufferRef.current}
        >
          Deteksi otomatis
        </Button>
        <Button
          type="primary"
          icon={<AudioOutlined />}
          loading={busy}
          disabled={disabled || duration <= 0}
          onClick={() => void handleConfirm()}
        >
          {confirmLabel}
        </Button>
        {onRerecord ? (
          <Button onClick={onRerecord} disabled={disabled || busy}>
            Rekam ulang
          </Button>
        ) : null}
        <Button onClick={onCancel} disabled={disabled || busy}>
          Buang
        </Button>
      </Space>
    </Space>
  );
}
