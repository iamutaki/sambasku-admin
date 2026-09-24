import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { ClearOutlined, CheckOutlined } from '@ant-design/icons';
import { Alert, Button, Flex, Radio, Slider, Space, Spin, Typography } from 'antd';

const { Text } = Typography;

export type CensorBrushMode = 'pixelate' | 'blur';

export interface ImageCensorEditorProps {
  /** URL gambar staging (ImageKit) atau public. */
  imageUrl: string;
  disabled?: boolean;
  confirmLabel?: string;
  onApply: (blob: Blob) => void;
  onCancel?: () => void;
}

/**
 * Editor sensor mini: cat daerah sensitif dengan kuas pixelate / blur.
 * Pola UI mengikuti audio-trim-editor (panel bordered + slider + aksi).
 */
export function ImageCensorEditor({
  imageUrl,
  disabled = false,
  confirmLabel = 'Terapkan sensor',
  onApply,
  onCancel,
}: ImageCensorEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sourceRef = useRef<HTMLCanvasElement | null>(null);
  const paintingRef = useRef(false);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<CensorBrushMode>('pixelate');
  const [brushRadius, setBrushRadius] = useState(28);
  const [strength, setStrength] = useState(12);
  const [dirty, setDirty] = useState(false);

  const redrawFromSource = useCallback(() => {
    const canvas = canvasRef.current;
    const source = sourceRef.current;
    if (!canvas || !source) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(source, 0, 0);
    setDirty(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = 'anonymous';

    void (async () => {
      await Promise.resolve();
      if (cancelled) return;
      setLoading(true);
      setError(null);
      setDirty(false);

      img.onload = () => {
        if (cancelled) return;
        const maxW = 640;
        const scale = img.naturalWidth > maxW ? maxW / img.naturalWidth : 1;
        const w = Math.max(1, Math.round(img.naturalWidth * scale));
        const h = Math.max(1, Math.round(img.naturalHeight * scale));

        const source = document.createElement('canvas');
        source.width = w;
        source.height = h;
        const sctx = source.getContext('2d');
        if (!sctx) {
          setError('Canvas tidak tersedia di browser ini.');
          setLoading(false);
          return;
        }
        sctx.drawImage(img, 0, 0, w, h);
        sourceRef.current = source;

        const canvas = canvasRef.current;
        if (!canvas) {
          setLoading(false);
          return;
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(source, 0, 0);
        setLoading(false);
      };

      img.onerror = () => {
        if (!cancelled) {
          setError('Gagal memuat gambar. Periksa CORS / URL staging.');
          setLoading(false);
        }
      };

      img.src = imageUrl;
    })();

    return () => {
      cancelled = true;
      img.onload = null;
      img.onerror = null;
    };
  }, [imageUrl]);

  const canvasPoint = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const applyBrushAt = (x: number, y: number) => {
    const canvas = canvasRef.current;
    const source = sourceRef.current;
    if (!canvas || !source) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const radius = brushRadius;
    const str = strength;
    const brushMode = mode;

    const x0 = Math.max(0, Math.floor(x - radius));
    const y0 = Math.max(0, Math.floor(y - radius));
    const x1 = Math.min(canvas.width, Math.ceil(x + radius));
    const y1 = Math.min(canvas.height, Math.ceil(y + radius));
    const rw = x1 - x0;
    const rh = y1 - y0;
    if (rw <= 0 || rh <= 0) return;

    if (brushMode === 'pixelate') {
      const block = Math.max(4, Math.round(str));
      const srcData = source.getContext('2d')!.getImageData(x0, y0, rw, rh);
      const out = ctx.createImageData(rw, rh);
      out.data.set(srcData.data);

      for (let by = 0; by < rh; by += block) {
        for (let bx = 0; bx < rw; bx += block) {
          let r = 0;
          let g = 0;
          let b = 0;
          let a = 0;
          let count = 0;
          const bw = Math.min(block, rw - bx);
          const bh = Math.min(block, rh - by);
          for (let py = 0; py < bh; py++) {
            for (let px = 0; px < bw; px++) {
              const cx = x0 + bx + px;
              const cy = y0 + by + py;
              const dx = cx - x;
              const dy = cy - y;
              if (dx * dx + dy * dy > radius * radius) continue;
              const i = ((by + py) * rw + (bx + px)) * 4;
              r += srcData.data[i];
              g += srcData.data[i + 1];
              b += srcData.data[i + 2];
              a += srcData.data[i + 3];
              count += 1;
            }
          }
          if (count === 0) continue;
          r = Math.round(r / count);
          g = Math.round(g / count);
          b = Math.round(b / count);
          a = Math.round(a / count);
          for (let py = 0; py < bh; py++) {
            for (let px = 0; px < bw; px++) {
              const cx = x0 + bx + px;
              const cy = y0 + by + py;
              const dx = cx - x;
              const dy = cy - y;
              if (dx * dx + dy * dy > radius * radius) continue;
              const i = ((by + py) * rw + (bx + px)) * 4;
              out.data[i] = r;
              out.data[i + 1] = g;
              out.data[i + 2] = b;
              out.data[i + 3] = a;
            }
          }
        }
      }
      ctx.putImageData(out, x0, y0);
    } else {
      // Blur: salin patch dari sumber, blur lewat filter, clip lingkaran ke canvas kerja.
      const raw = document.createElement('canvas');
      raw.width = rw;
      raw.height = rh;
      const rctx = raw.getContext('2d');
      if (!rctx) return;
      rctx.drawImage(source, x0, y0, rw, rh, 0, 0, rw, rh);

      const patch = document.createElement('canvas');
      patch.width = rw;
      patch.height = rh;
      const pctx = patch.getContext('2d');
      if (!pctx) return;
      pctx.filter = `blur(${Math.max(1, str)}px)`;
      pctx.drawImage(raw, 0, 0);

      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(patch, x0, y0);
      ctx.restore();
    }

    setDirty(true);
  };

  const paintLine = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    const dist = Math.hypot(to.x - from.x, to.y - from.y);
    const step = Math.max(2, brushRadius / 3);
    const n = Math.max(1, Math.ceil(dist / step));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      applyBrushAt(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t);
    }
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (disabled || busy || loading) return;
    const pos = canvasPoint(e);
    if (!pos) return;
    paintingRef.current = true;
    lastPosRef.current = pos;
    e.currentTarget.setPointerCapture(e.pointerId);
    applyBrushAt(pos.x, pos.y);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!paintingRef.current) return;
    const pos = canvasPoint(e);
    if (!pos) return;
    const last = lastPosRef.current;
    if (last) paintLine(last, pos);
    else applyBrushAt(pos.x, pos.y);
    lastPosRef.current = pos;
  };

  const endPaint = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!paintingRef.current) return;
    paintingRef.current = false;
    lastPosRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
  };

  const handleApply = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setBusy(true);
    setError(null);
    canvas.toBlob(
      (blob) => {
        setBusy(false);
        if (!blob) {
          setError('Gagal mengekspor gambar tersensor.');
          return;
        }
        onApply(blob);
      },
      'image/jpeg',
      0.92,
    );
  };

  if (loading) {
    return (
      <Flex
        align="center"
        gap={8}
        style={{
          padding: 16,
          borderRadius: 8,
          background: 'rgba(0,0,0,0.02)',
          border: '1px solid rgba(0,0,0,0.06)',
        }}
      >
        <Spin size="small" />
        <Text type="secondary">Menyiapkan editor sensor…</Text>
      </Flex>
    );
  }

  return (
    <div
      style={{
        borderRadius: 8,
        border: '1px solid rgba(0,0,0,0.08)',
        background: '#fff',
        padding: 14,
      }}
    >
      <Space direction="vertical" size={10} style={{ width: '100%' }}>
        <div>
          <Text strong style={{ display: 'block' }}>
            Sensor gambar
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Cat daerah sensitif (wajah, nomor HP, alamat). Mode pixelate atau blur.
          </Text>
        </div>

        {error ? <Alert type="warning" showIcon message={error} /> : null}

        <canvas
          ref={canvasRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endPaint}
          onPointerLeave={endPaint}
          style={{
            width: '100%',
            maxWidth: 640,
            height: 'auto',
            display: 'block',
            borderRadius: 8,
            background: 'rgba(0,0,0,0.04)',
            cursor: disabled ? 'not-allowed' : 'crosshair',
            touchAction: 'none',
            border: '1px solid rgba(0,0,0,0.06)',
          }}
        />

        <Radio.Group
          value={mode}
          onChange={(e) => setMode(e.target.value)}
          optionType="button"
          buttonStyle="solid"
          disabled={disabled || busy}
          options={[
            { value: 'pixelate', label: 'Pixelate' },
            { value: 'blur', label: 'Blur' },
          ]}
        />

        <div>
          <Flex justify="space-between" style={{ marginBottom: 4 }}>
            <Text style={{ fontSize: 13 }}>Ukuran kuas</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {brushRadius}px
            </Text>
          </Flex>
          <Slider
            min={8}
            max={80}
            value={brushRadius}
            disabled={disabled || busy}
            onChange={setBrushRadius}
          />
        </div>

        <div>
          <Flex justify="space-between" style={{ marginBottom: 4 }}>
            <Text style={{ fontSize: 13 }}>
              {mode === 'pixelate' ? 'Ukuran blok' : 'Kekuatan blur'}
            </Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {strength}
              {mode === 'blur' ? 'px' : ''}
            </Text>
          </Flex>
          <Slider
            min={mode === 'pixelate' ? 4 : 2}
            max={mode === 'pixelate' ? 40 : 24}
            value={strength}
            disabled={disabled || busy}
            onChange={setStrength}
          />
        </div>

        <Flex wrap gap={8}>
          <Button
            icon={<ClearOutlined />}
            onClick={redrawFromSource}
            disabled={disabled || busy || !dirty}
          >
            Reset
          </Button>
          <Button
            type="primary"
            icon={<CheckOutlined />}
            loading={busy}
            disabled={disabled || !dirty}
            onClick={handleApply}
          >
            {confirmLabel}
          </Button>
          {onCancel ? (
            <Button onClick={onCancel} disabled={disabled || busy}>
              Batal
            </Button>
          ) : null}
        </Flex>
      </Space>
    </div>
  );
}
