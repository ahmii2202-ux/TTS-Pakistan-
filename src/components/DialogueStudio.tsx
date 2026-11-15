import React, { useState } from 'react';
import { AlertCircle, Loader2, Play, Plus, Trash2 } from 'lucide-react';
import { DialogueTurn, GeneratedClip, VoiceProfile } from '../types/voice';
import { analyzeAudioPeaks } from '../utils/audio';
import { WaveformPlayer } from './WaveformPlayer';

interface DialogueStudioProps {
  voices: VoiceProfile[];
  onClipGenerated: (clip: GeneratedClip) => void;
}

const INITIAL_TURNS: DialogueTurn[] = [
  {
    id: 'turn-1',
    speaker: 'A',
    text: 'السلام علیکم زین! <breath> آج کل اردو پوڈکاسٹ اور آڈیو بکس کی دنیا میں AI وائس کلوننگ کا بہت چرچا ہے۔',
  },
  {
    id: 'turn-2',
    speaker: 'B',
    text: '|yeah| بالکل صحیح کہا زویا، اب اردو بولنے والے تخلیق کار اپنی ہی آواز کلون کر کے چند لمحوں میں پورا آڈیو پروگرام مفت تیار کر سکتے ہیں۔',
  },
  {
    id: 'turn-3',
    speaker: 'A',
    text: 'اور سب سے زبردست بات یہ ہے کہ تلفظ اور لہجہ بالکل قدرتی محسوس ہوتا ہے!',
  },
];

