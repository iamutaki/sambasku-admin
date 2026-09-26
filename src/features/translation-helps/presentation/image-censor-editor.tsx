import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { createPortal } from 'react-dom';
import {
  CheckOutlined,
  ClearOutlined,
  CompressOutlined,
  ExpandOutlined,
  RedoOutlined,
  UndoOutlined,
} from '@ant-design/icons';
import { Alert, Button, Divider, Flex, Radio, Slider, Space, Spin, Tooltip, Typography } from 'antd';

const { Text } = Typography;

export type CensorBrushMode = 'pixelate' | 'blur' | 'block';

export interface ImageCensorEditorProps {
  /** URL gambar staging (ImageKit) atau public. */
  imageUrl: string;
  disabled?: boolean;
  confirmLabel?: string;
  onApply: (blob: Blob) => void;
  onCancel?: () => void;
}

const MAX_EDITOR_WIDTH = 640;
const MAX_HISTORY = 40;

/**
 * Siapkan canvas sumber dari URL: fetch → bitmap (hormati EXIF),
 * fallback Image + crossOrigin jika fetch/bitmap gagal.
 */
async function loadSourceCanvas(
  url: string,
  signal: AbortSignal,
): Promise<HTMLCanvasElement> {
  const drawToSource = (drawable: CanvasImageSource, nw: number, nh: number) => {
    const scale = nw > MAX_EDITOR_WIDTH ? MAX_EDITOR_WIDTH / nw : 1;
    const w = Math.max(1, Math.round(nw * scale));
    const h = Math.max(1, Math.round(nh * scale));
    const source = document.createElement('canvas');
    source.width = w;
    source.height = h;
    const sctx = source.getContext('2d');
    if (!sctx) throw new Error('Canvas tidak tersedia di browser ini.');
    sctx.drawImage(drawable, 0, 0, w, h);
    return source;
  };

  try {
    const res = await fetch(url, { mode: 'cors', signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
    try {
      return drawToSource(bitmap, bitmap.width, bitmap.height);
    } finally {
      bitmap.close();
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    return await new Promise<HTMLCanvasElement>((resolve, reject) => {
      if (signal.aborted) {
        reject(new DOMException('Aborted', 'AbortError'));
        return;
      }
      const img = new Image();
      img.crossOrigin = 'anonymous';
      const onAbort = () => {
        img.onload = null;
        img.onerror = null;
        reject(new DOMException('Aborted', 'AbortError'));
      };
      signal.addEventListener('abort', onAbort, { once: true });
      img.onload = () => {
        signal.removeEventListener('abort', onAbort);
        try {
          resolve(drawToSource(img, img.naturalWidth, img.naturalHeight));
        } catch (e) {
          reject(e);
        }
      };
      img.onerror = () => {
        signal.removeEventListener('abort', onAbort);
        reject(new Error('Gagal memuat gambar. Periksa CORS / URL staging.'));
      };
      img.src = url;
    });
  }
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

function BrushCursorOverlay({
  x,
  y,
  scale,
  radius,
  mode,
  strength,
}: {
  x: number;
  y: number;
  scale: number;
  radius: number;
  mode: CensorBrushMode;
  strength: number;
}) {
  const diameter = Math.max(8, radius * 2 * scale);
  const ringColor = mode === 'block' ? '#111' : mode === 'blur' ? '#1677ff' : '#fa8c16';
  const hint =
    mode === 'pixelate'
      ? `Ø ${Math.round(radius * 2)}px · blok ${strength}`
      : mode === 'blur'
        ? `Ø ${Math.round(radius * 2)}px · blur ${strength}`
        : `Ø ${Math.round(radius * 2)}px · blokir`;

  return (
    <>
      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: x,
          top: y,
          width: diameter,
          height: diameter,
          marginLeft: -diameter / 2,
          marginTop: -diameter / 2,
          borderRadius: '50%',
          border: `2px solid ${ringColor}`,
          boxShadow: '0 0 0 1px rgba(255,255,255,0.9), 0 1px 4px rgba(0,0,0,0.35)',
          background: mode === 'block' ? 'rgba(0,0,0,0.28)' : 'rgba(255,255,255,0.08)',
          pointerEvents: 'none',
          zIndex: 2,
        }}
      />
      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: x,
          top: y + diameter / 2 + 6,
          transform: 'translateX(-50%)',
          padding: '2px 6px',
          borderRadius: 4,
          background: 'rgba(0,0,0,0.72)',
          color: '#fff',
          fontSize: 11,
          fontWeight: 600,
          lineHeight: 1.3,
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          zIndex: 3,
          boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
        }}
      >
        {hint}
      </div>
    </>
  );
}

