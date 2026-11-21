export function base64ToBlob(base64: string, mimeType = 'audio/wav'): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

export function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

/**
 * Extracts PCM audio payload and format info from a RIFF/WAV buffer.
 * Handles variable-length WAV headers safely.
 */
function extractWavDataChunk(wavBytes: Uint8Array): {
  header: Uint8Array;
  pcmData: Uint8Array;
} {
  if (
    wavBytes.length >= 44 &&
    wavBytes[0] === 0x52 && // 'R'
    wavBytes[1] === 0x49 && // 'I'
    wavBytes[2] === 0x46 && // 'F'
    wavBytes[3] === 0x46    // 'F'
  ) {
    let offset = 12;
    while (offset + 8 <= wavBytes.length) {
      const id = String.fromCharCode(
        wavBytes[offset],
        wavBytes[offset + 1],
        wavBytes[offset + 2],
        wavBytes[offset + 3]
      );
      const view = new DataView(wavBytes.buffer, wavBytes.byteOffset + offset + 4, 4);
      const chunkSize = view.getUint32(0, true);
      if (id === 'data') {
        const dataStart = offset + 8;
        const dataEnd = Math.min(wavBytes.length, dataStart + chunkSize);
        return {
          header: wavBytes.subarray(0, dataStart),
          pcmData: wavBytes.subarray(dataStart, dataEnd),
        };
      }
      offset += 8 + chunkSize + (chunkSize % 2);
    }
    return {
      header: wavBytes.subarray(0, 44),
      pcmData: wavBytes.subarray(44),
    };
  }

  return {
    header: new Uint8Array(0),
    pcmData: wavBytes,
  };
}

/**
 * Seamlessly stitches multiple base64 WAV clips into a single valid RIFF/WAV base64 file
 * with updated RIFF and data chunk sizes (supports unlimited multi-chunk long-form synthesis).
 */
export function mergeWavBase64Chunks(base64Chunks: string[]): string {
  if (base64Chunks.length === 0) return '';
  if (base64Chunks.length === 1) return base64Chunks[0];

  const extracted = base64Chunks.map((b64) =>
    extractWavDataChunk(base64ToUint8Array(b64))
  );

  const firstHeader = extracted[0].header;
  if (firstHeader.length < 44) {
    // Fallback raw concat if no RIFF header
    const totalLen = extracted.reduce((acc, item) => acc + item.pcmData.length, 0);
    const merged = new Uint8Array(totalLen);
    let pos = 0;
    for (const item of extracted) {
      merged.set(item.pcmData, pos);
      pos += item.pcmData.length;
    }
    return uint8ArrayToBase64(merged);
  }

  // Insert subtle 140ms silence gap (24kHz * 2 bytes/sample * 0.14s = 6720 bytes, aligned to 2)
  const silenceGapBytes = 6720;
  const totalPcmBytes =
    extracted.reduce((acc, item) => acc + item.pcmData.length, 0) +
    silenceGapBytes * (extracted.length - 1);

  const merged = new Uint8Array(firstHeader.length + totalPcmBytes);
  merged.set(firstHeader, 0);

  let cursor = firstHeader.length;
  for (let i = 0; i < extracted.length; i++) {
    merged.set(extracted[i].pcmData, cursor);
    cursor += extracted[i].pcmData.length;
    if (i < extracted.length - 1) {
      // Zero-filled gap already initialized in Uint8Array
      cursor += silenceGapBytes;
    }
  }

  // Update RIFF chunk size (offset 4) and data chunk size (last 4 bytes of header)
  const view = new DataView(merged.buffer);
  view.setUint32(4, merged.length - 8, true);
  view.setUint32(firstHeader.length - 4, totalPcmBytes, true);

  return uint8ArrayToBase64(merged);
}

function encodeMonoPcm16Wav(samples: Float32Array, sampleRate: number): Uint8Array {
  const dataSize = samples.length * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  return new Uint8Array(buffer);
}

export async function ensureWavBase64(base64: string, mimeType = 'audio/wav'): Promise<string> {
  if (!base64) return base64;
  const raw = base64ToUint8Array(base64);
  if (
    raw.length >= 12 &&
    raw[0] === 0x52 &&
    raw[1] === 0x49 &&
    raw[2] === 0x46 &&
    raw[3] === 0x46
  ) {
    return base64;
  }

  const blob = new Blob([raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength)], {
    type: mimeType || 'audio/mpeg',
  });
  const arrayBuffer = await blob.arrayBuffer();
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AudioCtx();
  try {
    const decoded = await ctx.decodeAudioData(arrayBuffer);
    const targetRate = 24000;
    const frameCount = Math.max(1, Math.ceil(decoded.duration * targetRate));
    const offline = new OfflineAudioContext(1, frameCount, targetRate);
    const src = offline.createBufferSource();
    src.buffer = decoded;
    src.connect(offline.destination);
    src.start(0);
    const rendered = await offline.startRendering();
    const wavBytes = encodeMonoPcm16Wav(rendered.getChannelData(0), targetRate);
    return uint8ArrayToBase64(wavBytes);
  } finally {
    await ctx.close().catch(() => {});
  }
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const commaIndex = result.indexOf(',');
      resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export async function analyzeAudioPeaks(
  base64: string,
  mimeType = 'audio/wav',
  barCount = 64
): Promise<{ peaks: number[]; durationSec: number }> {
  try {
    const blob = base64ToBlob(base64, mimeType);
    const arrayBuffer = await blob.arrayBuffer();
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    const channelData = audioBuffer.getChannelData(0);
    const step = Math.max(1, Math.floor(channelData.length / barCount));
    const peaks: number[] = [];

    for (let i = 0; i < barCount; i++) {
      let max = 0;
      const start = i * step;
      const end = Math.min(channelData.length, start + step);
      for (let j = start; j < end; j++) {
        const val = Math.abs(channelData[j]);
        if (val > max) max = val;
      }
      peaks.push(Math.max(0.08, Math.min(1, max)));
    }

    const durationSec = audioBuffer.duration || 0;
    await ctx.close();
    return { peaks, durationSec };
  } catch {
    return {
      peaks: Array.from({ length: barCount }, (_, i) => 0.25 + ((i * 7) % 11) * 0.05),
      durationSec: 0,
    };
  }
}

export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hrs > 0) {
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function downloadAudioFile(base64: string, filename: string, mimeType = 'audio/wav'): void {
  const blob = base64ToBlob(base64, mimeType);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function hasUrduScript(text: string): boolean {
  return /[\u0600-\u06FF]/.test(text);
}