export const DialogueStudio: React.FC<DialogueStudioProps> = ({
  voices,
  onClipGenerated,
}) => {
  const [speakerAId, setSpeakerAId] = useState<string>(voices[0]?.id || 'preset-zoya');
  const [speakerBId, setSpeakerBId] = useState<string>(voices[1]?.id || 'preset-zain');
  const [turns, setTurns] = useState<DialogueTurn[]>(INITIAL_TURNS);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outputAudio, setOutputAudio] = useState<{
    base64: string;
    mimeType: string;
    label: string;
  } | null>(null);

  const speakerA = voices.find((v) => v.id === speakerAId) || voices[0];
  const speakerB = voices.find((v) => v.id === speakerBId) || voices[1] || voices[0];

  const addTurn = (speaker: 'A' | 'B') => {
    setTurns((prev) => [
      ...prev,
      { id: `turn-${Date.now()}-${Math.random()}`, speaker, text: '' },
    ]);
  };

  const updateTurn = (id: string, patch: Partial<DialogueTurn>) => {
    setTurns((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  };

  const removeTurn = (id: string) => {
    if (turns.length <= 1) return;
    setTurns((prev) => prev.filter((t) => t.id !== id));
  };

  const handleSynthesizeDialogue = async () => {
    const validTurns = turns.filter((t) => t.text.trim().length > 0);
    if (validTurns.length === 0) {
      setError('Add at least one dialogue line before generating.');
      return;
    }
    setError(null);
    setIsGenerating(true);

    try {
      const res = await fetch('/api/tts/dialogue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          speakerA: {
            name: speakerA.name,
            voiceName: speakerA.baseVoice,
            stylePrompt: speakerA.stylePrompt,
          },
          speakerB: {
            name: speakerB.name,
            voiceName: speakerB.baseVoice,
            stylePrompt: speakerB.stylePrompt,
          },
          lines: validTurns.map((t) => ({ speaker: t.speaker, text: t.text })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Dialogue synthesis failed.');
      }

      const audioBase64 = data.audioBase64 as string;
      const mimeType = (data.mimeType as string) || 'audio/wav';
      const label = `${speakerA.name} & ${speakerB.name}`;
      setOutputAudio({ base64: audioBase64, mimeType, label });

      const { durationSec } = await analyzeAudioPeaks(audioBase64, mimeType, 48);
      onClipGenerated({
        id: `dialogue-${Date.now()}`,
        mode: 'dialogue',
        voiceId: speakerA.id,
        voiceName: speakerA.name,
        secondaryVoiceName: speakerB.name,
        text: validTurns
          .map((t) => `${t.speaker === 'A' ? speakerA.name : speakerB.name}: ${t.text}`)
          .join('\n'),
        mood: 'dialogue',
        modelUsed: data.modelUsed || 'gemini-3.8-flash-tts',
        audioBase64,
        mimeType,
        durationSec,
        createdAt: Date.now(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate dialogue.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto w-full px-4 sm:px-8 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
          Urdu Podcast & Dialogue Studio
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          Pair any cloned or studio voices for natural two-speaker Urdu conversations with vocal cues (<code className="font-mono text-xs">|yeah|</code>, <code className="font-mono text-xs">|mhm|</code>, <code className="font-mono text-xs">&lt;breath&gt;</code>).
        </p>
      </div>

      <div className="bg-panel border border-line rounded-xl p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
            Speaker A
          </label>
          <select
            value={speakerA?.id}
            onChange={(e) => setSpeakerAId(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-recessed border border-line rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:border-accent-bar"
          >
            {voices.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} ({v.origin === 'cloned' ? 'Cloned' : 'Studio'} · {v.genderTimbre})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
            Speaker B
          </label>
          <select
            value={speakerB?.id}
            onChange={(e) => setSpeakerBId(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-recessed border border-line rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:border-accent-bar"
          >
            {voices.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} ({v.origin === 'cloned' ? 'Cloned' : 'Studio'} · {v.genderTimbre})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-panel border border-line rounded-xl divide-y divide-line">
        {turns.map((turn, idx) => {
          const activeSpeaker = turn.speaker === 'A' ? speakerA : speakerB;
          return (
            <div key={turn.id} className="p-4 flex flex-col sm:flex-row gap-3 items-start">
              <div className="flex items-center gap-2 shrink-0 sm:w-40 pt-1">
                <span className="text-xs font-mono-tabular text-slate-400 dark:text-slate-500 w-5">
                  {String(idx + 1).padStart(2, '0')}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    updateTurn(turn.id, { speaker: turn.speaker === 'A' ? 'B' : 'A' })
                  }
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md border transition-colors truncate max-w-[120px] ${
                    turn.speaker === 'A'
                      ? 'bg-accent-soft border-accent-border text-accent-ink'
                      : 'bg-recessed border-line text-slate-800 dark:text-slate-200'
                  }`}
                  title="Click to switch speaker"
                >
                  {activeSpeaker?.name}
                </button>
              </div>

              <textarea
                rows={2}
                dir="auto"
                value={turn.text}
                onChange={(e) => updateTurn(turn.id, { text: e.target.value })}
                placeholder="اردو یا انگریزی مکالمہ لکھیں..."
                className="flex-1 w-full px-3 py-2 text-base bg-recessed/75 border border-line rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:border-accent-bar font-urdu-compact"
              />

              <button
                type="button"
                disabled={turns.length <= 1}
                onClick={() => removeTurn(turn.id)}
                className="p-2 text-slate-400 hover:text-red-500 disabled:opacity-30 rounded-lg transition-colors shrink-0"
                title="Remove line"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          );
        })}

        <div className="p-4 bg-recessed/50 flex flex-wrap items-center justify-between gap-3 rounded-b-xl">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => addTurn('A')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-panel border border-line hover:border-accent-bar rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add {speakerA?.name}</span>
            </button>
            <button
              type="button"
              onClick={() => addTurn('B')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-panel border border-line hover:border-accent-bar rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add {speakerB?.name}</span>
            </button>
          </div>

          <button
            type="button"
            disabled={isGenerating}
            onClick={handleSynthesizeDialogue}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-accent hover:bg-accent-hover disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Generating Dialogue...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                <span>Synthesize Conversation</span>
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2.5 p-4 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-xl text-sm text-red-800 dark:text-red-200">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-red-600 dark:text-red-400" />
          <span>{error}</span>
        </div>
      )}

      {outputAudio && (
        <WaveformPlayer
          audioBase64={outputAudio.base64}
          mimeType={outputAudio.mimeType}
          title={`Dialogue Output · ${outputAudio.label}`}
          subtitle="Dual-speaker Urdu synthesis · 24kHz WAV"
          downloadName="sadastudio-dialogue.wav"
          autoPlay
        />
      )}
    </div>
  );
};
