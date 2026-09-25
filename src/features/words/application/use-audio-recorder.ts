import { useEffect, useRef, useState } from 'react';

export type AudioRecorderState = 'idle' | 'recording' | 'preview';

const MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/ogg;codecs=opus',
  'audio/ogg',
] as const;

/** Batas rekaman pelafalan di admin (detik) - cukup untuk lemma/contoh. */
export const MAX_RECORDING_SECONDS = 60;

function pickSupportedMime(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  for (const candidate of MIME_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(candidate)) return candidate;
  }
  return '';
}

export function normalizeAudioMime(mime: string): string {
  return mime.toLowerCase().split(';')[0].trim();
}

export function extensionForAudioMime(mime: string): string {
  switch (normalizeAudioMime(mime)) {
    case 'audio/mp4':
      return 'm4a';
    case 'audio/ogg':
      return 'ogg';
    case 'audio/mpeg':
      return 'mp3';
    case 'audio/wav':
    case 'audio/x-wav':
      return 'wav';
    default:
      return 'webm';
  }
}

/** Tampil mm:ss untuk timer rekaman. */
export function formatRecordingClock(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export function blobToAudioFile(blob: Blob, mimeHint?: string): File {
  const mime = normalizeAudioMime(mimeHint || blob.type || 'audio/webm') || 'audio/webm';
  const ext = extensionForAudioMime(mime);
  return new File([blob], `recording-${Date.now()}.${ext}`, { type: mime });
}

/**
 * MediaRecorder untuk pelafalan di admin (Chrome/Firefox → webm; Safari → mp4).
 * Preview via object URL; panggil `reset()` / unmount untuk revoke.
 */
export function useAudioRecorder() {
  const [state, setState] = useState<AudioRecorderState>('idle');
  const [elapsedMs, setElapsedMs] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [supportedMime] = useState(() => pickSupportedMime());

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const mimeRef = useRef(supportedMime);
  const blobRef = useRef<Blob | null>(null);
  const startedAtRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (autoStopRef.current) {
      clearTimeout(autoStopRef.current);
      autoStopRef.current = null;
    }
  };

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const revokePreview = () => {
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  };

  const reset = () => {
    clearTimers();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        /* ignore */
      }
    }
    mediaRecorderRef.current = null;
    stopStream();
    chunksRef.current = [];
    blobRef.current = null;
    setBlob(null);
    revokePreview();
    setElapsedMs(0);
    setError(null);
    setState('idle');
  };

  const stop = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') return;
    clearTimers();
    recorder.stop();
  };

  const start = async () => {
    setError(null);
    if (!supportedMime) {
      setError('Browser ini tidak mendukung rekaman audio. Gunakan Chrome/Firefox/Safari terbaru, atau pilih file.');
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Mikrofon tidak tersedia di konteks ini (butuh HTTPS atau localhost).');
      return;
    }

    reset();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      mimeRef.current = supportedMime;
      const recorder = new MediaRecorder(stream, { mimeType: supportedMime });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };

      recorder.onerror = () => {
        setError('Rekaman gagal. Coba lagi atau pilih file.');
        stopStream();
        clearTimers();
        setState('idle');
      };

      recorder.onstop = () => {
        stopStream();
        clearTimers();
        const blob = new Blob(chunksRef.current, { type: normalizeAudioMime(mimeRef.current) || 'audio/webm' });
        chunksRef.current = [];
        if (blob.size <= 0) {
          setError('Rekaman kosong. Coba lagi.');
          setState('idle');
          return;
        }
        blobRef.current = blob;
        setBlob(blob);
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
        setElapsedMs(Date.now() - startedAtRef.current);
        setState('preview');
      };

      startedAtRef.current = Date.now();
      setElapsedMs(0);
      setState('recording');
      recorder.start(250);
      timerRef.current = setInterval(() => {
        setElapsedMs(Date.now() - startedAtRef.current);
      }, 200);
      autoStopRef.current = setTimeout(() => {
        stop();
      }, MAX_RECORDING_SECONDS * 1000);
    } catch {
      stopStream();
      setError('Izin mikrofon ditolak atau perangkat tidak ditemukan.');
      setState('idle');
    }
  };

  const toFile = (): File | null => {
    const blob = blobRef.current;
    if (!blob) return null;
    return blobToAudioFile(blob, mimeRef.current);
  };

  useEffect(() => {
    return () => {
      clearTimers();
      try {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
        }
      } catch {
        /* ignore */
      }
      mediaRecorderRef.current = null;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
    // Hanya cleanup unmount - jangan ikut setiap ganti previewUrl
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    state,
    elapsedMs,
    previewUrl,
    blob,
    error,
    supported: Boolean(supportedMime),
    start,
    stop,
    reset,
    toFile,
    durationMs: elapsedMs,
  };
}
