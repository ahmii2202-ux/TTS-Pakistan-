import React, { useMemo, useState } from 'react';
import { Download, Play, Search, Trash2 } from 'lucide-react';
import { GeneratedClip } from '../types/voice';
import { downloadAudioFile, formatTime } from '../utils/audio';
import { WaveformPlayer } from './WaveformPlayer';

interface HistoryViewProps {
  clips: GeneratedClip[];
  onDeleteClip: (id: string) => void;
  onGoToStudio: () => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  clips,
  onDeleteClip,
  onGoToStudio,
}) => {
  const [search, setSearch] = useState('');
  const [modeFilter, setModeFilter] = useState<'all' | 'single' | 'dialogue'>('all');
  const [activeClipId, setActiveClipId] = useState<string | null>(null);

  const filteredClips = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clips.filter((c) => {
      if (modeFilter !== 'all' && c.mode !== modeFilter) return false;
      if (!q) return true;
      return (
        c.text.toLowerCase().includes(q) ||
        c.voiceName.toLowerCase().includes(q) ||
        (c.secondaryVoiceName || '').toLowerCase().includes(q)
      );
    });
  }, [clips, search, modeFilter]);

  const activeClip = clips.find((c) => c.id === activeClipId) || null;

  return (
    <div className="max-w-5xl mx-auto w-full px-4 sm:px-8 py-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            Audio Library
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            All generated Urdu speech and dialogue recordings saved locally in your browser.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search scripts or voices..."
              className="pl-8 pr-3 py-1.5 text-xs bg-panel border border-line rounded-lg text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-accent-bar"
            />
          </div>

          <div className="flex items-center gap-1 p-1 bg-recessed rounded-lg">
            {(['all', 'single', 'dialogue'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setModeFilter(m)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  modeFilter === m
                    ? 'bg-panel text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {m === 'all' ? 'All' : m === 'single' ? 'Speech' : 'Dialogue'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {activeClip && (
        <WaveformPlayer
          audioBase64={activeClip.audioBase64}
          mimeType={activeClip.mimeType}
          title={
            activeClip.secondaryVoiceName
              ? `${activeClip.voiceName} & ${activeClip.secondaryVoiceName}`
              : activeClip.voiceName
          }
          subtitle={`${activeClip.mood} · ${new Date(activeClip.createdAt).toLocaleString()}`}
          downloadName={`sadastudio-${activeClip.id}.wav`}
          autoPlay
        />
      )}

      {filteredClips.length === 0 ? (
        <div className="bg-panel border border-line rounded-xl py-16 px-6 text-center">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            No recordings found
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
            {clips.length === 0
              ? 'Generate your first Urdu speech clip in the Speech Studio or Dialogue Studio to see it saved here.'
              : 'Try adjusting your search query or filter.'}
          </p>
          {clips.length === 0 && (
            <button
              type="button"
              onClick={onGoToStudio}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-accent hover:bg-accent-hover rounded-lg transition-colors"
            >
              Open Speech Studio
            </button>
          )}
        </div>
      ) : (
        <div className="bg-panel border border-line rounded-xl divide-y divide-line overflow-hidden">
          {filteredClips.map((clip) => (
            <div
              key={clip.id}
              className={`px-4 sm:px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-recessed/50 transition-colors ${
                activeClipId === clip.id ? 'bg-accent-soft/60' : ''
              }`}
            >
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {clip.secondaryVoiceName
                      ? `${clip.voiceName} & ${clip.secondaryVoiceName}`
                      : clip.voiceName}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="capitalize">{clip.mood}</span>
                  {clip.wordCount ? (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono-tabular">{clip.wordCount.toLocaleString()} words</span>
                    </>
                  ) : null}
                  <span aria-hidden="true">·</span>
                  <span>
                    {new Date(clip.createdAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <p
                  dir="auto"
                  className="text-sm text-slate-700 dark:text-slate-300 line-clamp-1 font-urdu-compact"
                >
                  {clip.text}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs font-mono-tabular text-slate-500 dark:text-slate-400 mr-1">
                  {formatTime(clip.durationSec)}
                </span>
                <button
                  type="button"
                  onClick={() => setActiveClipId(clip.id)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-accent-ink bg-accent-soft border border-accent-border hover:opacity-90 rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Play</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    downloadAudioFile(
                      clip.audioBase64,
                      `sadastudio-${clip.id}.wav`,
                      clip.mimeType
                    )
                  }
                  className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-recessed rounded-lg transition-colors"
                  title="Download WAV"
                >
                  <Download className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (activeClipId === clip.id) setActiveClipId(null);
                    onDeleteClip(clip.id);
                  }}
                  className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-lg transition-colors"
                  title="Delete clip"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
