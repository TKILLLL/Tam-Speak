import React, { useState, useRef } from 'react';
import { Play, Pause, Eye, EyeOff, Volume2 } from 'lucide-react';
import { useTamSpeakStore } from '../../store';
import { container } from '../../../di/DIContainer';
import { WordLookupTooltip } from '../common/WordLookupTooltip';

export const InteractiveTranscriptBox: React.FC = () => {
  const {
    lastAIMessage,
    currentExaminerPrompt,
    isLastMessageHidden,
    toggleHideLastMessage,
    setOrbState,
  } = useTamSpeakStore();

  const textToDisplay = currentExaminerPrompt || lastAIMessage;

  const [isPlayingReplay, setIsPlayingReplay] = useState(false);
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const textContainerRef = useRef<HTMLDivElement>(null);

  const handleReplay = () => {
    if (isPlayingReplay) {
      container.speechTTSEngine.stop();
      setIsPlayingReplay(false);
      setOrbState('idle');
    } else {
      setIsPlayingReplay(true);
      setOrbState('speaking');
      container.speechTTSEngine.speak(textToDisplay, {
        onEnd: () => {
          setIsPlayingReplay(false);
          setOrbState('idle');
        },
        onError: () => {
          setIsPlayingReplay(false);
          setOrbState('idle');
        },
      });
    }
  };

  // Text Selection detection for 0-token word lookup tooltip
  const handleMouseUp = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      return;
    }

    const text = selection.toString().trim();
    // Only show tooltip for single words or short phrases <= 3 words
    if (text.length > 0 && text.split(/\s+/).length <= 3) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      setSelectedWord(text);
      setTooltipPos({
        top: rect.top,
        left: rect.left + rect.width / 2,
      });
    }
  };

  return (
    <div className="w-full max-w-lg mt-6 relative select-none">
      {/* Word Lookup Tooltip (Zero-Token Dictionary & IPA) */}
      {selectedWord && (
        <WordLookupTooltip
          selectedText={selectedWord}
          position={tooltipPos}
          onClose={() => setSelectedWord(null)}
        />
      )}

      {/* Transcript Card Container */}
      <div className="rounded-2xl border border-slate-200/90 bg-white/90 backdrop-blur-xs p-5 shadow-sm transition-all hover:shadow-md">
        {/* Controls Bar */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-teal-500" />
              AI Examiner
            </span>
            <span className="text-[10px] text-slate-400 font-medium">
              (Highlight words to inspect IPA)
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Replay Button (R) */}
            <button
              onClick={handleReplay}
              title="Replay AI Speech (Shortcut: R)"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition-all active:scale-95"
            >
              {isPlayingReplay ? (
                <>
                  <Pause className="w-3 h-3 fill-white" />
                  <span>Pause</span>
                </>
              ) : (
                <>
                  <Play className="w-3 h-3 fill-white" />
                  <span>Replay [R]</span>
                </>
              )}
            </button>

            {/* Hide/Show Last Message Pill (H) */}
            <button
              onClick={toggleHideLastMessage}
              title="Toggle Transcript for Listening Reflex (Shortcut: H)"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-slate-200 hover:bg-slate-100 text-slate-600 text-xs font-medium transition-colors"
            >
              {isLastMessageHidden ? (
                <>
                  <Eye className="w-3.5 h-3.5 text-teal-600" />
                  <span>Show [H]</span>
                </>
              ) : (
                <>
                  <EyeOff className="w-3.5 h-3.5 text-slate-400" />
                  <span>Hide [H]</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Message Content with Selection Support */}
        <div
          ref={textContainerRef}
          onMouseUp={handleMouseUp}
          className="min-h-[4rem] flex items-center justify-center text-center p-2"
        >
          {isLastMessageHidden ? (
            <div className="py-2 text-slate-400 italic text-sm flex items-center gap-2 select-none">
              <Volume2 className="w-4 h-4 text-teal-600 animate-pulse" />
              <span>Transcript hidden to train listening reflex. Press [H] to reveal.</span>
            </div>
          ) : (
            <p className="text-slate-800 text-sm leading-relaxed font-normal selection:bg-teal-100 selection:text-teal-900 cursor-text">
              {textToDisplay}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