/**
 * Editor sensor: kuas pixelate / blur / blokir, undo/redo, shortcut, fullscreen.
 * Satu pohon DOM (canvas tidak di-remount) supaya stroke & history aman saat F.
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
  const strokeDirtyRef = useRef(false);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);
  const historyRef = useRef<ImageData[]>([]);
  const historyIndexRef = useRef(-1);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<CensorBrushMode>('pixelate');
  const [brushRadius, setBrushRadius] = useState(28);
  const [strength, setStrength] = useState(12);
  const [dirty, setDirty] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  /** Mirror stack untuk disable Undo/Redo tanpa baca ref saat render. */
  const [historyMeta, setHistoryMeta] = useState({ index: -1, length: 0 });
  const [canvasSize, setCanvasSize] = useState<{ w: number; h: number } | null>(null);
  /** Zoom hanya di fullscreen (1 = 100% piksel bitmap). */
  const [zoom, setZoom] = useState(1);
  /** Posisi cursor kuas relatif ke wrapper canvas (CSS px) + skala bitmap→CSS. */
  const [brushCursor, setBrushCursor] = useState<{
    x: number;
    y: number;
    scale: number;
  } | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  const canUndo = historyMeta.index > 0;
  const canRedo = historyMeta.index >= 0 && historyMeta.index < historyMeta.length - 1;

  const syncHistoryMeta = useCallback(() => {
    setHistoryMeta({
      index: historyIndexRef.current,
      length: historyRef.current.length,
    });
  }, []);

  const paintSourceToCanvas = useCallback((source: HTMLCanvasElement) => {
    const canvas = canvasRef.current;
    if (!canvas) return false;
    canvas.width = source.width;
    canvas.height = source.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(source, 0, 0);
    return true;
  }, []);

  const snapshotCanvas = useCallback((): ImageData | null => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || canvas.width === 0) return null;
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  }, []);

  const restoreSnapshot = useCallback((snap: ImageData) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.putImageData(snap, 0, 0);
  }, []);

  const resetHistoryFromCanvas = useCallback(() => {
    const snap = snapshotCanvas();
    historyRef.current = snap ? [snap] : [];
    historyIndexRef.current = snap ? 0 : -1;
    setDirty(false);
    syncHistoryMeta();
  }, [snapshotCanvas, syncHistoryMeta]);

  const commitStrokeHistory = useCallback(() => {
    if (!strokeDirtyRef.current) return;
    strokeDirtyRef.current = false;
    const snap = snapshotCanvas();
    if (!snap) return;
    const next = historyRef.current.slice(0, historyIndexRef.current + 1);
    next.push(snap);
    while (next.length > MAX_HISTORY) next.shift();
    historyRef.current = next;
    historyIndexRef.current = next.length - 1;
    setDirty(true);
    syncHistoryMeta();
  }, [snapshotCanvas, syncHistoryMeta]);

  const undo = useCallback(() => {
    if (historyIndexRef.current <= 0) return;
    historyIndexRef.current -= 1;
    restoreSnapshot(historyRef.current[historyIndexRef.current]);
    setDirty(historyIndexRef.current > 0);
    syncHistoryMeta();
  }, [restoreSnapshot, syncHistoryMeta]);

  const redo = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    historyIndexRef.current += 1;
    restoreSnapshot(historyRef.current[historyIndexRef.current]);
    setDirty(historyIndexRef.current > 0);
    syncHistoryMeta();
  }, [restoreSnapshot, syncHistoryMeta]);

  const redrawFromSource = useCallback(() => {
    const source = sourceRef.current;
    if (!source) return;
    if (!paintSourceToCanvas(source)) return;
    resetHistoryFromCanvas();
  }, [paintSourceToCanvas, resetHistoryFromCanvas]);

  useEffect(() => {
    const ac = new AbortController();

    void (async () => {
      setLoading(true);
      setError(null);
      setDirty(false);
      setCanvasSize(null);
      sourceRef.current = null;
      historyRef.current = [];
      historyIndexRef.current = -1;
      setHistoryMeta({ index: -1, length: 0 });

      try {
        const source = await loadSourceCanvas(imageUrl, ac.signal);
        if (ac.signal.aborted) return;
        sourceRef.current = source;
        setCanvasSize({ w: source.width, h: source.height });
        paintSourceToCanvas(source);
        setLoading(false);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        if (!ac.signal.aborted) {
          setError(
            err instanceof Error
              ? err.message
              : 'Gagal memuat gambar. Periksa CORS / URL staging.',
          );
          setLoading(false);
        }
      }
    })();

    return () => ac.abort();
  }, [imageUrl, paintSourceToCanvas]);

  useEffect(() => {
    if (loading) return;
    const source = sourceRef.current;
    if (!source) return;
    paintSourceToCanvas(source);
    resetHistoryFromCanvas();
  }, [loading, canvasSize, paintSourceToCanvas, resetHistoryFromCanvas]);

  useEffect(() => {
    if (!fullscreen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [fullscreen]);

  const zoomRef = useRef(1);

  const clampZoom = (z: number) => Math.min(8, Math.max(0.25, Math.round(z * 100) / 100));

  const resetZoom = useCallback(() => {
    zoomRef.current = 1;
    setZoom(1);
    setBrushCursor(null);
  }, []);

  const enterFullscreen = useCallback(() => {
    resetZoom();
    setFullscreen(true);
  }, [resetZoom]);

  const exitFullscreen = useCallback(() => {
    resetZoom();
    setFullscreen(false);
  }, [resetZoom]);

  const toggleFullscreen = useCallback(() => {
    if (fullscreen) exitFullscreen();
    else enterFullscreen();
  }, [enterFullscreen, exitFullscreen, fullscreen]);

  const applyZoomAtPoint = useCallback(
    (nextZoom: number, clientX: number, clientY: number) => {
      const stage = stageRef.current;
      const prev = zoomRef.current;
      const z = clampZoom(nextZoom);
      if (z === prev) return;

      if (!stage || !fullscreen) {
        zoomRef.current = z;
        setZoom(z);
        return;
      }

      const rect = stage.getBoundingClientRect();
      const offsetX = clientX - rect.left;
      const offsetY = clientY - rect.top;
      const contentX = stage.scrollLeft + offsetX;
      const contentY = stage.scrollTop + offsetY;
      const ratio = z / prev;
      zoomRef.current = z;
      setZoom(z);
      requestAnimationFrame(() => {
        stage.scrollLeft = contentX * ratio - offsetX;
        stage.scrollTop = contentY * ratio - offsetY;
      });
    },
    [fullscreen],
  );

  // Wheel zoom di fullscreen (passive: false agar preventDefault jalan).
  useEffect(() => {
    if (!fullscreen) return;
    const stage = stageRef.current;
    if (!stage) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      applyZoomAtPoint(zoomRef.current * factor, e.clientX, e.clientY);
    };

    stage.addEventListener('wheel', onWheel, { passive: false });
    return () => stage.removeEventListener('wheel', onWheel);
  }, [fullscreen, applyZoomAtPoint]);

  // Portal/fullscreen me-remount canvas - pulihkan bitmap dari history.
  useLayoutEffect(() => {
    if (loading) return;
    const snap = historyRef.current[historyIndexRef.current];
    if (snap) {
      const canvas = canvasRef.current;
      if (canvas && (canvas.width !== snap.width || canvas.height !== snap.height)) {
        canvas.width = snap.width;
        canvas.height = snap.height;
      }
      restoreSnapshot(snap);
      return;
    }
    const source = sourceRef.current;
    if (source) paintSourceToCanvas(source);
  }, [fullscreen, loading, paintSourceToCanvas, restoreSnapshot]);

  const canvasPoint = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || canvas.width === 0) return null;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    };
  };

  const updateBrushCursor = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (disabled || busy || loading || error) {
      setBrushCursor(null);
      return;
    }
    const canvas = canvasRef.current;
    const wrap = canvas?.parentElement;
    if (!canvas || !wrap || canvas.width === 0) {
      setBrushCursor(null);
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const wrapRect = wrap.getBoundingClientRect();
    if (rect.width === 0) {
      setBrushCursor(null);
      return;
    }
    setBrushCursor({
      x: e.clientX - wrapRect.left,
      y: e.clientY - wrapRect.top,
      scale: rect.width / canvas.width,
    });
  };

  const hideBrushCursor = () => setBrushCursor(null);

  const applyBrushAt = (x: number, y: number) => {
    const canvas = canvasRef.current;
    const source = sourceRef.current;
    if (!canvas || !source || canvas.width === 0) return;
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

    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.clip();

    if (brushMode === 'block') {
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(x0, y0, rw, rh);
    } else if (brushMode === 'pixelate') {
      const block = Math.max(4, Math.round(str));
      const gridX0 = Math.floor(x0 / block) * block;
      const gridY0 = Math.floor(y0 / block) * block;
      const gridX1 = Math.min(canvas.width, Math.ceil(x1 / block) * block);
      const gridY1 = Math.min(canvas.height, Math.ceil(y1 / block) * block);
      const gw = gridX1 - gridX0;
      const gh = gridY1 - gridY0;
      if (gw > 0 && gh > 0) {
        const smallW = Math.max(1, Math.round(gw / block));
        const smallH = Math.max(1, Math.round(gh / block));
        const small = document.createElement('canvas');
        small.width = smallW;
        small.height = smallH;
        const sctx = small.getContext('2d');
        if (sctx) {
          sctx.imageSmoothingEnabled = false;
          sctx.drawImage(canvas, gridX0, gridY0, gw, gh, 0, 0, smallW, smallH);
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(small, 0, 0, smallW, smallH, gridX0, gridY0, gw, gh);
          ctx.imageSmoothingEnabled = true;
        }
      }
    } else {
      const raw = document.createElement('canvas');
      raw.width = rw;
      raw.height = rh;
      const rctx = raw.getContext('2d');
      if (rctx) {
        rctx.drawImage(source, x0, y0, rw, rh, 0, 0, rw, rh);
        const patch = document.createElement('canvas');
        patch.width = rw;
        patch.height = rh;
        const pctx = patch.getContext('2d');
        if (pctx) {
          pctx.filter = `blur(${Math.max(1, str)}px)`;
          pctx.drawImage(raw, 0, 0);
          ctx.drawImage(patch, x0, y0);
        }
      }
    }

    ctx.restore();
    strokeDirtyRef.current = true;
  };

  const paintLine = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    const dist = Math.hypot(to.x - from.x, to.y - from.y);
    const step = Math.max(2, brushRadius * 0.4);
    const n = Math.max(1, Math.ceil(dist / step));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      applyBrushAt(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t);
    }
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (disabled || busy || loading || error) return;
    const pos = canvasPoint(e);
    if (!pos) return;
    paintingRef.current = true;
    strokeDirtyRef.current = false;
    lastPosRef.current = pos;
    e.currentTarget.setPointerCapture(e.pointerId);
    updateBrushCursor(e);
    applyBrushAt(pos.x, pos.y);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    updateBrushCursor(e);
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
    commitStrokeHistory();
  };

  const onPointerLeave = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!paintingRef.current) hideBrushCursor();
    endPaint(e);
  };

  const handleApply = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || canvas.width === 0) return;
    setBusy(true);
    setError(null);
    canvas.toBlob(
      (blob) => {
        setBusy(false);
        if (!blob) {
          setError('Gagal mengekspor gambar tersensor.');
          return;
        }
        resetZoom();
        setFullscreen(false);
        onApply(blob);
      },
      'image/jpeg',
      0.92,
    );
  }, [onApply, resetZoom]);

  const controlsDisabled = disabled || busy || loading || !!error;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (controlsDisabled) return;
      if (isTypingTarget(e.target)) return;

      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();

      if (mod && key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }
      if (mod && ((key === 'z' && e.shiftKey) || key === 'y')) {
        e.preventDefault();
        redo();
        return;
      }
      if (mod && key === 'enter' && dirty) {
        e.preventDefault();
        handleApply();
        return;
      }
      if (key === 'escape') {
        if (fullscreen) {
          e.preventDefault();
          exitFullscreen();
        }
        return;
      }
      if (key === 'f' && !mod) {
        e.preventDefault();
        toggleFullscreen();
        return;
      }
      if (fullscreen && (key === '=' || key === '+') && !mod) {
        e.preventDefault();
        const stage = stageRef.current;
        const rect = stage?.getBoundingClientRect();
        const cx = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
        const cy = rect ? rect.top + rect.height / 2 : window.innerHeight / 2;
        applyZoomAtPoint(zoomRef.current * 1.2, cx, cy);
        return;
      }
      if (fullscreen && key === '-' && !mod) {
        e.preventDefault();
        const stage = stageRef.current;
        const rect = stage?.getBoundingClientRect();
        const cx = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
        const cy = rect ? rect.top + rect.height / 2 : window.innerHeight / 2;
        applyZoomAtPoint(zoomRef.current / 1.2, cx, cy);
        return;
      }
      if (fullscreen && key === '0' && !mod) {
        e.preventDefault();
        resetZoom();
        return;
      }
      if (key === '[' || key === '{') {
        e.preventDefault();
        setBrushRadius((r) => Math.max(8, r - 4));
        return;
      }
      if (key === ']' || key === '}') {
        e.preventDefault();
        setBrushRadius((r) => Math.min(80, r + 4));
        return;
      }
      if (key === '1' && !mod) {
        e.preventDefault();
        setMode('pixelate');
        return;
      }
      if (key === '2' && !mod) {
        e.preventDefault();
        setMode('blur');
        return;
      }
      if (key === '3' && !mod) {
        e.preventDefault();
        setMode('block');
        return;
      }
      if (mod && key === '0') {
        e.preventDefault();
        redrawFromSource();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    applyZoomAtPoint,
    controlsDisabled,
    dirty,
    exitFullscreen,
    fullscreen,
    handleApply,
    redo,
    redrawFromSource,
    resetZoom,
    toggleFullscreen,
    undo,
  ]);

  const showStrength = mode === 'pixelate' || mode === 'blur';
  const displayZoom = fullscreen ? zoom : 1;
  const canvasCssW = canvasSize ? Math.max(1, Math.round(canvasSize.w * displayZoom)) : undefined;
  const canvasCssH = canvasSize ? Math.max(1, Math.round(canvasSize.h * displayZoom)) : undefined;

  const shellStyle = fullscreen
    ? {
        position: 'fixed' as const,
        inset: 0,
        zIndex: 1100,
        background: '#0a0a0a',
        padding: 16,
        boxSizing: 'border-box' as const,
        display: 'flex' as const,
        flexDirection: 'column' as const,
      }
    : {
        borderRadius: 8,
        border: '1px solid rgba(0,0,0,0.08)',
        background: '#fff',
        padding: 14,
      };

  const editor = (
    <div
      role={fullscreen ? 'dialog' : undefined}
      aria-modal={fullscreen || undefined}
      aria-label={fullscreen ? 'Editor sensor layar penuh' : undefined}
      style={shellStyle}
    >
      <div
        style={
          fullscreen
            ? {
                flex: 1,
                minHeight: 0,
                background: '#fff',
                borderRadius: 12,
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }
            : undefined
        }
      >
        <Space
          direction="vertical"
          size={12}
          style={{ width: '100%', height: fullscreen ? '100%' : undefined, display: 'flex' }}
        >
          <Flex align="center" justify="space-between" gap={8} wrap="wrap" style={{ width: '100%' }}>
            <div>
              <Text strong style={{ display: 'block' }}>
                Sensor gambar
              </Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {fullscreen
                  ? 'Scroll zoom · 0 reset zoom · Esc keluar · ⌘Z undo · [ ] kuas · 1-3 mode'
                  : 'Undo/Redo · F layar penuh · [ ] kuas · 1-3 mode · ⌘↵ terapkan'}
              </Text>
            </div>
            <Space size={4} wrap>
              <Tooltip title="Undo (⌘Z / Ctrl+Z)">
                <Button
                  icon={<UndoOutlined />}
                  disabled={controlsDisabled || !canUndo}
                  onClick={undo}
                  aria-label="Undo"
                />
              </Tooltip>
              <Tooltip title="Redo (⌘⇧Z / Ctrl+Y)">
                <Button
                  icon={<RedoOutlined />}
                  disabled={controlsDisabled || !canRedo}
                  onClick={redo}
                  aria-label="Redo"
                />
              </Tooltip>
              {fullscreen ? (
                <>
                  <Divider orientation="vertical" style={{ height: 24, marginInline: 4 }} />
                  <Tooltip title="Zoom out (-)">
                    <Button
                      disabled={controlsDisabled || zoom <= 0.25}
                      onClick={() => {
                        const stage = stageRef.current;
                        const rect = stage?.getBoundingClientRect();
                        const cx = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
                        const cy = rect ? rect.top + rect.height / 2 : window.innerHeight / 2;
                        applyZoomAtPoint(zoom / 1.2, cx, cy);
                      }}
                    >
                      −
                    </Button>
                  </Tooltip>
                  <Tooltip title="Reset zoom (0)">
                    <Button
                      disabled={controlsDisabled || zoom === 1}
                      onClick={resetZoom}
                      style={{ minWidth: 56 }}
                    >
                      {Math.round(zoom * 100)}%
                    </Button>
                  </Tooltip>
                  <Tooltip title="Zoom in (+)">
                    <Button
                      disabled={controlsDisabled || zoom >= 8}
                      onClick={() => {
                        const stage = stageRef.current;
                        const rect = stage?.getBoundingClientRect();
                        const cx = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
                        const cy = rect ? rect.top + rect.height / 2 : window.innerHeight / 2;
                        applyZoomAtPoint(zoom * 1.2, cx, cy);
                      }}
                    >
                      +
                    </Button>
                  </Tooltip>
                </>
              ) : null}
              <Divider orientation="vertical" style={{ height: 24, marginInline: 4 }} />
              <Tooltip title={fullscreen ? 'Keluar layar penuh (Esc / F)' : 'Layar penuh (F)'}>
                <Button
                  type={fullscreen ? 'primary' : 'default'}
                  icon={fullscreen ? <CompressOutlined /> : <ExpandOutlined />}
                  disabled={loading || !!error}
                  onClick={toggleFullscreen}
                  aria-label={fullscreen ? 'Keluar layar penuh' : 'Layar penuh'}
                />
              </Tooltip>
            </Space>
          </Flex>

          {error ? <Alert type="warning" showIcon message={error} /> : null}

          <Flex
            gap={16}
            wrap={fullscreen ? 'nowrap' : 'wrap'}
            align="stretch"
            style={{ width: '100%', flex: fullscreen ? 1 : undefined, minHeight: 0 }}
          >
            <div
              ref={stageRef}
              style={{
                position: 'relative',
                flex: fullscreen ? '1 1 auto' : '1 1 280px',
                minWidth: 0,
                height: fullscreen ? 'calc(100vh - 120px)' : 'auto',
                maxHeight: fullscreen ? 'calc(100vh - 120px)' : undefined,
                display: 'flex',
                alignItems: fullscreen ? 'flex-start' : 'flex-start',
                justifyContent: fullscreen ? 'flex-start' : 'center',
                borderRadius: 8,
                background: fullscreen ? '#141414' : 'rgba(0,0,0,0.04)',
                border: '1px solid rgba(0,0,0,0.06)',
                overflow: fullscreen ? 'auto' : 'hidden',
              }}
            >
              <div
                style={{
                  position: 'relative',
                  display: 'inline-block',
                  lineHeight: 0,
                  width: fullscreen && canvasCssW ? canvasCssW : undefined,
                  height: fullscreen && canvasCssH ? canvasCssH : undefined,
                  // Non-FS: ikuti lebar kolom parent, tinggi mengikuti aspek gambar penuh.
                  maxWidth: fullscreen ? undefined : '100%',
                }}
              >
                <canvas
                  ref={canvasRef}
                  tabIndex={0}
                  onPointerDown={onPointerDown}
                  onPointerMove={onPointerMove}
                  onPointerUp={endPaint}
                  onPointerLeave={onPointerLeave}
                  style={{
                    width: fullscreen && canvasCssW ? canvasCssW : '100%',
                    height: fullscreen && canvasCssH ? canvasCssH : 'auto',
                    maxWidth: fullscreen ? undefined : '100%',
                    aspectRatio:
                      !fullscreen && canvasSize ? `${canvasSize.w} / ${canvasSize.h}` : undefined,
                    display: 'block',
                    cursor: controlsDisabled ? 'not-allowed' : brushCursor ? 'none' : 'crosshair',
                    touchAction: 'none',
                    opacity: loading ? 0.35 : 1,
                    outline: 'none',
                  }}
                />
                {brushCursor && !controlsDisabled ? (
                  <BrushCursorOverlay
                    x={brushCursor.x}
                    y={brushCursor.y}
                    scale={brushCursor.scale}
                    radius={brushRadius}
                    mode={mode}
                    strength={strength}
                  />
                ) : null}
              </div>
              {loading ? (
                <Flex
                  align="center"
                  justify="center"
                  gap={8}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: fullscreen ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.72)',
                  }}
                >
                  <Spin size="small" />
                  <Text
                    type={fullscreen ? undefined : 'secondary'}
                    style={fullscreen ? { color: '#fff' } : undefined}
                  >
                    Menyiapkan editor sensor…
                  </Text>
                </Flex>
              ) : null}
            </div>

            <Space
              direction="vertical"
              size={12}
              style={{
                flex: fullscreen ? '0 0 280px' : '0 0 240px',
                width: fullscreen ? 280 : 240,
                minWidth: 200,
                overflow: fullscreen ? 'auto' : undefined,
              }}
            >
              <div>
                <Text
                  style={{
                    fontSize: 12,
                    color: 'rgba(0,0,0,0.45)',
                    display: 'block',
                    marginBottom: 6,
                  }}
                >
                  Mode (1 / 2 / 3)
                </Text>
                <Radio.Group
                  value={mode}
                  onChange={(e) => setMode(e.target.value)}
                  optionType="button"
                  buttonStyle="solid"
                  disabled={controlsDisabled}
                  options={[
                    { value: 'pixelate', label: 'Pixelate' },
                    { value: 'blur', label: 'Blur' },
                    { value: 'block', label: 'Blokir' },
                  ]}
                />
              </div>

              <div>
                <Flex justify="space-between" style={{ marginBottom: 4 }}>
                  <Text style={{ fontSize: 13 }}>Ukuran kuas ([ ])</Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {brushRadius}px
                  </Text>
                </Flex>
                <Slider
                  min={8}
                  max={80}
                  value={brushRadius}
                  disabled={controlsDisabled}
                  onChange={setBrushRadius}
                />
              </div>

              {showStrength ? (
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
                    disabled={controlsDisabled}
                    onChange={setStrength}
                  />
                </div>
              ) : null}

              <Divider style={{ margin: '4px 0' }} />

              <Flex wrap gap={8}>
                <Tooltip title="Reset ke asli (⌘0)">
                  <Button
                    icon={<ClearOutlined />}
                    onClick={redrawFromSource}
                    disabled={controlsDisabled || !dirty}
                  >
                    Reset
                  </Button>
                </Tooltip>
                <Tooltip title="Terapkan (⌘↵)">
                  <Button
                    type="primary"
                    icon={<CheckOutlined />}
                    loading={busy}
                    disabled={controlsDisabled || !dirty}
                    onClick={handleApply}
                  >
                    {confirmLabel}
                  </Button>
                </Tooltip>
                {onCancel && !fullscreen ? (
                  <Button onClick={onCancel} disabled={disabled || busy}>
                    Batal
                  </Button>
                ) : null}
                {fullscreen ? (
                  <Button onClick={exitFullscreen} disabled={busy}>
                    Tutup
                  </Button>
                ) : null}
              </Flex>
            </Space>
          </Flex>
        </Space>
      </div>
    </div>
  );

  // Portal ke body: fixed di dalam layout Ant Design (transform) tidak menutupi viewport.
  if (fullscreen && typeof document !== 'undefined') {
    return (
      <>
        <div
          style={{
            borderRadius: 8,
            border: '1px dashed rgba(0,0,0,0.12)',
            background: 'rgba(0,0,0,0.02)',
            padding: 14,
            minHeight: 80,
          }}
        >
          <Text type="secondary">Editor sensor dalam mode layar penuh…</Text>
        </div>
        {createPortal(editor, document.body)}
      </>
    );
  }

  return editor;
}
