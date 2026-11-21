import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowRightLeft,
  FileUp,
  Loader2,
  Mic,
  Pause,
  Play,
  RotateCcw,
  Square,
  Trash2,
  Volume2,
  Wand2,
} from 'lucide-react';
import {
  ACCENT_OPTIONS,
  ACOUSTIC_PROFILES,
  DELIVERY_MOODS,
  EXPRESSION_LEVELS,
  PAUSE_RHYTHMS,
  PITCH_TILTS,
  SPEAKING_PACES,
  URDU_SCRIPT_SAMPLES,
} from '../data/presets';
import {
  AccentOption,
  DeliveryMood,
  ExpressionLevel,
  GeneratedClip,
  PauseRhythm,
  PitchTilt,
  SpeakingPace,
  StudioAcousticProfile,
  TtsModelId,
  VoiceProfile,
} from '../types/voice';
import {
  analyzeAudioPeaks,
  formatTime,
  hasUrduScript,
  mergeWavBase64Chunks,
} from '../utils/audio';
import { countWords, splitTextIntoSpeechChunks } from '../utils/chunker';
import {
  clearSynthesisCheckpoint,
  getSynthesisCheckpoint,
  saveSynthesisCheckpoint,
  SynthesisCheckpoint,
} from '../utils/storage';
import { WaveformPlayer } from './WaveformPlayer';

const DRAFT_STORAGE_KEY = 'sadastudio_draft_v1';

interface SavedDraft {
  scriptText: string;
  mood: DeliveryMood;
  accent: AccentOption;
  pace: SpeakingPace;
  expressionLevel: ExpressionLevel;
  pauseRhythm: PauseRhythm;
  acousticProfile: StudioAcousticProfile;
  pitchTilt: PitchTilt;
  engine: TtsModelId;
  customDirection: string;
}

function loadDraft(): Partial<SavedDraft> {
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Partial<SavedDraft>) : {};
  } catch {
    return {};
  }
}

interface SpeechStudioProps {
  selectedVoice: VoiceProfile;
  onClipGenerated: (clip: GeneratedClip) => void;
  onOpenCloneStudio: () => void;
  onPreviewReferenceAudio: (voice: VoiceProfile) => void;
}

