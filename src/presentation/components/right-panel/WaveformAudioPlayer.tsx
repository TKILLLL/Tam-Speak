import React, { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { Play, Pause, AlertCircle } from 'lucide-react';
import { container } from '../../../di/DIContainer';
import { HesitationMarker } from '../../../infrastructure/audio/useAudioAnalyzer';

interface WaveformAudioPlayerProps {
  recordingId?: string;
  durationSeconds?: number;
  hesitations?: HesitationMarker[];
}

export const WaveformAudioPlayer: React.FC<WaveformAudioPlayerProps> = ({
  recordingId,
  durationSeconds = 5,
  hesitations = [],
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const waveSurferRef = useRef<WaveSurfer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    if (!containerRef.current) return;

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: '#94A3B8',
      progressColor: '#0D9488',
      cursorColor: '#0F766E',
      barWidth: 2,
      barGap: 1.5,
      barRadius: 2,
      height: 38,
      normalize: true,
    });

    waveSurferRef.current = ws;

    ws.on('play', () => setIsPlaying(true));
    ws.on('pause', () => setIsPlaying(false));
    ws.on('timeupdate', (time) => setCurrentTime(time));

    // Load audio from Dexie local storage if recordingId provided, or generate dummy sine audio
    const loadAudio = async () => {
      if (recordingId) {
        const stored = await container.localAudioRepository.getAudio(recordingId);
        if (stored && stored.blob) {
          const url = URL.createObjectURL(stored.blob);
          ws.load(url);
          return;
        }
      }

      // Generate a mock audio data URL for visual waveform representation
      try {
        const dummyCanvas = document.createElement('canvas');
        dummyCanvas.width = 100;
        dummyCanvas.height = 10;
        // In wavesurfer v7, load with empty or mock peaks
        const mockPeaks = [0.1, 0.4, 0.8, 0.5, 0.3, 0.7, 0.9, 0.6, 0.2, 0.5];
        ws.load('', [mockPeaks], Math.max(1, durationSeconds));
      } catch {
        // Safe ignore
      }
    };

    loadAudio();

    return () => {
      ws.destroy();
      waveSurferRef.current = null;
    };
  }, [durationSeconds, recordingId]);

  const togglePlay = () => {
    if (waveSurferRef.current) {
      waveSurferRef.current.playPause();
    }
  };

  const seekToTime = (seconds: number) => {
    if (waveSurferRef.current && durationSeconds > 0) {
      const progress = Math.min(1.0, Math.max(0.0, seconds / durationSeconds));
      waveSurferRef.current.seekTo(progress);
      waveSurferRef.current.play();
    }
  };

  return (
    <div className="w-full bg-slate-50 border border-slate-200/80 rounded-xl p-2.5 my-2">
      <div className="flex items-center gap-2 mb-1.5">
        <button
          onClick={togglePlay}
          className="w-7 h-7 rounded-full bg-slate-900 hover:bg-slate-800 text-white flex items-center justify-center shrink-0 transition-colors shadow-2xs"
        >
          {isPlaying ? <Pause className="w-3.5 h-3.5 fill-white" /> : <Play className="w-3.5 h-3.5 fill-white ml-0.5" />}
        </button>

        {/* Waveform timeline */}
        <div ref={containerRef} className="flex-1 relative cursor-pointer" />

        <span className="text-[10px] font-mono font-semibold text-slate-500 shrink-0">
          {currentTime.toFixed(1)}s / {durationSeconds.toFixed(1)}s
        </span>
      </div>

      {/* Hesitation Markers Badges (Red Dots for silence > 0.8s) */}
      {hesitations.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-slate-200/60">
          <span className="text-[10px] text-red-600 font-bold flex items-center gap-0.5">
            <AlertCircle className="w-3 h-3" />
            Pauses ({hesitations.length}):
          </span>
          {hesitations.map((h, index) => (
            <button
              key={index}
              onClick={() => seekToTime(h.startSeconds)}
              title={`Click to jump to pause at ${h.startSeconds}s (${h.durationSeconds}s)`}
              className="text-[10px] bg-red-100/90 text-red-700 hover:bg-red-200 border border-red-300 px-1.5 py-0.2 rounded font-mono font-medium transition-colors"
            >
              {h.startSeconds}s ({h.durationSeconds}s)
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
