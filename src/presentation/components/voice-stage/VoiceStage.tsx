import React from 'react';
import { GlowingOrbVisualizer } from './GlowingOrbVisualizer';
import { InteractiveTranscriptBox } from './InteractiveTranscriptBox';
import { HoldSpaceToTalk } from './HoldSpaceToTalk';
import { useTamSpeakStore } from '../../store';
import { Compass } from 'lucide-react';

export const VoiceStage: React.FC = () => {
  const { orbState, audioLevel, activeTopic, practiceMode, liveSpeechTranscript } = useTamSpeakStore();

  return (
    <div className="flex-1 flex flex-col items-center justify-between p-6 overflow-y-auto relative bg-gradient-to-b from-white via-slate-50/60 to-slate-100/40 select-none">
      {/* Top Scenario Banner */}
      <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/80 border border-slate-200/80 shadow-2xs backdrop-blur-xs mb-2">
        <Compass className="w-3.5 h-3.5 text-teal-600" />
        <span className="text-xs font-semibold text-slate-800">
          Topic: {activeTopic?.title || 'Daily Conversational Immersion'}
        </span>
        <span className="text-slate-300">•</span>
        <span className="text-[11px] font-medium text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full capitalize">
          {practiceMode.replace('_', ' ')}
        </span>
      </div>

      {/* Center Voice Core: Glowing Orb + Interactive Transcript */}
      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-xl">
        <GlowingOrbVisualizer orbState={orbState} audioLevel={audioLevel} />
        <InteractiveTranscriptBox />
      </div>

      {/* Live Speech Detection Bar (Google Translate style live streaming preview) */}
      <div className="w-full max-w-xl px-4 flex flex-col items-center min-h-[2.5rem] justify-center mt-2">
        {orbState === 'listening' ? (
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
        ) : orbState === 'thinking' ? (
          <div className="p-2 px-4 rounded-xl bg-slate-100 border border-slate-200 text-slate-600 text-xs flex items-center gap-2 animate-in fade-in">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span>Processing speech and generating response...</span>
          </div>
        ) : null}
      </div>

      {/* Bottom Push-to-Talk Bar */}
      <div className="w-full pb-2">
        <HoldSpaceToTalk />
      </div>
    </div>
  );
};
