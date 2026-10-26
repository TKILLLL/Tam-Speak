import React, { useState } from 'react';
import {
  MessageSquare,
  Volume2,
  ChevronDown,
  ChevronUp,
  User,
  Bot,
  Lightbulb,
  CheckCircle2,
  Eye,
  AlertCircle,
} from 'lucide-react';
import { useTamSpeakStore } from '../../store';
import { container } from '../../../di/DIContainer';
import { WaveformAudioPlayer } from './WaveformAudioPlayer';
import { MiniScratchpadDrawer } from './MiniScratchpadDrawer';

export const QnATab: React.FC = () => {
  const {
    dialogueTurns,
    isLastMessageHidden,
    revealedTurnIds,
    hasShownRevealWarningInSession,
    openRevealWarningModal,
    revealTurn,
    showPenaltyToast,
  } = useTamSpeakStore();

  const [expandedTurnId, setExpandedTurnId] = useState<string | null>(null);
  const [activeMistakePopover, setActiveMistakePopover] = useState<{
    turnId: string;
    word: string;
    ipa: string;
    reason: string;
    alt: string;
  } | null>(null);

  const toggleTurnExpansion = (turnId: string) => {
    setExpandedTurnId(expandedTurnId === turnId ? null : turnId);
  };

  const handlePlayAI = (text: string) => {
    container.speechTTSEngine.speak(text);
  };

  const handleListenWord = (word: string, e: React.MouseEvent) => {
    e.stopPropagation();
    container.speechTTSEngine.speak(word, { rate: 0.85 });
  };

  const handleRevealClick = (turnId: string) => {
    if (hasShownRevealWarningInSession) {
      revealTurn(turnId);
      showPenaltyToast('-0.5 điểm phản xạ do mở xem transcript');
    } else {
      openRevealWarningModal(turnId);
    }
  };

  const renderUserTextWithHighlights = (
    turnId: string,
    text: string,
    mistakes?: Array<{ word: string; reason: string; ipa: string; suggestedAlternative: string }>
  ) => {
    if (!mistakes || mistakes.length === 0) {
      return (
        <div>
          <p className="text-slate-800 leading-relaxed font-normal">{text}</p>
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 font-semibold mt-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>✓ Natural & Accurate</span>
          </div>
        </div>
      );
    }

    const mistakeMap = new Map(mistakes.map((m) => [m.word.toLowerCase(), m]));
    const tokens = text.split(/(\s+)/);

    return (
      <div>
        <p className="text-slate-800 leading-relaxed font-normal">
          {tokens.map((token, idx) => {
            const clean = token.toLowerCase().replace(/[^a-z]/g, '');
            const mistake = mistakeMap.get(clean);

            if (mistake) {
              const isPopoverOpen =
                activeMistakePopover?.turnId === turnId &&
                activeMistakePopover?.word === mistake.word;

              return (
                <span key={idx} className="relative inline-block">
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveMistakePopover(
                        isPopoverOpen
                          ? null
                          : {
                              turnId,
                              word: mistake.word,
                              ipa: mistake.ipa,
                              reason: mistake.reason,
                              alt: mistake.suggestedAlternative,
                            }
                      );
                    }}
                    title="Click to view pronunciation & grammar correction"
                    className="text-red-600 font-semibold underline decoration-red-500 decoration-wavy underline-offset-4 cursor-pointer hover:bg-red-50 px-0.5 rounded transition-colors"
                  >
                    {token}
                  </span>

                  {/* Mistake Detail Popover */}
                  {isPopoverOpen && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="absolute z-30 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-white rounded-2xl shadow-xl border border-slate-200 text-left text-[11px] space-y-2 animate-in zoom-in-95"
                    >
                      <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                        <span className="font-extrabold text-slate-900 capitalize text-xs">
                          {mistake.word}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-teal-700 font-bold bg-teal-50 px-1.5 py-0.5 rounded border border-teal-100">
                            {mistake.ipa}
                          </span>
                          <button
                            onClick={(e) => handleListenWord(mistake.word, e)}
                            title="Listen"
                            className="p-1 rounded bg-teal-600 hover:bg-teal-700 text-white"
                          >
                            <Volume2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      <div>
                        <span className="text-slate-500 font-bold block text-[10px]">Lỗi sai:</span>
                        <p className="text-rose-700 font-medium leading-tight">
                          {mistake.reason}
                        </p>
                      </div>

                      {mistake.suggestedAlternative && (
                        <div>
                          <span className="text-slate-500 font-bold block text-[10px]">Gợi ý sửa:</span>
                          <p className="text-emerald-700 font-medium leading-tight">
                            {mistake.suggestedAlternative}
                          </p>
                        </div>
                      )}

                      <div className="pt-1 border-t border-slate-100 flex items-center justify-between text-[9px] text-slate-400">
                        <span>Đã lưu vào Pronunciation Lab</span>
                        <button
                          onClick={() => setActiveMistakePopover(null)}
                          className="text-slate-600 font-bold hover:text-slate-900"
                        >
                          Đóng
                        </button>
                      </div>
                    </div>
                  )}
                </span>
              );
            }

            return <span key={idx}>{token}</span>;
          })}
        </p>

        <div className="flex items-center gap-1.5 text-[11px] text-rose-600 font-semibold mt-1">
          <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
          <span>
            {mistakes.length} từ/cụm từ cần chú ý (Click vào chữ gạch đỏ để xem chi tiết)
          </span>
        </div>
      </div>
    );
  };

  return (
    <div
      onClick={() => setActiveMistakePopover(null)}
      className="flex-1 flex flex-col h-full overflow-hidden select-none"
    >
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
            const isHiddenBotMessage = !isUser && isLastMessageHidden && !revealedTurnIds.includes(turn.id);

            return (
              <div
                key={turn.id}
                className={`p-3 rounded-2xl border text-xs transition-all relative ${
                  isUser
                    ? 'bg-slate-50/90 border-slate-200 ml-3 shadow-2xs'
                    : 'bg-teal-50/50 border-teal-200/80 mr-3 shadow-2xs'
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

                {/* Turn Text with Hide / Blur & Penalty Logic for AI */}
                {isUser ? (
                  renderUserTextWithHighlights(turn.id, turn.text, turn.mistakes)
                ) : (
                  <div className="relative">
                    <p
                      className={`text-slate-800 leading-relaxed font-normal transition-all duration-300 ${
                        isHiddenBotMessage ? 'blur-md select-none pointer-events-none' : ''
                      }`}
                    >
                      {turn.text}
                    </p>

                    {/* Hidden Message Penalty Overlay */}
                    {isHiddenBotMessage && (
                      <div
                        onClick={() => handleRevealClick(turn.id)}
                        className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-teal-900/10 hover:bg-teal-900/20 backdrop-blur-2xs rounded-xl cursor-pointer transition-colors p-2 text-center"
                        title="Click to reveal transcript (-0.5 Score penalty)"
                      >
                        <div className="flex items-center gap-1.5 text-xs font-bold text-teal-900 bg-white/90 px-3 py-1 rounded-full shadow-xs border border-teal-200">
                          <Eye className="w-3.5 h-3.5 text-teal-600" />
                          <span>Click to reveal transcript</span>
                        </div>
                        <span className="text-[10px] text-rose-600 font-bold mt-1">
                          (-0.5 Score Penalty)
                        </span>
                      </div>
                    )}
                  </div>
                )}

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

                {/* Expandable AI Feedback & IPA suggestions */}
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
                        {turn.mistakes && turn.mistakes.length > 0 ? (
                          <div>
                            <span className="font-bold text-slate-700 block mb-1">
                              Pronunciation & Grammar Fixes:
                            </span>
                            <div className="space-y-1.5">
                              {turn.mistakes.map((m, mIdx) => (
                                <div
                                  key={mIdx}
                                  className="flex items-center justify-between bg-slate-50 p-1.5 rounded-lg border border-slate-100"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="text-red-700 font-semibold line-through">
                                      {m.word}
                                    </span>
                                    <span className="text-slate-400">→</span>
                                    <span className="font-mono text-teal-700 font-bold bg-teal-50 px-1 rounded">
                                      {m.ipa}
                                    </span>
                                    <span className="text-slate-500 text-[10px]">
                                      ({m.reason})
                                    </span>
                                  </div>
                                  <button
                                    onClick={(e) => handleListenWord(m.word, e)}
                                    className="p-1 text-teal-600 hover:bg-teal-50 rounded"
                                    title="Listen pronunciation"
                                  >
                                    <Volume2 className="w-3 h-3" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-emerald-700 font-medium">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            <span>Great job! Sentence had clear articulation and natural phrasing.</span>
                          </div>
                        )}

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
