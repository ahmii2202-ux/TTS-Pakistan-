import 'dotenv/config';
import { spawn } from 'child_process';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in the server environment.');
  }
  return new GoogleGenAI({
    apiKey,
    apiVersion: 'v1beta',
    httpOptions: {
      apiVersion: 'v1beta',
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

const VALID_BASE_VOICES = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'] as const;
type BaseVoice = (typeof VALID_BASE_VOICES)[number];

function sanitizeBaseVoice(voice?: string): BaseVoice {
  if (voice && (VALID_BASE_VOICES as readonly string[]).includes(voice)) {
    return voice as BaseVoice;
  }
  return 'Kore';
}

function extractRetryAfterSec(rawMessage: string): number | undefined {
  const secMatch =
    rawMessage.match(/retryDelay["']?\s*[:=]\s*["']?(\d+(?:\.\d+)?)s/i) ||
    rawMessage.match(/retry in\s+(\d+(?:\.\d+)?)\s*s/i);
  if (secMatch && secMatch[1]) {
    const parsed = Math.ceil(Number(secMatch[1]));
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return undefined;
}

function isDailyQuotaMessage(rawMessage: string): boolean {
  const lower = rawMessage.toLowerCase();
  return (
    lower.includes('perday') ||
    lower.includes('requestsperday') ||
    lower.includes('tokensperday') ||
    lower.includes('daily') ||
    lower.includes('generaterequestsperday')
  );
}

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const msg = (err as { message?: string })?.message || '';
      if (isDailyQuotaMessage(msg)) {
        throw err;
      }
      const isTransient =
        msg.includes('429') ||
        msg.includes('RESOURCE_EXHAUSTED') ||
        msg.includes('503') ||
        msg.includes('UNAVAILABLE');
      if (!isTransient || attempt === maxRetries) {
        throw err;
      }
      const hintedSec = extractRetryAfterSec(msg);
      const waitMs = hintedSec && hintedSec <= 15 ? hintedSec * 1000 : 1200 * (attempt + 1);
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }
  throw lastError;
}

function buildDeliveryStyle(params: {
  baseStylePrompt: string;
  mood?: string;
  accent?: string;
  pace?: string;
  expressionLevel?: string;
  pauseRhythm?: string;
  acousticProfile?: string;
  pitchTilt?: string;
  customDirection?: string;
  text: string;
}): string {
  const {
    baseStylePrompt,
    mood,
    accent,
    pace,
    expressionLevel,
    pauseRhythm,
    acousticProfile,
    pitchTilt,
    customDirection,
    text,
  } = params;

  const hasUrduScript = /[\u0600-\u06FF]/.test(text);

  const moodDirectives: Record<string, string> = {
    natural: 'Deliver in a natural, human, unforced tone with authentic conversational flow.',
    storytelling:
      'Deliver with warm narrative expressiveness, engaging inflection, and vivid emotional pacing.',
    news: 'Deliver with crisp broadcast clarity, poised authority, and steady journalistic cadence.',
    poetic:
      'Deliver with lyrical Urdu poetic sensitivity, gentle melodic cadence, and reflective pauses.',
    calm: 'Deliver softly with a soothing, intimate, relaxed vocal presence.',
    energetic: 'Deliver with bright, lively energy, crisp emphasis, and dynamic engagement.',
    dramatic:
      'Deliver with rich cinematic gravitas, deep emotional resonance, and dramatic contrast.',
    whisper:
      'Deliver in a soft, gentle, close-microphone intimate tone with delicate breathiness.',
    lecture:
      'Deliver with clear, patient, structured pedagogical clarity suitable for teaching and explanations.',
    cheerful:
      'Deliver with a warm, smiling, welcoming, and uplifting emotional tone.',
    horror:
      'Deliver in a chilling, eerie horror-narrator tone with haunting suspense, low ominous tension, hushed dread, and deliberate spine-tingling pauses.',
    scary:
      'Deliver in a dark, sinister, menacing tone with cold creeping intensity, shadowy gravitas, and unsettling emphasis on key words.',
    feared:
      'Deliver in a frightened, trembling, anxious tone with tense breathing, vulnerable urgency, shaken inflection, and nervous hesitation.',
  };

  const accentDirectives: Record<string, string> = {
    auto: '',
    islamabad_broadcast:
      'Use crisp, neutral Islamabad standard Pakistani Urdu articulation and clean consonant boundaries.',
    karachi_urban:
      'Use natural modern urban Karachi Urdu cadence with effortless Urdu-English code-switching.',
    lahori_expressive:
      'Use warm, lively Lahori Urdu phrasing with expressive melodic emphasis.',
    classical_adab:
      'Use refined classical literary Urdu (Adab) pronunciation honoring Persian and Arabic loanword nuances.',
    punjabi_urdu:
      'Use grounded, warm Punjabi-inflected Pakistani Urdu cadence with heartfelt sincerity.',
    pakistani_english:
      'Use clear, articulate Pakistani English pronunciation with natural rhythm.',
    international_english:
      'Use neutral international English diction with crisp articulation.',
  };

  const paceDirectives: Record<string, string> = {
    slow: 'Speak at a slow, deliberate 0.8x pace with generous breathing room.',
    measured: 'Speak at a measured 0.9x audiobook pace.',
    normal: 'Speak at a comfortable, natural 1.0x conversational speed.',
    brisk: 'Speak at a brisk, engaging 1.15x pace while keeping every syllable crisp.',
    fast: 'Speak at a fast 1.3x pace without slurring words.',
  };

  const expressionDirectives: Record<string, string> = {
    subtle: 'Keep emotional variation understated, restrained, and steady.',
    balanced: 'Use natural, well-proportioned emotional inflection.',
    expressive: 'Use rich, dynamic vocal inflection, pitch contour, and emotional color.',
    theatrical: 'Use heightened dramatic expression, strong emphasis, and vivid character.',
  };

  const pauseDirectives: Record<string, string> = {
    tight: 'Keep pauses brief and crisp between sentences.',
    natural: 'Insert natural human breathing pauses at commas and sentence boundaries.',
    reflective: 'Allow thoughtful, unhurried pauses after key clauses and ideas.',
  };

  const acousticDirectives: Record<string, string> = {
    condenser_warm:
      'Vocal texture should sound like a close-mic large-diaphragm studio condenser: warm low-mids, clean presence, zero harshness.',
    broadcast_crisp:
      'Vocal texture should sound like a broadcast radio studio mic: forward, punchy, crystal-clear intelligibility.',
    audiobook_velvet:
      'Vocal texture should be smooth, velvety, and easy on the ear for long-form audiobook listening.',
    raw_studio: '',
  };

  const pitchDirectives: Record<string, string> = {
    deeper: 'Lean slightly lower and deeper in vocal pitch register with added chest resonance.',
    natural: '',
    brighter: 'Lean slightly lighter and brighter in vocal register with airy clarity.',
  };

  const parts = [baseStylePrompt.trim()];

  if (mood && moodDirectives[mood]) parts.push(moodDirectives[mood]);
  if (accent && accentDirectives[accent]) parts.push(accentDirectives[accent]);
  if (pace && paceDirectives[pace]) parts.push(paceDirectives[pace]);
  if (expressionLevel && expressionDirectives[expressionLevel]) {
    parts.push(expressionDirectives[expressionLevel]);
  }
  if (pauseRhythm && pauseDirectives[pauseRhythm]) {
    parts.push(pauseDirectives[pauseRhythm]);
  }
  if (acousticProfile && acousticDirectives[acousticProfile]) {
    parts.push(acousticDirectives[acousticProfile]);
  }
  if (pitchTilt && pitchDirectives[pitchTilt]) {
    parts.push(pitchDirectives[pitchTilt]);
  }

  if (hasUrduScript) {
    parts.push(
      'Pronounce all Urdu words with authentic Pakistani Urdu phonetics, clear aspirated consonants (بھ، پھ، تھ، کھ، گھ), crisp retroflexes (ٹ، ڈ، ڑ), and natural Urdu sentence intonation.'
    );
  }
  if (customDirection && customDirection.trim()) {
    parts.push(`Director note: ${customDirection.trim()}`);
  }
  parts.push(
    'Read the provided script strictly verbatim from start to finish exactly once, without repeating, skipping, or adding any line.'
  );

  return parts.join(' ');
}

function formatGeminiError(error: unknown): {
  status: number;
  message: string;
  quotaType?: 'daily' | 'minute';
  retryAfterSec?: number;
} {
  const err = error as { status?: number; message?: string };
  const rawMessage = err?.message || 'Unexpected error communicating with speech synthesis engine.';

  if (rawMessage.includes('API_KEY_INVALID') || rawMessage.includes('PERMISSION_DENIED')) {
    return {
      status: 403,
      message: 'API key permission issue. Please check your GEMINI_API_KEY in Settings > Secrets.',
    };
  }
  if (rawMessage.includes('RESOURCE_EXHAUSTED') || rawMessage.includes('429')) {
    console.error('[Gemini 429 Quota Detail]:', rawMessage);
    const retryAfterSec = extractRetryAfterSec(rawMessage);
    if (isDailyQuotaMessage(rawMessage)) {
      return {
        status: 429,
        quotaType: 'daily',
        retryAfterSec,
        message:
          'Daily free-tier Gemini TTS quota reached for today after heavy usage. Your saved audio is safe in Library—wait for the daily quota reset or select a billing-enabled API key in Settings > Secrets for uninterrupted hours.',
      };
    }
    return {
      status: 429,
      quotaType: 'minute',
      retryAfterSec: retryAfterSec ?? 25,
      message:
        'Per-minute rate limit reached. Cooling down automatically before retrying.',
    };
  }
  return {
    status: err?.status && err.status >= 400 && err.status < 600 ? err.status : 500,
    message: rawMessage,
  };
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function sanitizeTextForNeuralEngine(rawText: string): string {
  const cleaned = rawText
    .replace(/<(breath|gasp)>/gi, '، ')
    .replace(/<laugh>/gi, ' ')
    .replace(/\|(mhm|yeah)\|/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return escapeXml(cleaned);
}

function selectNeuralVoice(params: {
  baseVoice: BaseVoice;
  stylePrompt?: string;
  accent?: string;
  text: string;
}): string {
  const { baseVoice, stylePrompt, accent, text } = params;
  const styleLower = (stylePrompt || '').toLowerCase();
  const isFemale =
    baseVoice === 'Kore' ||
    baseVoice === 'Zephyr' ||
    /\bfemale\b|\bwoman\b|\balto\b|\bmezzo\b/.test(styleLower);

  const hasUrdu = /[\u0600-\u06FF]/.test(text);

  if (accent === 'international_english' || (!hasUrdu && accent === 'pakistani_english')) {
    return isFemale ? 'en-US-AriaNeural' : 'en-GB-RyanNeural';
  }
  if (!hasUrdu && !accent?.includes('urdu')) {
    // Pure English/Roman text when no explicit Urdu accent is chosen
    const looksRomanUrdu = /\b(hai|hain|nahi|kya|mein|aur|ko|ka|ki|ke|se|ap|aap|hum|tum|shukriya|salam)\b/i.test(
      text
    );
    if (!looksRomanUrdu) {
      return isFemale ? 'en-GB-SoniaNeural' : 'en-US-GuyNeural';
    }
  }

  if (accent === 'classical_adab') {
    return isFemale ? 'ur-IN-GulNeural' : 'ur-IN-SalmanNeural';
  }

  return isFemale ? 'ur-PK-UzmaNeural' : 'ur-PK-AsadNeural';
}

function mapNeuralProsody(params: {
  pace?: string;
  pitchTilt?: string;
  mood?: string;
  baseVoice: BaseVoice;
}): { rate: number; pitch: string } {
  const paceMap: Record<string, number> = {
    slow: 0.8,
    measured: 0.9,
    normal: 1.0,
    brisk: 1.15,
    fast: 1.3,
  };
  let rate = paceMap[params.pace || 'normal'] ?? 1.0;
  if (params.mood === 'calm' || params.mood === 'poetic' || params.mood === 'whisper') {
    rate = Math.max(0.75, Number((rate - 0.05).toFixed(2)));
  } else if (params.mood === 'horror') {
    rate = Math.max(0.72, Number((rate - 0.12).toFixed(2)));
  } else if (params.mood === 'scary') {
    rate = Math.max(0.74, Number((rate - 0.08).toFixed(2)));
  } else if (params.mood === 'feared') {
    rate = Math.min(1.4, Number((rate + 0.08).toFixed(2)));
  } else if (params.mood === 'energetic' || params.mood === 'news') {
    rate = Math.min(1.4, Number((rate + 0.04).toFixed(2)));
  }

  let pitchHz = 0;
  if (params.pitchTilt === 'deeper') pitchHz -= 12;
  if (params.pitchTilt === 'brighter') pitchHz += 12;
  if (params.baseVoice === 'Fenrir') pitchHz -= 6;
  if (params.baseVoice === 'Zephyr') pitchHz += 4;
  if (params.mood === 'dramatic') pitchHz -= 6;
  if (params.mood === 'horror') pitchHz -= 14;
  if (params.mood === 'scary') pitchHz -= 18;
  if (params.mood === 'feared') pitchHz += 10;
  if (params.mood === 'cheerful') pitchHz += 6;

  return {
    rate,
    pitch: `${pitchHz >= 0 ? '+' : ''}${pitchHz}Hz`,
  };
}

function mp3BufferToWav24kMono(mp3Buffer: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const ff = spawn('ffmpeg', [
      '-y',
      '-f',
      'mp3',
      '-i',
      'pipe:0',
      '-ar',
      '24000',
      '-ac',
      '1',
      '-c:a',
      'pcm_s16le',
      '-bitexact',
      '-map_metadata',
      '-1',
      '-f',
      'wav',
      'pipe:1',
    ]);
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    ff.stdout.on('data', (chunk: Buffer) => stdoutChunks.push(chunk));
    ff.stderr.on('data', (chunk: Buffer) => stderrChunks.push(chunk));
    ff.on('error', (err) => reject(err));
    ff.on('close', (code) => {
      if (code === 0) {
        resolve(Buffer.concat(stdoutChunks));
      } else {
        reject(new Error(`ffmpeg wav transcode failed: ${Buffer.concat(stderrChunks).toString()}`));
      }
    });
    ff.stdin.end(mp3Buffer);
  });
}

function splitNeuralSubChunks(text: string, maxChars = 750): string[] {
  const clean = text.trim();
  if (clean.length <= maxChars) return [clean];
  const sentences = clean
    .split(/(?<=[۔؟.!?])(?:\s+|(?=[A-Za-z0-9\u0600-\u06FF<|]))/)
    .map((s) => s.trim())
    .filter(Boolean);
  const out: string[] = [];
  let buf = '';
  for (const s of sentences) {
    if (s.length > maxChars) {
      if (buf) {
        out.push(buf.trim());
        buf = '';
      }
      const words = s.split(/\s+/);
      let wBuf = '';
      for (const w of words) {
        if ((wBuf + ' ' + w).length > maxChars && wBuf) {
          out.push(wBuf.trim());
          wBuf = w;
        } else {
          wBuf = wBuf ? `${wBuf} ${w}` : w;
        }
      }
      if (wBuf) out.push(wBuf.trim());
      continue;
    }
    if ((buf + ' ' + s).length > maxChars && buf) {
      out.push(buf.trim());
      buf = s;
    } else {
      buf = buf ? `${buf} ${s}` : s;
    }
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

function getFallbackVoiceChain(primaryVoice: string): string[] {
  const fallbacks: Record<string, string[]> = {
    'ur-PK-AsadNeural': ['ur-PK-AsadNeural', 'ur-PK-AsadNeural', 'ur-IN-SalmanNeural', 'ur-PK-AsadNeural'],
    'ur-PK-UzmaNeural': ['ur-PK-UzmaNeural', 'ur-PK-UzmaNeural', 'ur-IN-GulNeural', 'ur-PK-UzmaNeural'],
    'ur-IN-SalmanNeural': ['ur-IN-SalmanNeural', 'ur-IN-SalmanNeural', 'ur-PK-AsadNeural'],
    'ur-IN-GulNeural': ['ur-IN-GulNeural', 'ur-IN-GulNeural', 'ur-PK-UzmaNeural'],
    'en-US-AriaNeural': ['en-US-AriaNeural', 'en-US-AriaNeural', 'en-GB-SoniaNeural'],
    'en-GB-SoniaNeural': ['en-GB-SoniaNeural', 'en-GB-SoniaNeural', 'en-US-AriaNeural'],
    'en-GB-RyanNeural': ['en-GB-RyanNeural', 'en-GB-RyanNeural', 'en-US-GuyNeural'],
    'en-US-GuyNeural': ['en-US-GuyNeural', 'en-US-GuyNeural', 'en-GB-RyanNeural'],
  };
  return fallbacks[primaryVoice] || [primaryVoice, primaryVoice, primaryVoice];
}

async function synthesizeSingleNeuralSegment(
  rawSegment: string,
  neuralVoice: string,
  prosody: { rate: number; pitch: string }
): Promise<string> {
  const safeText = sanitizeTextForNeuralEngine(rawSegment);
  if (!safeText) return '';

  const voiceAttempts = getFallbackVoiceChain(neuralVoice);
  let lastErr: unknown;

  for (let i = 0; i < voiceAttempts.length; i++) {
    const attemptVoice = voiceAttempts[i];
    const tts = new MsEdgeTTS({
      connectionTimeoutMs: 12000,
      synthesisTimeoutMs: 45000,
    });

    try {
      await tts.setMetadata(attemptVoice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
      const streamOpts =
        prosody.rate === 1 && prosody.pitch === '+0Hz'
          ? {}
          : { rate: prosody.rate, pitch: prosody.pitch };

      const mp3Buf = await new Promise<Buffer>((resolve, reject) => {
        let settled = false;
        const { audioStream } = tts.toStream(safeText, streamOpts);
        const chunks: Buffer[] = [];
        audioStream.on('data', (chunk: Buffer) => {
          if (!settled) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          }
        });
        audioStream.on('error', (err: Error) => {
          if (!settled) {
            settled = true;
            reject(err);
          }
        });
        audioStream.on('close', () => {
          if (!settled) {
            settled = true;
            resolve(Buffer.concat(chunks));
          }
        });
      });

      if (mp3Buf.length === 0) {
        throw new Error('Unlimited neural engine returned empty audio.');
      }
      const wavBuf = await mp3BufferToWav24kMono(mp3Buf);
      return wavBuf.toString('base64');
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, 350 * (i + 1)));
    } finally {
      try {
        tts.close();
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  throw lastErr || new Error('Unlimited neural synthesis failed.');
}

async function synthesizeUnlimitedNeural(params: {
  text: string;
  baseVoice: BaseVoice;
  stylePrompt?: string;
  accent?: string;
  pace?: string;
  pitchTilt?: string;
  mood?: string;
  forceVoiceId?: string;
}): Promise<string> {
  const cleanedRaw = params.text.trim();
  if (!cleanedRaw) {
    throw new Error('No speakable text provided.');
  }

  const neuralVoice =
    params.forceVoiceId ||
    selectNeuralVoice({
      baseVoice: params.baseVoice,
      stylePrompt: params.stylePrompt,
      accent: params.accent,
      text: cleanedRaw,
    });

  const prosody = mapNeuralProsody({
    pace: params.pace,
    pitchTilt: params.pitchTilt,
    mood: params.mood,
    baseVoice: params.baseVoice,
  });

  const subSegments = splitNeuralSubChunks(cleanedRaw, 750);
  const wavList: string[] = [];
  for (const seg of subSegments) {
    const wavB64 = await synthesizeSingleNeuralSegment(seg, neuralVoice, prosody);
    if (wavB64) wavList.push(wavB64);
  }

  if (wavList.length === 0) {
    throw new Error('No speakable audio generated for this segment.');
  }
  return mergeServerWavBase64List(wavList);
}

function mergeServerWavBase64List(wavBase64List: string[]): string {
  if (wavBase64List.length === 0) return '';
  if (wavBase64List.length === 1) return wavBase64List[0];

  const pcmParts: Buffer[] = [];
  let headerTemplate: Buffer | null = null;

  for (const b64 of wavBase64List) {
    const buf = Buffer.from(b64, 'base64');
    const dataIdx = buf.indexOf(Buffer.from('data', 'ascii'));
    if (dataIdx >= 12 && dataIdx + 8 <= buf.length) {
      if (!headerTemplate) {
        headerTemplate = Buffer.from(buf.subarray(0, dataIdx + 8));
      }
      pcmParts.push(buf.subarray(dataIdx + 8));
    } else if (buf.length > 44) {
      if (!headerTemplate) headerTemplate = Buffer.from(buf.subarray(0, 44));
      pcmParts.push(buf.subarray(44));
    }
  }

  if (!headerTemplate || pcmParts.length === 0) return wavBase64List[0];

  const gap = Buffer.alloc(6720, 0); // 140ms pause at 24kHz 16-bit mono
  const joined: Buffer[] = [];
  pcmParts.forEach((p, idx) => {
    joined.push(p);
    if (idx < pcmParts.length - 1) joined.push(gap);
  });

  const allPcm = Buffer.concat(joined);
  const out = Buffer.concat([headerTemplate, allPcm]);
  out.writeUInt32LE(out.length - 8, 4);
  out.writeUInt32LE(allPcm.length, headerTemplate.length - 4);
  return out.toString('base64');
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '50mb' }));

  // 1. Analyze uploaded/recorded audio for Urdu/multilingual Voice Cloning
  app.post('/api/voices/analyze', async (req, res) => {
    try {
      const { audioBase64, mimeType, notes } = req.body as {
        audioBase64?: string;
        mimeType?: string;
        notes?: string;
      };

      if (!audioBase64 || !mimeType) {
        return res.status(400).json({ error: 'Audio recording data and MIME type are required.' });
      }

      const ai = getAiClient();
      const cleanMimeType = mimeType.split(';')[0].trim() || 'audio/webm';
      const audioPart = {
        inlineData: {
          mimeType: cleanMimeType,
          data: audioBase64,
        },
      };

      const [transcriptResult, profileResult] = await Promise.allSettled([
        withRetry(() =>
          ai.models.generateContent({
            model: 'gemini-3.5-transcribe',
            contents: {
              parts: [
                audioPart,
                {
                  text: 'Transcribe this audio accurately in its original script (use Urdu Nastaliq script for Urdu speech, and English script for English words).',
                },
              ],
            },
          })
        ),
        withRetry(() =>
          ai.models.generateContent({
            model: 'gemini-4-hydrogen',
            contents: {
              parts: [
                audioPart,
                {
                  text: `Listen carefully to the speaker's vocal acoustics, pitch, resonance, timbre, cadence, breathiness, and accent in this reference audio clip.${
                    notes ? ` User notes about this voice: ${notes}.` : ''
                  }
Map this speaker to the closest foundational synthesis timbre among these 5 voices:
- "Kore": Warm, balanced mid-range female timbre
- "Zephyr": Soft, bright, expressive lyrical female timbre
- "Puck": Engaging, energetic mid-to-bright male timbre
- "Charon": Deep, calm, steady baritone male timbre
- "Fenrir": Rich, commanding, low-register dramatic male timbre

Then craft a precise, highly detailed voice design instruction ("stylePrompt", 45-75 words) that instructs a neural voice design TTS engine how to faithfully replicate this exact speaker's voice quality, pitch register, Urdu/English articulation, cadence, warmth, and breathing rhythm.`,
                },
              ],
            },
            config: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  matchedBaseVoice: {
                    type: Type.STRING,
                    description: 'Must be strictly one of: Puck, Charon, Kore, Fenrir, Zephyr',
                  },
                  stylePrompt: {
                    type: Type.STRING,
                    description:
                      'Detailed acoustic and prosodic voice replication prompt (45-75 words) describing pitch, resonance, warmth, diction, Urdu/English accent, and rhythm.',
                  },
                  detectedLanguage: {
                    type: Type.STRING,
                    description: 'Primary spoken language(s), e.g., Urdu, Urdu & English, English',
                  },
                  genderTimbre: {
                    type: Type.STRING,
                    description: 'Short vocal register label, e.g., Warm Baritone Male, Clear Alto Female',
                  },
                  pitchProfile: {
                    type: Type.STRING,
                    description: 'Pitch characteristics, e.g., Medium-Low Steady, Expressive Mid-High',
                  },
                  paceProfile: {
                    type: Type.STRING,
                    description: 'Cadence and speed, e.g., Measured Conversational, Brisk & Crisp',
                  },
                  accentNotes: {
                    type: Type.STRING,
                    description: 'Articulation and regional accent profile, e.g., Urban Karachi Urdu',
                  },
                  timbreSummary: {
                    type: Type.STRING,
                    description: 'Concise 4-6 word summary of the cloned voice personality',
                  },
                },
                required: [
                  'matchedBaseVoice',
                  'stylePrompt',
                  'detectedLanguage',
                  'genderTimbre',
                  'pitchProfile',
                  'paceProfile',
                  'accentNotes',
                  'timbreSummary',
                ],
              },
            },
          })
        ),
      ]);

      const transcript =
        transcriptResult.status === 'fulfilled' ? (transcriptResult.value.text || '').trim() : '';

      if (profileResult.status === 'rejected') {
        throw profileResult.reason;
      }

      const rawJson = (profileResult.value.text || '{}').trim();
      const parsed = JSON.parse(rawJson);

      return res.json({
        transcript,
        profile: {
          baseVoice: sanitizeBaseVoice(parsed.matchedBaseVoice),
          stylePrompt: parsed.stylePrompt || 'Warm, natural Urdu and English speaking voice.',
          language: parsed.detectedLanguage || 'Urdu & English',
          genderTimbre: parsed.genderTimbre || 'Natural Vocal Timbre',
          pitchProfile: parsed.pitchProfile || 'Balanced Mid-Range',
          paceProfile: parsed.paceProfile || 'Natural Cadence',
          accentNotes: parsed.accentNotes || 'Standard Pakistani Urdu',
          timbreSummary: parsed.timbreSummary || 'Cloned natural speaking voice',
        },
      });
    } catch (error) {
      const { status, message } = formatGeminiError(error);
      return res.status(status).json({ error: message });
    }
  });

  // 2. Urdu Script Assist: Roman Urdu -> Urdu Script, Prosody Polish, or Pronunciation Diacritics
  app.post('/api/tts/script-assist', async (req, res) => {
    try {
      const { text, mode } = req.body as {
        text?: string;
        mode?: 'transliterate' | 'polish' | 'diacritics';
      };

      if (!text || !text.trim()) {
        return res.status(400).json({ error: 'Please enter some text first.' });
      }

      const ai = getAiClient();

      const instructions: Record<string, string> = {
        transliterate:
          'Convert the given Roman Urdu (or mixed Roman Urdu and English) text into natural, idiomatic Pakistani Urdu script (اردو). Add proper Urdu punctuation (، ۔ ؟) for natural speech pauses. Preserve vocal tags like <breath>, <laugh>, <gasp> if present. Return ONLY the converted Urdu text with no explanations.',
        polish:
          'Optimize the given Urdu (or Roman Urdu—convert Roman Urdu to Urdu script first) text for high-quality Text-to-Speech synthesis. Refine Urdu punctuation (، ۔ ؟) for natural phrasing and add subtle <breath> pauses at major sentence transitions if the passage is multi-sentence. Keep the exact meaning intact. Return ONLY the polished Urdu text.',
        diacritics:
          'Add selective Urdu aerab/diacritics (زبر، زیر، پیش، تشدید) ONLY where helpful to disambiguate pronunciation for Text-to-Speech (do not over-clutter obvious words). If input is Roman Urdu, convert to Urdu script first. Return ONLY the Urdu text.',
      };

      const response = await withRetry(() =>
        ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: text.trim(),
          config: {
            systemInstruction: instructions[mode || 'transliterate'],
          },
        })
      );

      const resultText = (response.text || '').trim();
      return res.json({ resultText });
    } catch (error) {
      const { status, message } = formatGeminiError(error);
      return res.status(status).json({ error: message });
    }
  });

  // 3. Single-Speaker Neural Urdu TTS & Cloned Voice Synthesis (supports unlimited multi-chunk streaming orchestration)
  app.post('/api/tts/synthesize', async (req, res) => {
    try {
      const {
        text,
        voiceName,
        stylePrompt,
        mood,
        accent,
        pace,
        expressionLevel,
        pauseRhythm,
        acousticProfile,
        pitchTilt,
        model,
        customDirection,
      } = req.body as {
        text?: string;
        voiceName?: string;
        stylePrompt?: string;
        mood?: string;
        accent?: string;
        pace?: string;
        expressionLevel?: string;
        pauseRhythm?: string;
        acousticProfile?: string;
        pitchTilt?: string;
        model?: string;
        customDirection?: string;
      };

      if (!text || !text.trim()) {
        return res.status(400).json({ error: 'Text script is required for speech synthesis.' });
      }

      const selectedVoice = sanitizeBaseVoice(voiceName);

      // Direct Unlimited Free Neural mode (zero API quota limits, 100,000+ words ready)
      if (model === 'unlimited-neural') {
        const wavBase64 = await synthesizeUnlimitedNeural({
          text: text.trim(),
          baseVoice: selectedVoice,
          stylePrompt,
          accent,
          pace,
          pitchTilt,
          mood,
        });
        return res.json({
          audioBase64: wavBase64,
          mimeType: 'audio/wav',
          modelUsed: 'unlimited-neural',
        });
      }

      const ai = getAiClient();
      const hasVocalTags = /<(breath|laugh|gasp)>|\|(mhm|yeah)\|/i.test(text);
      const primaryModel =
        hasVocalTags || model === 'gemini-3.8-flash-tts'
          ? 'gemini-3.8-flash-tts'
          : 'gemini-3.8-flash-lite-tts';

      const combinedStyle = buildDeliveryStyle({
        baseStylePrompt:
          stylePrompt || 'Warm, natural Urdu and English speaking voice with clear articulation.',
        mood,
        accent,
        pace,
        expressionLevel,
        pauseRhythm,
        acousticProfile,
        pitchTilt,
        customDirection,
        text,
      });

      const callTtsModel = (targetModel: string) =>
        ai.models.generateContent({
          model: targetModel,
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: text.trim(),
                  speechMetadata: {
                    style: combinedStyle,
                  },
                },
              ],
            },
          ],
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: selectedVoice },
              },
            },
          },
        });

      let chosenModel = primaryModel;
      let response;
      try {
        response = await withRetry(() => callTtsModel(chosenModel));
      } catch (primaryErr) {
        const primaryMsg = (primaryErr as { message?: string })?.message || '';
        const isQuotaErr = primaryMsg.includes('429') || primaryMsg.includes('RESOURCE_EXHAUSTED');
        const alternateModel =
          primaryModel === 'gemini-3.8-flash-tts'
            ? 'gemini-3.8-flash-lite-tts'
            : 'gemini-3.8-flash-tts';

        if (isQuotaErr) {
          if (!hasVocalTags) {
            try {
              chosenModel = alternateModel;
              response = await withRetry(() => callTtsModel(chosenModel), 1);
            } catch (secondaryErr) {
              const secMsg = (secondaryErr as { message?: string })?.message || '';
              if (secMsg.includes('429') || secMsg.includes('RESOURCE_EXHAUSTED')) {
                const wavBase64 = await synthesizeUnlimitedNeural({
                  text: text.trim(),
                  baseVoice: selectedVoice,
                  stylePrompt,
                  accent,
                  pace,
                  pitchTilt,
                  mood,
                });
                return res.json({
                  audioBase64: wavBase64,
                  mimeType: 'audio/wav',
                  modelUsed: 'unlimited-neural',
                  failoverReason: 'gemini-quota-reached',
                });
              }
              throw secondaryErr;
            }
          } else {
            const wavBase64 = await synthesizeUnlimitedNeural({
              text: text.trim(),
              baseVoice: selectedVoice,
              stylePrompt,
              accent,
              pace,
              pitchTilt,
              mood,
            });
            return res.json({
              audioBase64: wavBase64,
              mimeType: 'audio/wav',
              modelUsed: 'unlimited-neural',
              failoverReason: 'gemini-quota-reached',
            });
          }
        } else {
          throw primaryErr;
        }
      }

      const parts = response.candidates?.[0]?.content?.parts || [];
      const audioPart = parts.find((p) => p.inlineData?.data);
      const base64Audio = audioPart?.inlineData?.data;

      if (!base64Audio) {
        return res.status(502).json({
          error: 'No audio data was returned by the synthesis engine. Try adjusting your script.',
        });
      }

      return res.json({
        audioBase64: base64Audio,
        mimeType: audioPart?.inlineData?.mimeType || 'audio/wav',
        modelUsed: chosenModel,
      });
    } catch (error) {
      const formatted = formatGeminiError(error);
      return res.status(formatted.status).json({
        error: formatted.message,
        quotaType: formatted.quotaType,
        retryAfterSec: formatted.retryAfterSec,
      });
    }
  });

  // 4. Dual-Speaker Urdu / Multilingual Dialogue Synthesis
  app.post('/api/tts/dialogue', async (req, res) => {
    try {
      const { speakerA, speakerB, lines } = req.body as {
        speakerA?: { name: string; voiceName: string; stylePrompt: string };
        speakerB?: { name: string; voiceName: string; stylePrompt: string };
        lines?: Array<{ speaker: 'A' | 'B'; text: string }>;
      };

      if (!speakerA || !speakerB || !Array.isArray(lines) || lines.length === 0) {
        return res.status(400).json({ error: 'Two speakers and at least one dialogue line are required.' });
      }

      const validLines = lines.filter((l) => l.text && l.text.trim().length > 0);
      if (validLines.length === 0) {
        return res.status(400).json({ error: 'Please enter dialogue text before generating.' });
      }

      const ai = getAiClient();
      const speakerALabel = speakerA.name.trim() || 'Speaker A';
      const speakerBLabel =
        speakerB.name.trim() && speakerB.name.trim() !== speakerALabel
          ? speakerB.name.trim()
          : `${speakerB.name.trim() || 'Speaker'} B`;

      const parts = validLines.map((line) => {
        const isA = line.speaker === 'A';
        const label = isA ? speakerALabel : speakerBLabel;
        const style = buildDeliveryStyle({
          baseStylePrompt: isA ? speakerA.stylePrompt : speakerB.stylePrompt,
          mood: 'natural',
          text: line.text,
        });
        return {
          text: `${label}: ${line.text.trim()}`,
          speechMetadata: {
            speaker: label,
            style,
          },
        };
      });

      let response;
      try {
        response = await withRetry(() =>
          ai.models.generateContent({
            model: 'gemini-3.8-flash-tts',
            contents: [
              {
                role: 'user',
                parts,
              },
            ],
            config: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                multiSpeakerVoiceConfig: {
                  speakerVoiceConfigs: [
                    {
                      speaker: speakerALabel,
                      voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: sanitizeBaseVoice(speakerA.voiceName) },
                      },
                    },
                    {
                      speaker: speakerBLabel,
                      voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: sanitizeBaseVoice(speakerB.voiceName) },
                      },
                    },
                  ],
                },
              },
            },
          })
        );
      } catch (dlgErr) {
        const dlgMsg = (dlgErr as { message?: string })?.message || '';
        if (dlgMsg.includes('429') || dlgMsg.includes('RESOURCE_EXHAUSTED')) {
          const baseA = sanitizeBaseVoice(speakerA.voiceName);
          const baseB = sanitizeBaseVoice(speakerB.voiceName);
          const turnWavs: string[] = [];
          for (const line of validLines) {
            const isA = line.speaker === 'A';
            const wav = await synthesizeUnlimitedNeural({
              text: line.text.trim(),
              baseVoice: isA ? baseA : baseB,
              stylePrompt: isA ? speakerA.stylePrompt : speakerB.stylePrompt,
              forceVoiceId: !isA && baseA === baseB ? 'ur-PK-AsadNeural' : undefined,
            });
            turnWavs.push(wav);
          }
          return res.json({
            audioBase64: mergeServerWavBase64List(turnWavs),
            mimeType: 'audio/wav',
            modelUsed: 'unlimited-neural',
            failoverReason: 'gemini-quota-reached',
          });
        }
        throw dlgErr;
      }

      const resParts = response.candidates?.[0]?.content?.parts || [];
      const audioPart = resParts.find((p) => p.inlineData?.data);
      const base64Audio = audioPart?.inlineData?.data;

      if (!base64Audio) {
        return res.status(502).json({
          error: 'No dialogue audio was returned. Ensure your lines contain speakable text.',
        });
      }

      return res.json({
        audioBase64: base64Audio,
        mimeType: audioPart?.inlineData?.mimeType || 'audio/wav',
        modelUsed: 'gemini-3.8-flash-tts',
      });
    } catch (error) {
      const { status, message } = formatGeminiError(error);
      return res.status(status).json({ error: message });
    }
  });

  if (process.env.NODE_ENV === 'production') {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SadaStudio server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
