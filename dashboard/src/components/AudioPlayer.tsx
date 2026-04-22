// ============================================================
// AudioPlayer Component — Waveform audio player using WaveSurfer.js
// ============================================================

'use client';

import { useEffect, useRef, useState } from 'react';
import type WaveSurfer from 'wavesurfer.js';

interface AudioPlayerProps {
  src: string;
  title?: string;
}

export default function AudioPlayer({ src, title }: AudioPlayerProps) {
  const waveformRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [playbackRate, setPlaybackRate] = useState(1);

  useEffect(() => {
    if (!waveformRef.current) return;

    let ws: WaveSurfer | null = null;

    const initWaveSurfer = async () => {
      const WaveSurfer = (await import('wavesurfer.js')).default;

      ws = WaveSurfer.create({
        container: waveformRef.current!,
        waveColor: 'rgba(139, 92, 246, 0.4)',
        progressColor: '#8B5CF6',
        cursorColor: '#06B6D4',
        cursorWidth: 2,
        barWidth: 3,
        barGap: 2,
        barRadius: 3,
        height: 80,
        normalize: true,
        backend: 'WebAudio',
      });
      const wave = ws;

      wave.load(src);

      wave.on('ready', () => {
        setDuration(wave.getDuration());
        setIsReady(true);
        wave.setVolume(volume);
      });

      wave.on('audioprocess', () => {
        setCurrentTime(wave.getCurrentTime());
      });

      wave.on('seeking', () => {
        setCurrentTime(wave.getCurrentTime());
      });

      wave.on('play', () => setIsPlaying(true));
      wave.on('pause', () => setIsPlaying(false));
      wave.on('finish', () => setIsPlaying(false));

      wavesurferRef.current = wave;
    };

    initWaveSurfer();

    return () => {
      if (ws) ws.destroy();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  const togglePlayPause = () => {
    if (wavesurferRef.current) {
      wavesurferRef.current.playPause();
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (wavesurferRef.current) {
      wavesurferRef.current.setVolume(val);
    }
  };

  const handleSpeedChange = () => {
    const speeds = [0.5, 0.75, 1, 1.25, 1.5, 2];
    const idx = speeds.indexOf(playbackRate);
    const next = speeds[(idx + 1) % speeds.length];
    setPlaybackRate(next);
    if (wavesurferRef.current) {
      wavesurferRef.current.setPlaybackRate(next);
    }
  };

  const skip = (seconds: number) => {
    if (wavesurferRef.current) {
      const newTime = Math.max(0, Math.min(duration, currentTime + seconds));
      wavesurferRef.current.seekTo(newTime / duration);
    }
  };

  return (
    <div className="audio-player" id="audio-player">
      {title && <h3 className="player-title">{title}</h3>}

      {/* Waveform */}
      <div className="player-waveform-container">
        {!isReady && (
          <div className="player-loading">
            <div className="player-loading-dots">
              <span></span><span></span><span></span>
            </div>
            <p>Loading waveform...</p>
          </div>
        )}
        <div ref={waveformRef} className="player-waveform" />
      </div>

      {/* Time Display */}
      <div className="player-time">
        <span>{formatTime(currentTime)}</span>
        <span>{formatTime(duration)}</span>
      </div>

      {/* Controls */}
      <div className="player-controls">
        <button className="player-btn speed-btn" onClick={handleSpeedChange} title="Playback speed">
          {playbackRate}x
        </button>

        <button className="player-btn" onClick={() => skip(-10)} title="Rewind 10s">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M1 4v6h6" />
            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
          </svg>
        </button>

        <button
          className={`player-btn play-btn ${isPlaying ? 'playing' : ''}`}
          onClick={togglePlayPause}
          disabled={!isReady}
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="6,3 20,12 6,21" />
            </svg>
          )}
        </button>

        <button className="player-btn" onClick={() => skip(10)} title="Forward 10s">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M23 4v6h-6" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
        </button>

        <div className="player-volume">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="11,5 6,9 2,9 2,15 6,15 11,19" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
          </svg>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={volume}
            onChange={handleVolumeChange}
            className="volume-slider"
          />
        </div>
      </div>
    </div>
  );
}

function formatTime(seconds: number): string {
  if (isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
}