export const SpeechStudio: React.FC<SpeechStudioProps> = ({
  selectedVoice,
  onClipGenerated,
  onOpenCloneStudio,
  onPreviewReferenceAudio,
}) => {
  const initialDraft = useMemo(() => loadDraft(), []);

  const [scriptText, setScriptText] = useState<string>(
    initialDraft.scriptText ?? URDU_SCRIPT_SAMPLES[0].urduText
  );
  const [textDir, setTextDir] = useState<'auto' | 'rtl' | 'ltr'>('auto');

  // Professional Audio Rack State
  const [mood, setMood] = useState<DeliveryMood>(initialDraft.mood || 'storytelling');
  const [accent, setAccent] = useState<AccentOption>(initialDraft.accent || 'auto');
  const [pace, setPace] = useState<SpeakingPace>(initialDraft.pace || 'normal');
  const [expressionLevel, setExpressionLevel] = useState<ExpressionLevel>(
    initialDraft.expressionLevel || 'expressive'
  );
  const [pauseRhythm, setPauseRhythm] = useState<PauseRhythm>(
    initialDraft.pauseRhythm || 'natural'
  );
  const [acousticProfile, setAcousticProfile] = useState<StudioAcousticProfile>(
    initialDraft.acousticProfile || 'condenser_warm'
  );
  const [pitchTilt, setPitchTilt] = useState<PitchTilt>(initialDraft.pitchTilt || 'natural');
  const [engine, setEngine] = useState<TtsModelId>(
    initialDraft.engine || 'gemini-3.8-flash-lite-tts'
  );
  const [customDirection, setCustomDirection] = useState(initialDraft.customDirection || '');

  const [isAssisting, setIsAssisting] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [progressState, setProgressState] = useState<{
    completedChunks: number;
    totalChunks: number;
    completedWords: number;
    totalWords: number;
    cooldownSec?: number;
    statusNote?: string;
  } | null>(null);
  const [recoverableCheckpoint, setRecoverableCheckpoint] =
    useState<SynthesisCheckpoint | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [latestAudio, setLatestAudio] = useState<{
    base64: string;
    mimeType: string;
    voiceName: string;
    modelUsed: string;
    wordCount: number;
    chunksCount: number;
  } | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const cancelFlagRef = useRef(false);
  const pauseFlagRef = useRef(false);

  // Auto-save draft script & settings so refresh never loses text
  useEffect(() => {
    try {
      const payload: SavedDraft = {
        scriptText,
        mood,
        accent,
        pace,
        expressionLevel,
        pauseRhythm,
        acousticProfile,
        pitchTilt,
        engine,
        customDirection,
      };
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore quota errors on huge drafts; IndexedDB still holds active jobs
    }
  }, [
    scriptText,
    mood,
    accent,
    pace,
    expressionLevel,
    pauseRhythm,
    acousticProfile,
    pitchTilt,
    engine,
    customDirection,
  ]);

  // Recover any unfinished synthesis checkpoint on mount (e.g., after browser refresh)
  useEffect(() => {
    getSynthesisCheckpoint()
      .then((cp) => {
        if (cp && cp.wavChunks.length > 0 && cp.completedChunks < cp.totalChunks) {
          setRecoverableCheckpoint(cp);
          const recoveredAudio = mergeWavBase64Chunks(cp.wavChunks);
          setLatestAudio({
            base64: recoveredAudio,
            mimeType: 'audio/wav',
            voiceName: cp.voiceName,
            modelUsed: cp.modelUsed,
            wordCount: cp.processedWords,
            chunksCount: cp.wavChunks.length,
          });
          if (!localStorage.getItem(DRAFT_STORAGE_KEY)) {
            setScriptText(cp.sourceText);
          }
        }
      })
      .catch(() => {});
  }, []);

  const isUrdu = useMemo(() => hasUrduScript(scriptText), [scriptText]);
  const effectiveDir = textDir === 'auto' ? (isUrdu ? 'rtl' : 'ltr') : textDir;

  const wordCount = useMemo(() => countWords(scriptText), [scriptText]);
  const activeChunkSize = engine === 'unlimited-neural' ? 360 : 190;
  const plannedChunks = useMemo(
    () => splitTextIntoSpeechChunks(scriptText, activeChunkSize),
    [scriptText, activeChunkSize]
  );

  // Approx 135 words per minute in natural Urdu narration
  const estimatedSeconds = Math.max(1, Math.round((wordCount / 135) * 60));

  const insertCue = (cue: string) => {
    const el = textareaRef.current;
    if (!el) {
      setScriptText((prev) => `${prev.trim()} ${cue} `);
      return;
    }
    const start = el.selectionStart ?? scriptText.length;
    const end = el.selectionEnd ?? scriptText.length;
    const before = scriptText.slice(0, start);
    const after = scriptText.slice(end);
    const spacerBefore = before.length > 0 && !before.endsWith(' ') ? ' ' : '';
    const spacerAfter = after.length > 0 && !after.startsWith(' ') ? ' ' : '';
    const updated = `${before}${spacerBefore}${cue}${spacerAfter}${after}`;
    setScriptText(updated);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + spacerBefore.length + cue.length + spacerAfter.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const handleImportTextFile = async (file: File) => {
    setError(null);
    try {
      const content = await file.text();
      setScriptText(content);
    } catch {
      setError('Could not read text file. Ensure it is a valid UTF-8 .txt or .md file.');
    }
  };

  const handleScriptAssist = async (mode: 'transliterate' | 'polish' | 'diacritics') => {
    if (!scriptText.trim()) {
      setError('Enter Urdu or Roman Urdu text first.');
      return;
    }
    setError(null);
    setIsAssisting(mode);
    try {
      // Process in large blocks with pacing & 429 retry so huge scripts convert reliably
      const blocks = splitTextIntoSpeechChunks(scriptText, 700);
      const convertedBlocks: string[] = [];

      for (let idx = 0; idx < blocks.length; idx++) {
        const block = blocks[idx];
        if (idx > 0) {
          await new Promise((r) => setTimeout(r, 900));
        }

        let blockResult = '';
        for (let attempt = 0; attempt < 3; attempt++) {
          const res = await fetch('/api/tts/script-assist', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: block.text, mode }),
          });
          const data = await res.json();
          if (res.ok) {
            blockResult = data.resultText || '';
            break;
          }
          if (res.status === 429 && data.quotaType !== 'daily' && attempt < 2) {
            const waitMs = Math.max(15, data.retryAfterSec || 15) * 1000;
            await new Promise((r) => setTimeout(r, waitMs));
            continue;
          }
          throw new Error(data.error || 'Failed to process script.');
        }

        if (blockResult) {
          convertedBlocks.push(blockResult);
        }
      }

      if (convertedBlocks.length > 0) {
        setScriptText(convertedBlocks.join('\n\n'));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Script conversion failed.');
    } finally {
      setIsAssisting(null);
    }
  };

  const waitInterruptible = async (ms: number, onTickSec?: (remainingSec: number) => void) => {
    const start = Date.now();
    while (Date.now() - start < ms) {
      if (cancelFlagRef.current) return false;
      if (onTickSec) {
        const left = Math.max(0, Math.ceil((ms - (Date.now() - start)) / 1000));
        onTickSec(left);
      }
      await new Promise((r) => setTimeout(r, 300));
    }
    return !cancelFlagRef.current;
  };

  const runSynthesis = async (resumeCheckpoint?: SynthesisCheckpoint | null) => {
    if (isGenerating) return;
    const sourceText = resumeCheckpoint ? resumeCheckpoint.sourceText : scriptText;
    if (!sourceText.trim()) {
      setError('Please enter Urdu or English text to synthesize.');
      return;
    }

    const chunkWordLimit = resumeCheckpoint
      ? resumeCheckpoint.chunkWordLimit || 190
      : activeChunkSize;
    const chunks = splitTextIntoSpeechChunks(sourceText, chunkWordLimit);
    if (chunks.length === 0) return;

    cancelFlagRef.current = false;
    pauseFlagRef.current = false;
    setIsPaused(false);
    setError(null);
    setRecoverableCheckpoint(null);
    setIsGenerating(true);

    const totalWords = chunks.reduce((acc, c) => acc + c.wordCount, 0);
    const clipId = resumeCheckpoint?.clipId || `clip-${Date.now()}`;
    const startIndex = resumeCheckpoint ? resumeCheckpoint.completedChunks : 0;
    const synthesizedWavChunks: string[] = resumeCheckpoint
      ? [...resumeCheckpoint.wavChunks]
      : [];
    let processedWords = resumeCheckpoint ? resumeCheckpoint.processedWords : 0;

    const activeVoiceId = resumeCheckpoint?.voiceId || selectedVoice.id;
    const activeVoiceName = resumeCheckpoint?.voiceName || selectedVoice.name;
    const activeBaseVoice = resumeCheckpoint?.baseVoice || selectedVoice.baseVoice;
    const activeStylePrompt = resumeCheckpoint?.stylePrompt || selectedVoice.stylePrompt;
    const activeMood = resumeCheckpoint?.mood || mood;
    const activeAccent = resumeCheckpoint?.accent || accent;
    const activePace = resumeCheckpoint?.pace || pace;
    const activeExpression = resumeCheckpoint?.expressionLevel || expressionLevel;
    const activePause = resumeCheckpoint?.pauseRhythm || pauseRhythm;
    const activeAcoustic = resumeCheckpoint?.acousticProfile || acousticProfile;
    const activePitch = resumeCheckpoint?.pitchTilt || pitchTilt;
    const activeCustomDir = resumeCheckpoint?.customDirection ?? customDirection;

    const preferredModel: TtsModelId =
      (resumeCheckpoint?.modelUsed as TtsModelId) ||
      (engine === 'unlimited-neural'
        ? 'unlimited-neural'
        : selectedVoice.origin === 'cloned'
        ? 'gemini-3.8-flash-tts'
        : engine);
    let activeRunModel: TtsModelId = preferredModel;
    let lastModelUsed: TtsModelId = preferredModel;
    let lastCompletedIndex = startIndex - 1;
    let failoverNotice: string | undefined;

    setProgressState({
      completedChunks: startIndex,
      totalChunks: chunks.length,
      completedWords: processedWords,
      totalWords,
    });

    const persistClipAndCheckpoint = async (completedCount: number, mergedWav: string) => {
      const checkpoint: SynthesisCheckpoint = {
        id: 'active_job',
        clipId,
        sourceText: sourceText.trim(),
        voiceId: activeVoiceId,
        voiceName: activeVoiceName,
        baseVoice: activeBaseVoice,
        stylePrompt: activeStylePrompt,
        mood: activeMood,
        accent: activeAccent,
        pace: activePace,
        expressionLevel: activeExpression,
        pauseRhythm: activePause,
        acousticProfile: activeAcoustic,
        pitchTilt: activePitch,
        modelUsed: lastModelUsed,
        customDirection: activeCustomDir,
        totalChunks: chunks.length,
        totalWords,
        completedChunks: completedCount,
        processedWords,
        chunkWordLimit,
        wavChunks: [...synthesizedWavChunks],
        updatedAt: Date.now(),
      };

      await saveSynthesisCheckpoint(checkpoint).catch(() => {});

      const { durationSec } = await analyzeAudioPeaks(mergedWav, 'audio/wav', 48);
      await onClipGenerated({
        id: clipId,
        mode: 'single',
        voiceId: activeVoiceId,
        voiceName: activeVoiceName,
        text: sourceText.trim(),
        wordCount: processedWords,
        mood: activeMood,
        accent: activeAccent,
        modelUsed: lastModelUsed,
        audioBase64: mergedWav,
        mimeType: 'audio/wav',
        durationSec,
        createdAt: Date.now(),
      });

      return checkpoint;
    };

    try {
      for (let i = startIndex; i < chunks.length; i++) {
        while (pauseFlagRef.current && !cancelFlagRef.current) {
          await new Promise((r) => setTimeout(r, 250));
        }
        if (cancelFlagRef.current) break;

        const chunk = chunks[i];

        if (i > startIndex && chunks.length > 2 && activeRunModel !== 'unlimited-neural') {
          setProgressState({
            completedChunks: i,
            totalChunks: chunks.length,
            completedWords: processedWords,
            totalWords,
            statusNote: 'Pacing requests smoothly for long-form stability...',
          });
          const ok = await waitInterruptible(1400);
          if (!ok) break;
        }

        let chunkSuccess = false;
        let modelForChunk: TtsModelId = activeRunModel;
        const cooldownScheduleSec = [20, 40, 60, 90];

        for (let attempt = 0; attempt <= cooldownScheduleSec.length; attempt++) {
          if (cancelFlagRef.current) break;

          setProgressState({
            completedChunks: i,
            totalChunks: chunks.length,
            completedWords: processedWords,
            totalWords,
            statusNote:
              failoverNotice ||
              (modelForChunk === 'unlimited-neural'
                ? `Unlimited Free Neural engine · segment ${i + 1} of ${chunks.length}...`
                : `Synthesizing segment ${i + 1} of ${chunks.length}...`),
          });

          const res = await fetch('/api/tts/synthesize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: chunk.text,
              voiceName: activeBaseVoice,
              stylePrompt: activeStylePrompt,
              mood: activeMood,
              accent: activeAccent,
              pace: activePace,
              expressionLevel: activeExpression,
              pauseRhythm: activePause,
              acousticProfile: activeAcoustic,
              pitchTilt: activePitch,
              model: modelForChunk,
              customDirection: activeCustomDir,
            }),
          });

          const data = await res.json();
          if (res.ok) {
            synthesizedWavChunks.push(data.audioBase64 as string);
            lastModelUsed = (data.modelUsed as TtsModelId) || modelForChunk;
            if (data.failoverReason === 'gemini-quota-reached') {
              activeRunModel = 'unlimited-neural';
              failoverNotice =
                'Gemini daily limit reached — seamlessly continuing with Unlimited Free Neural engine';
            }
            processedWords += chunk.wordCount;
            lastCompletedIndex = i;
            chunkSuccess = true;
            break;
          }

          const isRateLimit = res.status === 429;
          const isDailyExhausted = data.quotaType === 'daily';
          if (isRateLimit && !isDailyExhausted && attempt < cooldownScheduleSec.length) {
            const hasVocalTags = /<(breath|laugh|gasp)>|\|(mhm|yeah)\|/i.test(chunk.text);
            if (!hasVocalTags && modelForChunk === 'gemini-3.8-flash-tts') {
              modelForChunk = 'gemini-3.8-flash-lite-tts';
            } else if (!hasVocalTags && modelForChunk === 'gemini-3.8-flash-lite-tts') {
              modelForChunk = 'gemini-3.8-flash-tts';
            }

            const hintedSec =
              typeof data.retryAfterSec === 'number' && data.retryAfterSec > 0
                ? data.retryAfterSec
                : 0;
            const waitSec = Math.max(cooldownScheduleSec[attempt], hintedSec);
            const resumed = await waitInterruptible(waitSec * 1000, (leftSec) => {
              setProgressState({
                completedChunks: i,
                totalChunks: chunks.length,
                completedWords: processedWords,
                totalWords,
                cooldownSec: leftSec,
                statusNote: `Per-minute rate limit cooldown — auto-resuming segment ${i + 1}/${chunks.length} in ${leftSec}s`,
              });
            });
            if (!resumed) break;
            continue;
          }

          throw new Error(
            data.error || `Speech synthesis failed at segment ${i + 1} of ${chunks.length}.`
          );
        }

        if (!chunkSuccess) break;

        setProgressState({
          completedChunks: i + 1,
          totalChunks: chunks.length,
          completedWords: processedWords,
          totalWords,
        });

        const mergedSoFar = mergeWavBase64Chunks(synthesizedWavChunks);
        setLatestAudio({
          base64: mergedSoFar,
          mimeType: 'audio/wav',
          voiceName: activeVoiceName,
          modelUsed: lastModelUsed,
          wordCount: processedWords,
          chunksCount: synthesizedWavChunks.length,
        });

        // Save checkpoint + Library entry after EVERY chunk so refresh never loses anything
        const savedCp = await persistClipAndCheckpoint(i + 1, mergedSoFar);
        if (i + 1 < chunks.length) {
          setRecoverableCheckpoint(savedCp);
        }
      }

      if (lastCompletedIndex >= chunks.length - 1) {
        setRecoverableCheckpoint(null);
        await clearSynthesisCheckpoint().catch(() => {});
      }
    } catch (err) {
      if (synthesizedWavChunks.length > 0) {
        const partial = mergeWavBase64Chunks(synthesizedWavChunks);
        setLatestAudio({
          base64: partial,
          mimeType: 'audio/wav',
          voiceName: activeVoiceName,
          modelUsed: lastModelUsed,
          wordCount: processedWords,
          chunksCount: synthesizedWavChunks.length,
        });
        const savedCp = await persistClipAndCheckpoint(lastCompletedIndex + 1, partial);
        if (lastCompletedIndex + 1 < chunks.length) {
          setRecoverableCheckpoint(savedCp);
        }
      }
      setError(err instanceof Error ? err.message : 'Failed to generate speech.');
    } finally {
      setIsGenerating(false);
      setIsPaused(false);
      setProgressState(null);
    }
  };

  const handleSynthesize = () => runSynthesis(null);

  const handleDiscardCheckpoint = async () => {
    setRecoverableCheckpoint(null);
    await clearSynthesisCheckpoint().catch(() => {});
  };

  const togglePauseGeneration = () => {
    const next = !pauseFlagRef.current;
    pauseFlagRef.current = next;
    setIsPaused(next);
  };

  const stopGeneration = () => {
    cancelFlagRef.current = true;
    pauseFlagRef.current = false;
    setIsPaused(false);
  };

  return (
    <div className="flex-1 flex flex-col xl:flex-row min-h-0">
      {/* Center Pane: Unlimited Script & Book Editor + Output Player */}
      <div className="flex-1 min-w-0 p-4 sm:p-6 space-y-5 overflow-y-auto">
        {/* Selected Voice Header Strip */}
        <div className="bg-panel border border-line rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span>{selectedVoice.origin === 'cloned' ? 'Cloned Voice' : 'Studio Voice'}</span>
              <span aria-hidden="true">·</span>
              <span>{selectedVoice.genderTimbre}</span>
              <span aria-hidden="true">·</span>
              <span>{selectedVoice.accentNotes}</span>
            </div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight truncate mt-0.5">
              {selectedVoice.name}
            </h1>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {selectedVoice.origin === 'cloned' && selectedVoice.referenceAudioBase64 && (
              <button
                type="button"
                onClick={() => onPreviewReferenceAudio(selectedVoice)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-recessed hover:opacity-90 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span>Original Sample</span>
              </button>
            )}
            <button
              type="button"
              onClick={onOpenCloneStudio}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-accent-ink bg-accent-soft border border-accent-border hover:opacity-90 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Mic className="w-3.5 h-3.5" />
              <span>Clone Voice</span>
            </button>
          </div>
        </div>

        {/* Script Surface */}
        <div className="bg-panel border border-line rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-line flex flex-wrap items-center justify-between gap-2.5 bg-recessed/55">
            <div className="flex flex-wrap items-center gap-1.5">
              {URDU_SCRIPT_SAMPLES.map((sample) => (
                <button
                  key={sample.id}
                  type="button"
                  onClick={() => {
                    setScriptText(sample.urduText);
                    setMood(sample.recommendedMood);
                  }}
                  className="px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-300 bg-panel border border-line hover:border-accent-bar hover:text-accent-ink rounded-md transition-colors whitespace-nowrap shrink-0"
                >
                  {sample.label}
                </button>
              ))}
              <label className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-300 bg-panel border border-line hover:border-accent-bar hover:text-accent-ink rounded-md cursor-pointer transition-colors whitespace-nowrap shrink-0">
                <FileUp className="w-3.5 h-3.5" />
                <span>Import .TXT</span>
                <input
                  type="file"
                  accept=".txt,.md,text/plain"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleImportTextFile(f);
                  }}
                />
              </label>
            </div>

            <div className="flex items-center gap-2">
              {scriptText.length > 0 && (
                <button
                  type="button"
                  onClick={() => setScriptText('')}
                  className="p-1.5 text-slate-400 hover:text-red-500 rounded-md transition-colors"
                  title="Clear script"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
              <div className="flex items-center gap-0.5 p-0.5 bg-recessed rounded-lg">
                {(['auto', 'rtl', 'ltr'] as const).map((dir) => (
                  <button
                    key={dir}
                    type="button"
                    onClick={() => setTextDir(dir)}
                    className={`px-2 py-1 text-[11px] font-medium uppercase rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      textDir === dir
                        ? 'bg-panel text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    {dir}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="p-4 sm:p-5">
            <textarea
              ref={textareaRef}
              value={scriptText}
              onChange={(e) => setScriptText(e.target.value)}
              dir={effectiveDir}
              rows={8}
              placeholder="یہاں جتنے چاہیں الفاظ لکھیں — چاہے ایک جملہ ہو یا 100,000 الفاظ کی پوری کتاب۔۔۔ (Write unlimited Urdu, Roman Urdu, or English text)"
              className={`w-full resize-y min-h-[210px] bg-transparent text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none ${
                effectiveDir === 'rtl'
                  ? 'font-urdu text-lg sm:text-xl text-right'
                  : 'text-base leading-relaxed'
              }`}
            />

            {/* Smart Script Tools + Unlimited Counter */}
            <div className="mt-4 pt-4 border-t border-line flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={isAssisting !== null || isGenerating}
                  onClick={() => handleScriptAssist('transliterate')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-accent-ink bg-accent-soft border border-accent-border hover:opacity-90 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  {isAssisting === 'transliterate' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                  )}
                  <span>Roman Urdu → اردو</span>
                </button>

                <button
                  type="button"
                  disabled={isAssisting !== null || isGenerating}
                  onClick={() => handleScriptAssist('polish')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-recessed hover:opacity-90 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  {isAssisting === 'polish' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Wand2 className="w-3.5 h-3.5" />
                  )}
                  <span>Polish Prosody</span>
                </button>

                <button
                  type="button"
                  disabled={isAssisting !== null || isGenerating}
                  onClick={() => handleScriptAssist('diacritics')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-recessed hover:opacity-90 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  {isAssisting === 'diacritics' && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  )}
                  <span>Add Aerab (اعراب)</span>
                </button>

                <div className="flex items-center gap-1">
                  {(['<breath>', '<laugh>', '<gasp>', '|mhm|', '|yeah|'] as const).map((cue) => (
                    <button
                      key={cue}
                      type="button"
                      onClick={() => insertCue(cue)}
                      className="px-2 py-1 text-[11px] font-mono text-slate-600 dark:text-slate-400 bg-recessed border border-line hover:border-accent-bar hover:text-accent-ink rounded-md transition-colors whitespace-nowrap shrink-0"
                      title={`Insert ${cue} vocal cue`}
                    >
                      {cue}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs font-mono-tabular text-slate-500 dark:text-slate-400">
                <span>{wordCount.toLocaleString()} words</span>
                <span aria-hidden="true">·</span>
                <span>{plannedChunks.length} {plannedChunks.length === 1 ? 'part' : 'parts'}</span>
                <span aria-hidden="true">·</span>
                <span>~{formatTime(estimatedSeconds)}</span>
              </div>
            </div>
          </div>

          {/* Primary Action Bar */}
          <div className="px-4 sm:px-5 py-3.5 border-t border-line bg-recessed/55 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Unlimited words · Auto-chunked & stitched into one seamless 24kHz WAV
            </div>

            <div className="flex items-center gap-2.5 ml-auto">
              {isGenerating && (
                <>
                  <button
                    type="button"
                    onClick={togglePauseGeneration}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-panel border border-line rounded-lg transition-colors whitespace-nowrap shrink-0"
                  >
                    {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                    <span>{isPaused ? 'Resume' : 'Pause'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={stopGeneration}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900 rounded-lg transition-colors whitespace-nowrap shrink-0"
                  >
                    <Square className="w-3 h-3 fill-current" />
                    <span>Stop</span>
                  </button>
                </>
              )}

              <button
                type="button"
                disabled={isGenerating || !scriptText.trim()}
                onClick={handleSynthesize}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-accent hover:bg-accent-hover disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>
                      {progressState && progressState.totalChunks > 1
                        ? `Synthesizing ${progressState.completedChunks}/${progressState.totalChunks}...`
                        : 'Synthesizing...'}
                    </span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    <span>Generate Speech</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Multi-Chunk Long-Form Progress Bar */}
        {progressState && progressState.totalChunks > 1 && (
          <div className="bg-panel border border-line rounded-xl p-4 space-y-2.5">
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="font-medium text-slate-800 dark:text-slate-200">
                {isPaused
                  ? 'Synthesis paused — click Resume or Stop to keep completed audio'
                  : progressState.statusNote ||
                    `Processing long-form script (${progressState.completedChunks} of ${progressState.totalChunks} segments)`}
              </span>
              <span className="font-mono-tabular text-slate-500 dark:text-slate-400 shrink-0">
                {progressState.completedWords.toLocaleString()} /{' '}
                {progressState.totalWords.toLocaleString()} words
              </span>
            </div>
            <div className="w-full h-2 bg-recessed rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  progressState.cooldownSec ? 'bg-amber-500' : 'bg-accent-bar'
                }`}
                style={{
                  width: `${Math.max(
                    3,
                    Math.round((progressState.completedChunks / progressState.totalChunks) * 100)
                  )}%`,
                }}
              />
            </div>
          </div>
        )}

        {error && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-xl text-sm text-red-800 dark:text-red-200">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-red-600 dark:text-red-400" />
              <span>{error}</span>
            </div>
            {recoverableCheckpoint && !isGenerating && (
              <button
                type="button"
                onClick={() => runSynthesis(recoverableCheckpoint)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-accent hover:bg-accent-hover rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>
                  Resume ({recoverableCheckpoint.completedChunks}/{recoverableCheckpoint.totalChunks})
                </span>
              </button>
            )}
          </div>
        )}

        {recoverableCheckpoint && !isGenerating && (
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl text-xs text-amber-900 dark:text-amber-200">
            <span>
              Safely saved {recoverableCheckpoint.processedWords.toLocaleString()} of{' '}
              {recoverableCheckpoint.totalWords.toLocaleString()} words (
              {recoverableCheckpoint.completedChunks}/{recoverableCheckpoint.totalChunks} segments) in Library — resume to stitch the remaining audio into one file.
            </span>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleDiscardCheckpoint}
                className="px-3 py-1.5 text-xs font-medium text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50 rounded-lg transition-colors whitespace-nowrap"
              >
                Dismiss
              </button>
              <button
                type="button"
                onClick={() => runSynthesis(recoverableCheckpoint)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-accent hover:bg-accent-hover rounded-lg transition-colors whitespace-nowrap"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Resume Remaining Audio</span>
              </button>
            </div>
          </div>
        )}

        {latestAudio && (
          <WaveformPlayer
            audioBase64={latestAudio.base64}
            mimeType={latestAudio.mimeType}
            title={`Master Output · ${latestAudio.voiceName}`}
            subtitle={`${mood} · ${latestAudio.wordCount.toLocaleString()} words · ${latestAudio.chunksCount} ${
              latestAudio.chunksCount === 1 ? 'segment' : 'stitched segments'
            } · 24kHz WAV`}
            downloadName={`sadastudio-${latestAudio.voiceName.toLowerCase().replace(/\s+/g, '-')}.wav`}
            autoPlay={!isGenerating}
          />
        )}
      </div>

      {/* Right Pane: Professional Acoustic & Expression Rack */}
      <aside className="w-full xl:w-[330px] shrink-0 border-t xl:border-t-0 xl:border-l border-line bg-panel p-4 sm:p-5 space-y-5 overflow-y-auto">
        <div>
          <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400 tracking-wide mb-2.5">
            Accent & Dialect
          </h2>
          <select
            value={accent}
            onChange={(e) => setAccent(e.target.value as AccentOption)}
            className="w-full px-3 py-2 text-xs font-medium bg-recessed border border-line rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:border-accent-bar"
          >
            {ACCENT_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">
            {ACCENT_OPTIONS.find((a) => a.id === accent)?.description}
          </p>
        </div>

        <div className="pt-4 border-t border-line">
          <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400 tracking-wide mb-2.5">
            Mood & Emotion
          </h2>
          <div className="grid grid-cols-2 gap-1.5">
            {DELIVERY_MOODS.map((m) => {
              const isHorrorMood =
                m.id === 'horror' || m.id === 'scary' || m.id === 'feared';
              const isActive = mood === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMood(m.id)}
                  title={m.hint}
                  className={`px-2.5 py-2 text-xs font-medium rounded-lg border text-left transition-colors truncate ${
                    isActive
                      ? isHorrorMood
                        ? 'bg-rose-700 border-rose-700 text-white'
                        : 'bg-accent border-accent text-white'
                      : 'bg-recessed/70 border-line text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="pt-4 border-t border-line space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
              Expression Intensity
            </label>
            <div className="grid grid-cols-4 gap-1 p-1 bg-recessed rounded-lg">
              {EXPRESSION_LEVELS.map((lvl) => (
                <button
                  key={lvl.id}
                  type="button"
                  onClick={() => setExpressionLevel(lvl.id)}
                  className={`py-1.5 px-1 text-[11px] font-medium rounded-md transition-colors truncate ${
                    expressionLevel === lvl.id
                      ? 'bg-panel text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {lvl.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
              Speaking Speed
            </label>
            <div className="grid grid-cols-5 gap-1 p-1 bg-recessed rounded-lg">
              {SPEAKING_PACES.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPace(p.id)}
                  className={`py-1.5 text-[11px] font-mono-tabular font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    pace === p.id
                      ? 'bg-panel text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
              Pause & Breathing Rhythm
            </label>
            <div className="grid grid-cols-3 gap-1 p-1 bg-recessed rounded-lg">
              {PAUSE_RHYTHMS.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setPauseRhythm(r.id)}
                  className={`py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    pauseRhythm === r.id
                      ? 'bg-panel text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-line space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
              Voice Quality & Acoustic Polish
            </label>
            <select
              value={acousticProfile}
              onChange={(e) => setAcousticProfile(e.target.value as StudioAcousticProfile)}
              className="w-full px-3 py-2 text-xs font-medium bg-recessed border border-line rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:border-accent-bar"
            >
              {ACOUSTIC_PROFILES.map((ap) => (
                <option key={ap.id} value={ap.id}>
                  {ap.label} — {ap.detail}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
              Vocal Register Tilt
            </label>
            <div className="grid grid-cols-3 gap-1 p-1 bg-recessed rounded-lg">
              {PITCH_TILTS.map((pt) => (
                <button
                  key={pt.id}
                  type="button"
                  onClick={() => setPitchTilt(pt.id)}
                  className={`py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    pitchTilt === pt.id
                      ? 'bg-panel text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {pt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
              Synthesis Engine
            </label>
            <div className="grid grid-cols-3 gap-1 p-1 bg-recessed rounded-lg">
              <button
                type="button"
                onClick={() => setEngine('unlimited-neural')}
                className={`py-1.5 px-1.5 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  engine === 'unlimited-neural'
                    ? 'bg-panel text-accent-ink shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                Unlimited Free
              </button>
              <button
                type="button"
                disabled={selectedVoice.origin === 'cloned'}
                onClick={() => setEngine('gemini-3.8-flash-lite-tts')}
                className={`py-1.5 px-1.5 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap shrink-0 disabled:opacity-45 ${
                  selectedVoice.origin !== 'cloned' && engine === 'gemini-3.8-flash-lite-tts'
                    ? 'bg-panel text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                Gemini Fast
              </button>
              <button
                type="button"
                onClick={() => setEngine('gemini-3.8-flash-tts')}
                className={`py-1.5 px-1.5 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  engine === 'gemini-3.8-flash-tts' ||
                  (selectedVoice.origin === 'cloned' && engine !== 'unlimited-neural')
                    ? 'bg-panel text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                Gemini HD
              </button>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">
              Auto-switches to Unlimited Free if Gemini quota fills so 100,000+ words never stop.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
              Director Note (Optional)
            </label>
            <input
              type="text"
              value={customDirection}
              onChange={(e) => setCustomDirection(e.target.value)}
              placeholder="e.g., Soft late-night radio feel"
              className="w-full px-3 py-2 text-xs bg-recessed border border-line rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-accent-bar"
            />
          </div>
        </div>
      </aside>
    </div>
  );
};
