import React from 'react';
import { GlowingOrbVisualizer } from './GlowingOrbVisualizer';
import { InteractiveTranscriptBox } from './InteractiveTranscriptBox';
import { HoldSpaceToTalk } from './HoldSpaceToTalk';
import { useTamSpeakStore } from '../../store';
import { Compass } from 'lucide-react';

export const VoiceStage: React.FC = () => {
  const { orbState, audioLevel, activeTopic, practiceMode } = useTamSpeakStore();

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

      {/* Bottom Push-to-Talk Bar */}
      <div className="w-full pb-2">
        <HoldSpaceToTalk />
      </div>
    </div>
  );
};
