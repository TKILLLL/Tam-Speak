import { useState, useRef, useCallback, useEffect } from 'react';
import { SharedAudioContext } from './SharedAudioContext';

export interface HesitationMarker {
  startSeconds: number;
  endSeconds: number;
  durationSeconds: number;
}

export interface AudioAnalyzerState {
  isListening: boolean;
  audioLevel: number; // 0.0 to 1.0
  frequencyData: number[]; // 32 frequency bins (0 to 255)
  hesitations: HesitationMarker[];
  totalSilenceSeconds: number;
  durationSeconds: number;
  currentWpm: number;
}

export interface UseAudioAnalyzerReturn extends AudioAnalyzerState {
  startAnalyzing: () => Promise<MediaStream>;
  stopAnalyzing: (wordCount?: number) => {
    hesitations: HesitationMarker[];
    wpm: number;
    durationSeconds: number;
    silenceDurations: number[];
  };
}

/**
 * useAudioAnalyzer
 * React Hook wrapping Web Audio API AnalyserNode.
 * 1. Computes real-time RMS audio level and 32-bin frequency data for the Glowing AI Orb.
 * 2. Zero-Token Client-Side Hesitation Detector: identifies pauses > 0.8s with exact timestamps.
 * 3. Client-side WPM calculator based on active phonation time.
 */
export function useAudioAnalyzer(): UseAudioAnalyzerReturn {
  const [isListening, setIsListening] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [frequencyData, setFrequencyData] = useState<number[]>(new Array(32).fill(0));
  const [hesitations, setHesitations] = useState<HesitationMarker[]>([]);
  const [totalSilenceSeconds, setTotalSilenceSeconds] = useState(0);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [currentWpm, setCurrentWpm] = useState(0);

  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const lastStateEmitTimeRef = useRef<number>(0);

  const recordingStartTimeRef = useRef(0);
  const silenceStartTimeRef = useRef<number | null>(null);
  const detectedHesitationsRef = useRef<HesitationMarker[]>([]);

  // Silence threshold: RMS below 0.015 is considered silence/pause
  const SILENCE_RMS_THRESHOLD = 0.015;
  // Hesitation threshold: minimum 800ms of consecutive silence
  const MIN_HESITATION_SECONDS = 0.8;

  const analyzeAudio = useCallback(() => {
    if (!analyserRef.current) return;

    const analyser = analyserRef.current;
    const timeData = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(timeData);

    // Compute RMS amplitude
    let sumSquares = 0;
    for (let i = 0; i < timeData.length; i++) {
      const val = timeData[i] ?? 0;
      sumSquares += val * val;
    }
    const rms = Math.sqrt(sumSquares / timeData.length);
    const normalizedLevel = Math.min(1.0, rms * 5.0); // Boosted for UI visualization

    // 60FPS Direct GPU Broadcast: Update visualizers without triggering React virtual DOM tree re-render
    SharedAudioContext.broadcastLevel(normalizedLevel);

    const now = Date.now();
    // Throttle React state updates to ~150ms to prevent forcing the parent views to re-render 60fps
    if (now - lastStateEmitTimeRef.current > 150) {
      lastStateEmitTimeRef.current = now;
      setAudioLevel(normalizedLevel);

      // Compute 32-bin frequency spectrum
      const freqData = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(freqData);

      const binSize = Math.floor(freqData.length / 32);
      const bins: number[] = [];
      for (let i = 0; i < 32; i++) {
        let sum = 0;
        for (let j = 0; j < binSize; j++) {
          sum += freqData[i * binSize + j] ?? 0;
        }
        bins.push(Math.round(sum / binSize));
      }
      setFrequencyData(bins);
      setDurationSeconds((now - recordingStartTimeRef.current) / 1000);
    }

    // Silence & Hesitation Tracking
    if (rms < SILENCE_RMS_THRESHOLD) {
      if (silenceStartTimeRef.current === null) {
        silenceStartTimeRef.current = now;
      }
    } else {
      if (silenceStartTimeRef.current !== null) {
        const pauseDuration = (now - silenceStartTimeRef.current) / 1000;
        if (pauseDuration >= MIN_HESITATION_SECONDS) {
          const startSeconds = (silenceStartTimeRef.current - recordingStartTimeRef.current) / 1000;
          const endSeconds = startSeconds + pauseDuration;

          const marker: HesitationMarker = {
            startSeconds: Math.round(startSeconds * 10) / 10,
            endSeconds: Math.round(endSeconds * 10) / 10,
            durationSeconds: Math.round(pauseDuration * 10) / 10,
          };

          detectedHesitationsRef.current.push(marker);
          setHesitations([...detectedHesitationsRef.current]);

          setTotalSilenceSeconds((prev) => prev + marker.durationSeconds);
        }
        silenceStartTimeRef.current = null;
      }
    }

    animFrameRef.current = requestAnimationFrame(analyzeAudio);
  }, []);

  const startAnalyzing = useCallback(async (): Promise<MediaStream> => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
        sampleRate: 16000,
      },
    });

    // Reuse singleton AudioContext to prevent Chrome/Safari 6-instance hardware limit
    const audioContext = SharedAudioContext.getContext();
    if (!audioContext) {
      throw new Error('Web Audio API is not supported in this environment.');
    }

    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.8;

    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);

    sourceRef.current = source;
    analyserRef.current = analyser;
    streamRef.current = stream;

    detectedHesitationsRef.current = [];
    setHesitations([]);
    setTotalSilenceSeconds(0);
    setCurrentWpm(0);

    recordingStartTimeRef.current = Date.now();
    lastStateEmitTimeRef.current = 0;
    silenceStartTimeRef.current = null;
    setIsListening(true);

    animFrameRef.current = requestAnimationFrame(analyzeAudio);
    return stream;
  }, [analyzeAudio]);

  const stopAnalyzing = useCallback((wordCount = 0) => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    if (sourceRef.current) {
      try {
        sourceRef.current.disconnect();
      } catch {
        // Safe ignore
      }
      sourceRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // Safe ignore
        }
      });
      streamRef.current = null;
    }

    analyserRef.current = null;
    SharedAudioContext.broadcastLevel(0);

    setIsListening(false);
    setAudioLevel(0);
    setFrequencyData(new Array(32).fill(0));

    const totalDuration = (Date.now() - recordingStartTimeRef.current) / 1000;
    const finalDuration = Math.max(1, Math.round(totalDuration * 10) / 10);

    // Compute WPM: words / (minutes)
    const minutes = finalDuration / 60;
    const calculatedWpm = minutes > 0 && wordCount > 0 ? Math.round(wordCount / minutes) : 0;
    setCurrentWpm(calculatedWpm);

    const silenceDurations = detectedHesitationsRef.current.map((h) => h.durationSeconds);

    return {
      hesitations: [...detectedHesitationsRef.current],
      wpm: calculatedWpm,
      durationSeconds: finalDuration,
      silenceDurations,
    };
  }, []);

  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (sourceRef.current) {
        try {
          sourceRef.current.disconnect();
        } catch {
          // ignore
        }
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => {
          try {
            t.stop();
          } catch {
            // ignore
          }
        });
      }
      SharedAudioContext.broadcastLevel(0);
    };
  }, []);

  return {
    isListening,
    audioLevel,
    frequencyData,
    hesitations,
    totalSilenceSeconds,
    durationSeconds,
    currentWpm,
    startAnalyzing,
    stopAnalyzing,
  };
}
