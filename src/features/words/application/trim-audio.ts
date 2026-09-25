/**
 * Potong audio di browser: decode → slice → encode WAV (MIME didukung API).
 * Memakai Web Audio API - tanpa ffmpeg.wasm.
 */

export interface TrimAudioResult {
  file: File;
  durationMs: number;
  blob: Blob;
}

export interface SpeechBounds {
  startSec: number;
  endSec: number;
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

/** Encode mono/stereo PCM float → WAV 16-bit. */
export function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  const samples = buffer.length;
  const blockAlign = (numChannels * bitDepth) / 8;
  const byteRate = sampleRate * blockAlign;
  const dataSize = samples * blockAlign;
  const headerSize = 44;
  const arrayBuffer = new ArrayBuffer(headerSize + dataSize);
  const view = new DataView(arrayBuffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  const channels: Float32Array[] = [];
  for (let c = 0; c < numChannels; c++) {
    channels.push(buffer.getChannelData(c));
  }

  let offset = 44;
  for (let i = 0; i < samples; i++) {
    for (let c = 0; c < numChannels; c++) {
      const sample = Math.max(-1, Math.min(1, channels[c]![i]!));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

export async function decodeAudioBlob(blob: Blob): Promise<AudioBuffer> {
  const ctx = new AudioContext();
  try {
    const ab = await blob.arrayBuffer();
    return await ctx.decodeAudioData(ab.slice(0));
  } finally {
    await ctx.close().catch(() => undefined);
  }
}

/** Ambil cuplikan peak untuk waveform (nilai 0..1). */
export function extractWaveformPeaks(buffer: AudioBuffer, bars = 120): number[] {
  const channel = buffer.getChannelData(0);
  const peaks: number[] = [];
  const block = Math.max(1, Math.floor(channel.length / bars));
  for (let i = 0; i < bars; i++) {
    const start = i * block;
    const end = Math.min(start + block, channel.length);
    let max = 0;
    for (let j = start; j < end; j++) {
      const v = Math.abs(channel[j]!);
      if (v > max) max = v;
    }
    peaks.push(max);
  }
  return peaks;
}

/**
 * Deteksi rentang suara (buang diam di awal/akhir) via RMS sederhana.
 * paddingSec menjaga sedikit napas di pinggir.
 */
export function detectSpeechBounds(
  buffer: AudioBuffer,
  options?: { silenceThreshold?: number; paddingSec?: number; minSec?: number },
): SpeechBounds {
  const silenceThreshold = options?.silenceThreshold ?? 0.015;
  const paddingSec = options?.paddingSec ?? 0.12;
  const minSec = options?.minSec ?? 0.25;
  const channel = buffer.getChannelData(0);
  const sampleRate = buffer.sampleRate;
  const windowSize = Math.max(1, Math.floor(sampleRate * 0.02)); // 20ms
  const total = channel.length;

  let firstLoud = -1;
  let lastLoud = -1;

  for (let i = 0; i < total; i += windowSize) {
    let sum = 0;
    const end = Math.min(i + windowSize, total);
    for (let j = i; j < end; j++) {
      const s = channel[j]!;
      sum += s * s;
    }
    const rms = Math.sqrt(sum / (end - i));
    if (rms >= silenceThreshold) {
      if (firstLoud < 0) firstLoud = i;
      lastLoud = end;
    }
  }

  const duration = buffer.duration;
  if (firstLoud < 0 || lastLoud < 0) {
    return { startSec: 0, endSec: duration };
  }

  let startSec = Math.max(0, firstLoud / sampleRate - paddingSec);
  let endSec = Math.min(duration, lastLoud / sampleRate + paddingSec);
  if (endSec - startSec < minSec) {
    const mid = (startSec + endSec) / 2;
    startSec = Math.max(0, mid - minSec / 2);
    endSec = Math.min(duration, startSec + minSec);
  }
  return { startSec, endSec };
}

export function sliceAudioBuffer(
  buffer: AudioBuffer,
  startSec: number,
  endSec: number,
): AudioBuffer {
  const start = Math.max(0, Math.floor(startSec * buffer.sampleRate));
  const end = Math.min(buffer.length, Math.floor(endSec * buffer.sampleRate));
  const frameCount = Math.max(1, end - start);
  const offline = new OfflineAudioContext(
    buffer.numberOfChannels,
    frameCount,
    buffer.sampleRate,
  );
  const sliced = offline.createBuffer(
    buffer.numberOfChannels,
    frameCount,
    buffer.sampleRate,
  );
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const src = buffer.getChannelData(c).subarray(start, start + frameCount);
    sliced.copyToChannel(src, c);
  }
  return sliced;
}

/** Potong blob audio → File WAV siap upload. */
export async function trimAudioBlob(
  source: Blob,
  startSec: number,
  endSec: number,
  fileNameBase = 'pronunciation',
): Promise<TrimAudioResult> {
  if (endSec <= startSec) {
    throw new Error('Rentang potongan tidak valid.');
  }
  const decoded = await decodeAudioBlob(source);
  const duration = decoded.duration;
  const start = Math.max(0, Math.min(startSec, duration));
  const end = Math.max(start + 0.05, Math.min(endSec, duration));
  const sliced = sliceAudioBuffer(decoded, start, end);
  const blob = audioBufferToWavBlob(sliced);
  const durationMs = Math.round(sliced.duration * 1000);
  const file = new File([blob], `${fileNameBase}-${Date.now()}.wav`, {
    type: 'audio/wav',
  });
  return { file, durationMs, blob };
}
