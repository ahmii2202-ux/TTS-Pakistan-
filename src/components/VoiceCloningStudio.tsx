import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  Loader2,
  Mic,
  Play,
  RotateCcw,
  Square,
  Upload,
} from 'lucide-react';
import { CLONING_CALIBRATION_PROMPT } from '../data/presets';
import { BaseVoiceName, VoiceProfile } from '../types/voice';
import { blobToBase64, formatTime } from '../utils/audio';
import { WaveformPlayer } from './WaveformPlayer';

interface VoiceCloningStudioProps {
  onVoiceCloned: (voice: VoiceProfile) => void;
  onUseInStudio: (voice: VoiceProfile) => void;
}

interface AnalyzedCloneResult {
  transcript: string;
  profile: {
    baseVoice: BaseVoiceName;
    stylePrompt: string;
    language: string;
    genderTimbre: string;
    pitchProfile: string;
    paceProfile: string;
    accentNotes: string;
    timbreSummary: string;
  };
}

export const VoiceCloningStudio: React.FC<VoiceCloningStudioProps> = ({
  onVoiceCloned,
  onUseInStudio,
}) => {
  const [captureMode, setCaptureMode] = useState<'record' | 'upload'>('record');
  const [voiceName, setVoiceName] = useState('');
  const [notes, setNotes] = useState('');

  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [liveLevels, setLiveLevels] = useState<number[]>(() => Array(28).fill(0.12));

  const [sampleBase64, setSampleBase64] = useState<string>('');
  const [sampleMimeType, setSampleMimeType] = useState<string>('audio/webm');
  const [sampleFileName, setSampleFileName] = useState<string>('');

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzed, setAnalyzed] = useState<AnalyzedCloneResult | null>(null);
  const [editableStylePrompt, setEditableStylePrompt] = useState('');
  const [savedVoice, setSavedVoice] = useState<VoiceProfile | null>(null);

  const [testPhrase, setTestPhrase] = useState(
    'السلام علیکم! یہ میری کلون کی گئی اردو آواز کا ٹیسٹ ہے، امید ہے آپ کو یہ قدرتی اور صاف سنائی دے رہی ہوگی۔'
  );
  const [isTesting, setIsTesting] = useState(false);
  const [testAudioBase64, setTestAudioBase64] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    return () => {
      cleanupRecordingResources();
    };
  }, []);

  const cleanupRecordingResources = () => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
  };

  const startRecording = async () => {
    setError(null);
    setAnalyzed(null);
    setSavedVoice(null);
    setTestAudioBase64(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : 'audio/mp4';

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: mimeType.split(';')[0] });
        const b64 = await blobToBase64(blob);
        setSampleBase64(b64);
        setSampleMimeType(mimeType.split(';')[0]);
        setSampleFileName('mic-recording.webm');
        cleanupRecordingResources();
      };

      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(dataArray);
        const bars = Array.from({ length: 28 }, (_, i) => {
          const val = dataArray[i % dataArray.length] || 0;
          return Math.max(0.1, Math.min(1, val / 210));
        });
        setLiveLevels(bars);
        animFrameRef.current = requestAnimationFrame(tick);
      };
      tick();

      setRecordSeconds(0);
      timerRef.current = window.setInterval(() => {
        setRecordSeconds((prev) => {
          if (prev >= 59) {
            stopRecording();
            return 60;
          }
          return prev + 1;
        });
      }, 1000);

      recorder.start(250);
      setIsRecording(true);
    } catch {
      setError(
        'Microphone access was denied or unavailable. Please allow microphone access or switch to Upload File.'
      );
      cleanupRecordingResources();
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    setLiveLevels(Array(28).fill(0.12));
  };

  const handleFileUpload = async (file: File) => {
    setError(null);
    setAnalyzed(null);
    setSavedVoice(null);
    setTestAudioBase64(null);

    if (file.size > 32 * 1024 * 1024) {
      setError('Audio file must be under 32 MB.');
      return;
    }

    try {
      const b64 = await blobToBase64(file);
      setSampleBase64(b64);
      setSampleMimeType(file.type || 'audio/wav');
      setSampleFileName(file.name);
      if (!voiceName.trim()) {
        const cleaned = file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ');
        setVoiceName(cleaned.slice(0, 32));
      }
    } catch {
      setError('Could not read the selected audio file.');
    }
  };

  const handleAnalyzeAndClone = async () => {
    if (!sampleBase64) {
      setError('Please record or upload a voice sample first.');
      return;
    }
    setError(null);
    setIsAnalyzing(true);
    setTestAudioBase64(null);

    try {
      const res = await fetch('/api/voices/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioBase64: sampleBase64,
          mimeType: sampleMimeType,
          notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Voice analysis failed.');
      }

      const result = data as AnalyzedCloneResult;
      setAnalyzed(result);
      setEditableStylePrompt(result.profile.stylePrompt);
      if (!voiceName.trim()) {
        setVoiceName(`Urdu Clone · ${result.profile.genderTimbre.split(' ')[0]}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze reference audio.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleTestClonedVoice = async () => {
    if (!analyzed || !testPhrase.trim()) return;
    setError(null);
    setIsTesting(true);

    try {
      const res = await fetch('/api/tts/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: testPhrase,
          voiceName: analyzed.profile.baseVoice,
          stylePrompt: editableStylePrompt || analyzed.profile.stylePrompt,
          mood: 'natural',
          pace: 'normal',
          model: 'gemini-3.8-flash-tts',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Test synthesis failed.');
      }
      setTestAudioBase64(data.audioBase64);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not synthesize test phrase.');
    } finally {
      setIsTesting(false);
    }
  };

  const buildVoiceObject = (): VoiceProfile | null => {
    if (!analyzed) return null;
    const finalName = voiceName.trim() || 'Cloned Urdu Voice';
    return {
      id: savedVoice?.id || `cloned-${Date.now()}`,
      name: finalName,
      origin: 'cloned',
      baseVoice: analyzed.profile.baseVoice,
      stylePrompt: editableStylePrompt.trim() || analyzed.profile.stylePrompt,
      language: analyzed.profile.language,
      genderTimbre: analyzed.profile.genderTimbre,
      pitchProfile: analyzed.profile.pitchProfile,
      paceProfile: analyzed.profile.paceProfile,
      accentNotes: analyzed.profile.accentNotes,
      timbreSummary: analyzed.profile.timbreSummary,
      sampleTranscript: analyzed.transcript,
      referenceAudioBase64: sampleBase64,
      referenceMimeType: sampleMimeType,
      createdAt: savedVoice?.createdAt || Date.now(),
    };
  };

  const handleSaveClone = () => {
    const voice = buildVoiceObject();
    if (!voice) return;
    setSavedVoice(voice);
    onVoiceCloned(voice);
  };

  return (
    <div className="max-w-6xl mx-auto w-full px-4 sm:px-8 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
          Urdu Voice Cloning Lab
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          Clone unlimited voices for free. Record 10–30 seconds of Urdu or English speech to capture vocal timbre, regional accent, and cadence.
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2.5 p-4 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-xl text-sm text-red-800 dark:text-red-200">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-red-600 dark:text-red-400" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left Column */}
        <div className="lg:col-span-5 bg-panel border border-line rounded-xl p-5 flex flex-col justify-between space-y-5">
          <div className="space-y-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                01. Capture Reference Voice
              </h2>
              <div className="flex items-center gap-1 p-1 bg-recessed rounded-lg border border-line">
                <button
                  type="button"
                  onClick={() => setCaptureMode('record')}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    captureMode === 'record'
                      ? 'bg-panel text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  Record Mic
                </button>
                <button
                  type="button"
                  onClick={() => setCaptureMode('upload')}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    captureMode === 'upload'
                      ? 'bg-panel text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  Upload File
                </button>
              </div>
            </div>

            {captureMode === 'record' ? (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-recessed border border-line space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span>Urdu Calibration Passage</span>
                    <span>Read naturally for 10–15s</span>
                  </div>
                  <p dir="rtl" className="font-urdu text-base text-slate-900 dark:text-slate-100 text-right">
                    {CLONING_CALIBRATION_PROMPT.urdu}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed pt-1 border-t border-line">
                    {CLONING_CALIBRATION_PROMPT.roman}
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-line bg-canvas/70 flex flex-col items-center gap-3">
                  <div className="w-full h-12 flex items-center justify-center gap-1 px-2">
                    {liveLevels.map((lvl, idx) => (
                      <div
                        key={idx}
                        className={`flex-1 rounded-full transition-all duration-75 ${
                          isRecording
                            ? 'bg-accent-bar'
                            : 'bg-slate-200 dark:bg-slate-700'
                        }`}
                        style={{ height: `${Math.round(lvl * 100)}%` }}
                      />
                    ))}
                  </div>

                  <div className="text-sm font-mono-tabular font-semibold text-slate-800 dark:text-slate-200">
                    {formatTime(recordSeconds)}
                  </div>

                  {!isRecording ? (
                    <button
                      type="button"
                      onClick={startRecording}
                      className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-accent hover:bg-accent-hover rounded-lg transition-colors whitespace-nowrap shrink-0"
                    >
                      <Mic className="w-4 h-4" />
                      <span>{sampleBase64 ? 'Re-Record Voice' : 'Start Recording'}</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={stopRecording}
                      className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
                    >
                      <Square className="w-3.5 h-3.5 fill-current" />
                      <span>Stop Recording</span>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <label className="block cursor-pointer border-2 border-dashed border-line hover:border-accent-bar rounded-xl p-6 text-center transition-colors bg-recessed/60">
                <input
                  type="file"
                  accept="audio/*"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file);
                  }}
                />
                <Upload className="w-6 h-6 text-slate-400 mx-auto mb-2" />
                <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  {sampleFileName ? sampleFileName : 'Select Urdu or English Audio File'}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  WAV, MP3, WEBM, M4A, or OGG (up to 32 MB)
                </div>
              </label>
            )}

            {sampleBase64 && (
              <WaveformPlayer
                audioBase64={sampleBase64}
                mimeType={sampleMimeType}
                title="Reference Voice Recording"
                subtitle={sampleFileName || 'Captured audio sample'}
                downloadName="reference-voice-sample.wav"
                compact
              />
            )}

            <div className="space-y-3 pt-1">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Voice Profile Name
                </label>
                <input
                  type="text"
                  value={voiceName}
                  onChange={(e) => setVoiceName(e.target.value)}
                  placeholder="e.g., Bilal (Lahori Storytelling)"
                  className="w-full px-3 py-2 text-sm bg-recessed border border-line rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-accent-bar"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Accent / Delivery Hint (Optional)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g., Soft Karachi Urdu accent, calm podcast tone"
                  className="w-full px-3 py-2 text-sm bg-recessed border border-line rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-accent-bar"
                />
              </div>
            </div>
          </div>

          <button
            type="button"
            disabled={!sampleBase64 || isAnalyzing || isRecording}
            onClick={handleAnalyzeAndClone}
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-accent hover:bg-accent-hover disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Extracting Voice DNA...</span>
              </>
            ) : (
              <span>Analyze & Clone Voice</span>
            )}
          </button>
        </div>

        {/* Right Column */}
        <div className="lg:col-span-7 bg-panel border border-line rounded-xl p-5 flex flex-col justify-between">
          {!analyzed ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-12 px-4 max-w-md mx-auto">
              <div className="w-11 h-11 rounded-full bg-recessed border border-line text-accent-ink flex items-center justify-center mb-3">
                <Mic className="w-5 h-5" />
              </div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                02. Acoustic Voice DNA & A/B Verification
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mt-2">
                Once you record or upload a voice sample and click Analyze & Clone Voice, SadaStudio extracts pitch register, timbre, regional Urdu cadence, and lets you A/B test the cloned voice before saving it to your free unlimited library.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-2 pb-3 border-b border-line">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  02. Extracted Acoustic Profile
                </h2>
                <button
                  type="button"
                  onClick={handleAnalyzeAndClone}
                  disabled={isAnalyzing}
                  className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Re-Analyze</span>
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-1">
                <div>
                  <div className="text-[11px] text-slate-400 dark:text-slate-500">Matched Timbre</div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                    {analyzed.profile.baseVoice}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-400 dark:text-slate-500">Vocal Register</div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                    {analyzed.profile.genderTimbre}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-400 dark:text-slate-500">Pitch & Pace</div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 mt-0.5 truncate">
                    {analyzed.profile.pitchProfile}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-400 dark:text-slate-500">Accent Profile</div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 mt-0.5 truncate">
                    {analyzed.profile.accentNotes}
                  </div>
                </div>
              </div>

              {analyzed.transcript && (
                <div className="pt-3 border-t border-line">
                  <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                    Detected Reference Transcript
                  </div>
                  <p
                    dir="auto"
                    className="text-sm text-slate-800 dark:text-slate-200 bg-recessed rounded-lg p-3 leading-relaxed font-urdu-compact"
                  >
                    {analyzed.transcript}
                  </p>
                </div>
              )}

              <div className="pt-3 border-t border-line">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                  Voice Design Replication Prompt (Editable)
                </label>
                <textarea
                  rows={3}
                  value={editableStylePrompt}
                  onChange={(e) => setEditableStylePrompt(e.target.value)}
                  className="w-full px-3 py-2 text-xs leading-relaxed bg-recessed border border-line rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:border-accent-bar"
                />
              </div>

              <div className="pt-3 border-t border-line space-y-3">
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Test Cloned Urdu Voice (A/B Compare with Original)
                </label>
                <div className="flex flex-col sm:flex-row gap-2.5">
                  <input
                    type="text"
                    dir="auto"
                    value={testPhrase}
                    onChange={(e) => setTestPhrase(e.target.value)}
                    className="flex-1 px-3 py-2 text-sm bg-recessed border border-line rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:border-accent-bar font-urdu-compact"
                  />
                  <button
                    type="button"
                    disabled={isTesting || !testPhrase.trim()}
                    onClick={handleTestClonedVoice}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-accent-ink bg-accent-soft border border-accent-border hover:opacity-90 disabled:opacity-50 rounded-lg transition-all whitespace-nowrap shrink-0"
                  >
                    {isTesting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Synthesizing...</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5" />
                        <span>Test Cloned Voice</span>
                      </>
                    )}
                  </button>
                </div>

                {testAudioBase64 && (
                  <WaveformPlayer
                    audioBase64={testAudioBase64}
                    title={`Cloned Output · ${voiceName.trim() || 'Preview'}`}
                    subtitle={`${analyzed.profile.baseVoice} timbre · Voice Design HD`}
                    downloadName="cloned-voice-test.wav"
                    autoPlay
                    compact
                  />
                )}
              </div>

              <div className="pt-4 border-t border-line flex flex-wrap items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={handleSaveClone}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 bg-recessed border border-line hover:border-accent-bar rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  {savedVoice ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-accent-ink" />
                      <span>Saved to Library</span>
                    </>
                  ) : (
                    <span>Save to Voice Library</span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const v = savedVoice || buildVoiceObject();
                    if (!v) return;
                    if (!savedVoice) {
                      setSavedVoice(v);
                      onVoiceCloned(v);
                    }
                    onUseInStudio(v);
                  }}
                  className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-accent hover:bg-accent-hover rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  <span>Open in Speech Studio</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
