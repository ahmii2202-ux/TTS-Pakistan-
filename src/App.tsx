import React, { useEffect, useMemo, useState } from 'react';
import { Moon, Sun, X } from 'lucide-react';
import { DialogueStudio } from './components/DialogueStudio';
import { HistoryView } from './components/HistoryView';
import { OfflineIndicator, PWAInstallButton } from './components/PWAInstallButton';
import { SpeechStudio } from './components/SpeechStudio';
import { VoiceCloningStudio } from './components/VoiceCloningStudio';
import { VoiceSidebar } from './components/VoiceSidebar';
import { WaveformPlayer } from './components/WaveformPlayer';
import { PRESET_VOICES } from './data/presets';
import { GeneratedClip, VoiceProfile } from './types/voice';
import {
  deleteClonedVoice,
  deleteGeneratedClip,
  getClonedVoices,
  getGeneratedClips,
  saveClonedVoice,
  saveGeneratedClip,
} from './utils/storage';

type WorkspaceTab = 'studio' | 'clone' | 'dialogue' | 'history';
type StudioPalette = 'emerald' | 'indigo' | 'amber' | 'crimson';

const PALETTE_OPTIONS: Array<{ id: StudioPalette; label: string; swatch: string }> = [
  { id: 'emerald', label: 'Emerald Studio', swatch: '#059669' },
  { id: 'indigo', label: 'Broadcast Indigo', swatch: '#4f46e5' },
  { id: 'amber', label: 'Analog Gold', swatch: '#d97706' },
  { id: 'crimson', label: 'Crimson Noir', swatch: '#e11d48' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('studio');
  const [isDark, setIsDark] = useState<boolean>(() => {
    const saved = localStorage.getItem('sadastudio_theme');
    return saved ? saved === 'dark' : true;
  });
  const [palette, setPalette] = useState<StudioPalette>(() => {
    const saved = localStorage.getItem('sadastudio_palette') as StudioPalette | null;
    return saved && ['emerald', 'indigo', 'amber', 'crimson'].includes(saved)
      ? saved
      : 'emerald';
  });
  const [clonedVoices, setClonedVoices] = useState<VoiceProfile[]>([]);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>(PRESET_VOICES[0].id);
  const [clips, setClips] = useState<GeneratedClip[]>([]);
  const [previewReferenceVoice, setPreviewReferenceVoice] = useState<VoiceProfile | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('sadastudio_theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  useEffect(() => {
    document.documentElement.dataset.palette = palette;
    localStorage.setItem('sadastudio_palette', palette);
  }, [palette]);

  useEffect(() => {
    getClonedVoices()
      .then((loaded) => {
        setClonedVoices(loaded);
        if (loaded.length > 0) {
          setSelectedVoiceId(loaded[0].id);
        }
      })
      .catch(() => {});

    getGeneratedClips()
      .then((loaded) => setClips(loaded))
      .catch(() => {});
  }, []);

  const allVoices = useMemo(
    () => [...clonedVoices, ...PRESET_VOICES],
    [clonedVoices]
  );

  const selectedVoice = useMemo(
    () => allVoices.find((v) => v.id === selectedVoiceId) || PRESET_VOICES[0],
    [allVoices, selectedVoiceId]
  );

  const handleVoiceCloned = async (voice: VoiceProfile) => {
    setClonedVoices((prev) => {
      const exists = prev.some((v) => v.id === voice.id);
      if (exists) {
        return prev.map((v) => (v.id === voice.id ? voice : v));
      }
      return [voice, ...prev];
    });
    setSelectedVoiceId(voice.id);
    await saveClonedVoice(voice).catch(() => {});
  };

  const handleDeleteClonedVoice = async (id: string) => {
    setClonedVoices((prev) => prev.filter((v) => v.id !== id));
    if (selectedVoiceId === id) {
      setSelectedVoiceId(PRESET_VOICES[0].id);
    }
    if (previewReferenceVoice?.id === id) {
      setPreviewReferenceVoice(null);
    }
    await deleteClonedVoice(id).catch(() => {});
  };

  const handleClipGenerated = async (clip: GeneratedClip) => {
    setClips((prev) => {
      const idx = prev.findIndex((c) => c.id === clip.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = clip;
        return next;
      }
      return [clip, ...prev];
    });
    await saveGeneratedClip(clip).catch(() => {});
  };

  const handleDeleteClip = async (id: string) => {
    setClips((prev) => prev.filter((c) => c.id !== id));
    await deleteGeneratedClip(id).catch(() => {});
  };

  const navItems: Array<{ id: WorkspaceTab; label: string }> = [
    { id: 'studio', label: 'Speech Studio' },
    { id: 'clone', label: 'Voice Cloning' },
    { id: 'dialogue', label: 'Dialogue' },
    { id: 'history', label: 'Library' },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-canvas text-slate-900 dark:text-slate-100 transition-colors">
      {/* Top Bar Contract: 3 zones separated by gap-8 */}
      <header className="bg-panel border-b border-line px-4 sm:px-6 h-14 flex items-center justify-between gap-8 shrink-0">
        {/* Zone 1: Brand Wordmark */}
        <button
          type="button"
          onClick={() => setActiveTab('studio')}
          className="text-lg font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0 cursor-pointer"
        >
          SadaStudio
        </button>

        {/* Zone 2: 4 concise single-line nav links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer border-b-2 ${
                activeTab === item.id
                  ? 'text-accent-ink border-accent-bar'
                  : 'text-slate-600 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('clone')}
            className="px-4 py-2 text-xs font-semibold text-white bg-accent hover:bg-accent-hover rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            New Clone
          </button>
        </div>
      </header>

      {/* Studio Sub-Toolbar (Theme & Color Palette switch + Free Info + Mobile Nav) */}
      <div className="bg-panel/80 border-b border-line px-4 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-3">
        <div className="flex md:hidden items-center gap-1 overflow-x-auto">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                activeTab === item.id
                  ? 'bg-accent-soft text-accent-ink font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
          <span>Free for Everyone</span>
          <span aria-hidden="true">·</span>
          <span>Unlimited Words (100,000+ Ready)</span>
          <span aria-hidden="true">·</span>
          <span>Unlimited Urdu Voice Clones</span>
        </div>

        <div className="flex items-center gap-2.5 ml-auto">
          <div
            className="flex items-center gap-1.5 px-2 py-1 bg-recessed border border-line rounded-md"
            role="group"
            aria-label="Studio accent color"
          >
            {PALETTE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setPalette(opt.id)}
                title={opt.label}
                aria-label={`Select ${opt.label} color`}
                aria-pressed={palette === opt.id}
                className={`w-4 h-4 rounded-full transition-transform cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                  palette === opt.id
                    ? 'ring-2 ring-offset-2 ring-slate-700 dark:ring-white ring-offset-recessed scale-110'
                    : 'opacity-75 hover:opacity-100 hover:scale-105'
                }`}
                style={{ backgroundColor: opt.swatch }}
              />
            ))}
          </div>

          <PWAInstallButton />
          <button
            type="button"
            onClick={() => setIsDark((d) => !d)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-300 bg-panel border border-line hover:border-slate-300 dark:hover:border-slate-600 rounded-md transition-colors whitespace-nowrap shrink-0"
            aria-label="Toggle studio theme"
          >
            {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            <span>{isDark ? 'Daylight Studio' : 'Dark Studio'}</span>
          </button>
        </div>
      </div>

      {/* Reference Audio Preview Banner */}
      {previewReferenceVoice?.referenceAudioBase64 && (
        <div className="bg-recessed border-b border-line px-4 sm:px-6 py-3">
          <div className="max-w-5xl mx-auto flex items-start gap-3">
            <div className="flex-1">
              <WaveformPlayer
                audioBase64={previewReferenceVoice.referenceAudioBase64}
                mimeType={previewReferenceVoice.referenceMimeType || 'audio/webm'}
                title={`Original Reference Recording · ${previewReferenceVoice.name}`}
                subtitle={previewReferenceVoice.sampleTranscript || 'Captured reference audio'}
                downloadName={`${previewReferenceVoice.name.toLowerCase().replace(/\s+/g, '-')}-reference.wav`}
                autoPlay
                compact
              />
            </div>
            <button
              type="button"
              onClick={() => setPreviewReferenceVoice(null)}
              className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-panel border border-line rounded-lg"
              aria-label="Close reference player"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Studio Workspace */}
      <div className="flex-1 flex flex-col xl:flex-row min-h-0">
        {activeTab === 'studio' && (
          <VoiceSidebar
            voices={allVoices}
            selectedVoiceId={selectedVoice.id}
            onSelectVoice={(voice) => setSelectedVoiceId(voice.id)}
            onDeleteClonedVoice={handleDeleteClonedVoice}
            onOpenCloneStudio={() => setActiveTab('clone')}
            onPreviewReferenceAudio={(voice) => setPreviewReferenceVoice(voice)}
          />
        )}

        <main className="flex-1 overflow-y-auto flex flex-col">
          {activeTab === 'studio' && (
            <SpeechStudio
              selectedVoice={selectedVoice}
              onClipGenerated={handleClipGenerated}
              onOpenCloneStudio={() => setActiveTab('clone')}
              onPreviewReferenceAudio={(voice) => setPreviewReferenceVoice(voice)}
            />
          )}

          {activeTab === 'clone' && (
            <VoiceCloningStudio
              onVoiceCloned={handleVoiceCloned}
              onUseInStudio={(voice) => {
                setSelectedVoiceId(voice.id);
                setActiveTab('studio');
              }}
            />
          )}

          {activeTab === 'dialogue' && (
            <DialogueStudio
              voices={allVoices}
              onClipGenerated={handleClipGenerated}
            />
          )}

          {activeTab === 'history' && (
            <HistoryView
              clips={clips}
              onDeleteClip={handleDeleteClip}
              onGoToStudio={() => setActiveTab('studio')}
            />
          )}
        </main>
      </div>
      <OfflineIndicator />
    </div>
  );
}
