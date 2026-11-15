import React, { useEffect, useRef, useState } from 'react';
import { Download, Pause, Play, RotateCcw, RotateCw, Volume2 } from 'lucide-react';
import { analyzeAudioPeaks, base64ToBlob, downloadAudioFile, formatTime } from '../utils/audio';

interface WaveformPlayerProps {
  audioBase64: string;
  mimeType?: string;
  title: string;
  subtitle?: string;
  downloadName?: string;
  autoPlay?: boolean;
  compact?: boolean;
}

export const WaveformPlayer: React.FC<WaveformPlayerProps> = ({
  audioBase64,
  mimeType = 'audio/wav',
  title,
  subtitle,
  downloadName = 'sadastudio-speech.wav',
  autoPlay = false,
  compact = false,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [objectUrl, setObjectUrl] = useState<string>('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [volume, setVolume] = useState<number>(1);
  const [peaks, setPeaks] = useState<number[]>(() =>
    Array.from({ length: 64 }, () => 0.18)
  );

  useEffect(() => {
    const blob = base64ToBlob(audioBase64, mimeType);
    const url = URL.createObjectURL(blob);
    setObjectUrl(url);
    setIsPlaying(false);
    setCurrentTime(0);

    let active = true;
    analyzeAudioPeaks(audioBase64, mimeType, compact ? 44 : 72).then((res) => {
      if (!active) return;
      setPeaks(res.peaks);
      if (res.durationSec > 0) setDuration(res.durationSec);
    });

    return () => {
      active = false;
      URL.revokeObjectURL(url);
    };
  }, [audioBase64, mimeType, compact]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !objectUrl) return;

    audio.playbackRate = playbackRate;
    audio.volume = volume;
    if (autoPlay) {
      audio
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    }
  }, [objectUrl, autoPlay]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    }
  };

  const skipSeconds = (delta: number) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const next = Math.max(0, Math.min(duration, audio.currentTime + delta));
    audio.currentTime = next;
    setCurrentTime(next);
  };

  const handleSeek = (ratio: number) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const nextTime = Math.max(0, Math.min(duration, ratio * duration));
    audio.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0;

  return (
    <div
      className={`border border-line bg-panel rounded-xl ${
        compact ? 'p-3.5' : 'p-4 sm:p-5'
      }`}
    >
      <audio
        ref={audioRef}
        src={objectUrl}
        onTimeUpdate={() => {
          if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
        }}
        onLoadedMetadata={() => {
          if (audioRef.current && Number.isFinite(audioRef.current.duration)) {
            setDuration(audioRef.current.duration);
          }
        }}
        onEnded={() => {
          setIsPlaying(false);
          setCurrentTime(0);
        }}
      />

      <div className="flex flex-wrap items-center justify-between gap-3 mb-3.5">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
            {title}
          </div>
          {subtitle && (
            <div className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
              {subtitle}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {!compact && (
            <div className="hidden sm:flex items-center gap-1.5 mr-1">
              <Volume2 className="w-3.5 h-3.5 text-slate-400" />
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                aria-label="Playback volume"
                className="w-16 accent-accent cursor-pointer"
              />
            </div>
          )}

          <div className="flex items-center bg-recessed rounded-lg p-0.5">
            {[0.75, 1, 1.25, 1.5].map((rate) => (
              <button
                key={rate}
                type="button"
                onClick={() => setPlaybackRate(rate)}
                className={`px-2 py-1 text-xs font-mono-tabular rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  playbackRate === rate
                    ? 'bg-panel text-slate-900 dark:text-white font-medium shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {rate}x
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => downloadAudioFile(audioBase64, downloadName, mimeType)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-recessed hover:opacity-90 rounded-lg transition-colors whitespace-nowrap shrink-0"
            title="Download WAV"
          >
            <Download className="w-3.5 h-3.5" />
            <span>WAV</span>
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 shrink-0">
          {!compact && (
            <button
              type="button"
              onClick={() => skipSeconds(-5)}
              title="Back 5 seconds"
              className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-recessed transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={togglePlay}
            aria-label={isPlaying ? 'Pause audio' : 'Play audio'}
            className="w-10 h-10 rounded-full bg-accent hover:bg-accent-hover text-white flex items-center justify-center transition-colors shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
          </button>
          {!compact && (
            <button
              type="button"
              onClick={() => skipSeconds(5)}
              title="Forward 5 seconds"
              className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-recessed transition-colors"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div
          className="flex-1 flex items-center gap-[2px] h-11 cursor-pointer select-none"
          role="slider"
          aria-label="Audio progress"
          aria-valuemin={0}
          aria-valuemax={Math.round(duration)}
          aria-valuenow={Math.round(currentTime)}
          tabIndex={0}
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const ratio = (e.clientX - rect.left) / rect.width;
            handleSeek(ratio);
          }}
        >
          {peaks.map((peak, index) => {
            const barRatio = index / peaks.length;
            const isActive = barRatio <= progress;
            return (
              <div
                key={index}
                className={`flex-1 rounded-full transition-colors ${
                  isActive
                    ? 'bg-accent-bar'
                    : 'bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600'
                }`}
                style={{
                  height: `${Math.max(16, Math.round(peak * 100))}%`,
                }}
              />
            );
          })}
        </div>

        <div className="text-xs font-mono-tabular text-slate-600 dark:text-slate-400 shrink-0 min-w-[92px] text-right">
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>
      </div>
    </div>
  );
};
