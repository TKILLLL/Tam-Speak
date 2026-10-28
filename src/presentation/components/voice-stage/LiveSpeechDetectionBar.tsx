import React from 'react';
import { useTamSpeakStore } from '../../store';

/**
 * LiveSpeechDetectionBar
 * Atomic, isolated live transcript preview component.
 * Subscribes to liveSpeechTranscript directly from Zustand to decouple 100ms STT stream
 * updates from the rest of the parent view and avoid 60fps virtual DOM re-renders.
 */
export const LiveSpeechDetectionBar: React.FC = () => {
  const liveSpeechTranscript = useTamSpeakStore((s) => s.liveSpeechTranscript);
  const orbState = useTamSpeakStore((s) => s.orbState);

  if (orbState === 'listening') {
    return (
      <div className="w-full p-2.5 px-4 rounded-2xl bg-teal-50/90 border border-teal-200 text-teal-900 text-xs shadow-xs flex items-center justify-between animate-in fade-in">
        <div className="flex items-center gap-2 overflow-hidden flex-1">
          <span className="w-2 h-2 rounded-full bg-teal-500 animate-ping shrink-0" />
          <span className="text-slate-500 font-semibold shrink-0">Live Detection:</span>
          <span className="font-medium text-slate-900 truncate">
            {liveSpeechTranscript ? `"${liveSpeechTranscript}"` : 'Listening... speak into your microphone'}
          </span>
          <span className="inline-block w-1.5 h-3.5 bg-teal-600 animate-pulse shrink-0" />
        </div>
      </div>
    );
  }

  if (orbState === 'thinking') {
    return (
      <div className="p-2 px-4 rounded-xl bg-slate-100 border border-slate-200 text-slate-600 text-xs flex items-center gap-2 animate-in fade-in">
        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
        <span>Processing speech and generating response...</span>
      </div>
    );
  }

  return null;
};
