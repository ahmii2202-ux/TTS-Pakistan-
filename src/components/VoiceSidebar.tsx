import React, { useMemo, useState } from 'react';
import { Mic, Plus, Search, Trash2, Volume2 } from 'lucide-react';
import { VoiceProfile } from '../types/voice';

interface VoiceSidebarProps {
  voices: VoiceProfile[];
  selectedVoiceId: string;
  onSelectVoice: (voice: VoiceProfile) => void;
  onDeleteClonedVoice: (id: string) => void;
  onOpenCloneStudio: () => void;
  onPreviewReferenceAudio: (voice: VoiceProfile) => void;
}

export const VoiceSidebar: React.FC<VoiceSidebarProps> = ({
  voices,
  selectedVoiceId,
  onSelectVoice,
  onDeleteClonedVoice,
  onOpenCloneStudio,
  onPreviewReferenceAudio,
}) => {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'cloned' | 'preset'>('all');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return voices.filter((v) => {
      if (filter !== 'all' && v.origin !== filter) return false;
      if (!q) return true;
      return (
        v.name.toLowerCase().includes(q) ||
        v.timbreSummary.toLowerCase().includes(q) ||
        v.accentNotes.toLowerCase().includes(q)
      );
    });
  }, [voices, search, filter]);

  const clonedVoices = filtered.filter((v) => v.origin === 'cloned');
  const presetVoices = filtered.filter((v) => v.origin === 'preset');

  const renderVoiceItem = (voice: VoiceProfile) => {
    const isSelected = voice.id === selectedVoiceId;
    return (
      <div
        key={voice.id}
        onClick={() => onSelectVoice(voice)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelectVoice(voice);
          }
        }}
        className={`group w-full text-left px-3 py-2.5 rounded-lg border transition-colors cursor-pointer ${
          isSelected
            ? 'bg-accent-soft border-accent-border text-slate-900 dark:text-slate-100'
            : 'bg-transparent border-transparent hover:bg-recessed text-slate-800 dark:text-slate-200'
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold truncate">{voice.name}</span>
          <div className="flex items-center gap-1 shrink-0">
            {voice.origin === 'cloned' && voice.referenceAudioBase64 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onPreviewReferenceAudio(voice);
                }}
                title="Play original reference recording"
                className="p-1 text-slate-400 hover:text-accent-ink rounded transition-colors"
              >
                <Volume2 className="w-3.5 h-3.5" />
              </button>
            )}
            {voice.origin === 'cloned' && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteClonedVoice(voice.id);
                }}
                title="Delete cloned voice"
                className="p-1 text-slate-400 hover:text-red-500 rounded transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
          {voice.timbreSummary}
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500 mt-1 truncate">
          <span>{voice.origin === 'cloned' ? 'Cloned' : 'Studio'}</span>
          <span aria-hidden="true">·</span>
          <span>{voice.genderTimbre}</span>
        </div>
      </div>
    );
  };

  return (
    <aside className="w-full xl:w-[268px] shrink-0 border-b xl:border-b-0 xl:border-r border-line bg-panel flex flex-col">
      <div className="p-4 border-b border-line space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400 tracking-wide">
            Voice Cast
          </h2>
          <button
            type="button"
            onClick={onOpenCloneStudio}
            className="inline-flex items-center gap-1 text-xs font-medium text-accent-ink hover:opacity-80 whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Clone</span>
          </button>
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search voices or accents..."
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-recessed border border-line rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-accent-bar"
          />
        </div>

        <div className="grid grid-cols-3 gap-1 p-1 bg-recessed rounded-lg">
          {(['all', 'cloned', 'preset'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setFilter(tab)}
              className={`py-1 px-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                filter === tab
                  ? 'bg-panel text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {tab === 'all' ? 'All' : tab === 'cloned' ? 'Cloned' : 'Presets'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-5 max-h-[300px] xl:max-h-none">
        {(filter === 'all' || filter === 'cloned') && (
          <div>
            <div className="flex items-center justify-between px-2 mb-1.5">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Cloned Voices
              </span>
              <span className="text-xs font-mono-tabular text-slate-400 dark:text-slate-500">
                {clonedVoices.length}
              </span>
            </div>
            {clonedVoices.length > 0 ? (
              <div className="space-y-1">{clonedVoices.map(renderVoiceItem)}</div>
            ) : (
              <div className="px-3 py-4 rounded-lg border border-dashed border-line text-center">
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                  Clone any Urdu voice for free.
                </p>
                <button
                  type="button"
                  onClick={onOpenCloneStudio}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-accent-ink bg-accent-soft border border-accent-border hover:opacity-90 rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  <Mic className="w-3.5 h-3.5" />
                  <span>Record Sample</span>
                </button>
              </div>
            )}
          </div>
        )}

        {(filter === 'all' || filter === 'preset') && (
          <div>
            <div className="flex items-center justify-between px-2 mb-1.5">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Urdu Studio Cast
              </span>
              <span className="text-xs font-mono-tabular text-slate-400 dark:text-slate-500">
                {presetVoices.length}
              </span>
            </div>
            <div className="space-y-1">{presetVoices.map(renderVoiceItem)}</div>
          </div>
        )}
      </div>
    </aside>
  );
};
