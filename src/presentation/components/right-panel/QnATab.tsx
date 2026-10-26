import React, { useState } from 'react';
import {
  MessageSquare,
  Volume2,
  ChevronDown,
  ChevronUp,
  User,
  Bot,
  Lightbulb,
} from 'lucide-react';
import { useTamSpeakStore } from '../../store';
import { container } from '../../../di/DIContainer';
import { WaveformAudioPlayer } from './WaveformAudioPlayer';
import { MiniScratchpadDrawer } from './MiniScratchpadDrawer';

export const QnATab: React.FC = () => {
  const { dialogueTurns } = useTamSpeakStore();
  const [expandedTurnId, setExpandedTurnId] = useState<string | null>(null);

  const toggleTurnExpansion = (turnId: string) => {
    setExpandedTurnId(expandedTurnId === turnId ? null : turnId);
  };

  const handlePlayAI = (text: string) => {
    container.speechTTSEngine.speak(text);
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden select-none">
      {/* Dialogue Stream */}
      <div className="flex-1 overflow-y-auto pr-1 space-y-3.5 mb-2">
        {dialogueTurns.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
            <MessageSquare className="w-10 h-10 mb-2 text-slate-300 stroke-1" />
            <p className="font-semibold text-xs text-slate-600">No Dialogue Turns Yet</p>
            <p className="text-[11px] text-slate-400 mt-0.5 max-w-xs">
              Press and hold <kbd className="font-mono bg-slate-100 border border-slate-300 px-1 rounded text-[10px]">Space</kbd> on the main stage to speak your first sentence.
            </p>
          </div>
        ) : (
          dialogueTurns.map((turn) => {
            const isUser = turn.speaker === 'user';
            const isExpanded = expandedTurnId === turn.id;

            return (
              <div
                key={turn.id}
                className={`p-3 rounded-2xl border text-xs transition-all ${
                  isUser
                    ? 'bg-slate-50/80 border-slate-200 ml-3'
                    : 'bg-teal-50/50 border-teal-200/80 mr-3'
                }`}
              >
                {/* Speaker Header */}
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5 font-bold">
                    {isUser ? (
                      <>
                        <div className="w-5 h-5 rounded-md bg-slate-800 text-white flex items-center justify-center text-[10px]">
                          <User className="w-3 h-3" />
                        </div>
                        <span className="text-slate-800">You</span>
                      </>
                    ) : (
                      <>
                        <div className="w-5 h-5 rounded-md bg-teal-600 text-white flex items-center justify-center text-[10px]">
                          <Bot className="w-3 h-3" />
                        </div>
                        <span className="text-teal-900">TamSpeak Examiner</span>
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 font-mono">
                      {turn.timestampSeconds}s
                    </span>
                    {!isUser && (
                      <button
                        onClick={() => handlePlayAI(turn.text)}
                        title="Listen replay"
                        className="p-1 hover:bg-teal-100 text-teal-700 rounded-md transition-colors"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Turn Text */}
                <p className="text-slate-800 leading-relaxed font-normal">{turn.text}</p>

                {/* If User Turn: Render Waveform with Red Hesitation Markers */}
                {isUser && (
                  <WaveformAudioPlayer
                    recordingId={turn.audioBlobId}
                    durationSeconds={Math.max(3, turn.text.split(' ').length * 0.45)}
                    hesitations={
                      turn.hesitationsDetected
                        ? [{ startSeconds: 1.2, endSeconds: 2.1, durationSeconds: 0.9 }]
                        : []
                    }
                  />
                )}

                {/* Expandable AI Corrections & IPA suggestions */}
                {isUser && (
                  <div className="mt-2 pt-2 border-t border-slate-200/60">
                    <button
                      onClick={() => toggleTurnExpansion(turn.id)}
                      className="flex items-center gap-1 text-[11px] font-bold text-teal-700 hover:text-teal-800 transition-colors"
                    >
                      <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                      <span>AI Feedback & IPA Corrections</span>
                      {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>

                    {isExpanded && (
                      <div className="mt-2 p-2.5 bg-white rounded-xl border border-slate-200 space-y-2 text-[11px] animate-in fade-in">
                        <div>
                          <span className="font-bold text-slate-700 block mb-0.5">
                            Pronunciation & Ending Sounds:
                          </span>
                          <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                            <span className="text-red-700 font-semibold line-through">
                              thought
                            </span>
                            <span className="text-slate-400">→</span>
                            <span className="font-mono text-teal-700 font-bold bg-teal-50 px-1 rounded">
                              /θɔːt/
                            </span>
                            <span className="text-slate-500 text-[10px]">
                              (Release final /t/ crisply)
                            </span>
                          </div>
                        </div>

                        <div>
                          <span className="font-bold text-slate-700 block mb-0.5">
                            Native Phrasing Upgrade:
                          </span>
                          <p className="text-emerald-800 bg-emerald-50/70 p-1.5 rounded-lg border border-emerald-200 font-medium">
                            "From my personal perspective, I have always found this particularly intriguing..."
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Mini Scratchpad & 0-Token Drawer at Bottom */}
      <MiniScratchpadDrawer />
    </div>
  );
};
