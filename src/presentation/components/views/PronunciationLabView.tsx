import React, { useState, useRef, useEffect } from 'react';
import {
  Volume2,
  Mic,
  RotateCcw,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Flame,
  Plus,
  Award,
  X,
} from 'lucide-react';
import { useTamSpeakStore, MistakeItem } from '../../store';
import { container } from '../../../di/DIContainer';

export const PronunciationLabView: React.FC = () => {
  const { pronunciationMistakes, markMistakeMastered, addPronunciationMistake } =
    useTamSpeakStore();

  const [activeTab, setActiveTab] = useState<'needs_practice' | 'mastered'>('needs_practice');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [userTranscript, setUserTranscript] = useState('');
  const [evaluationResult, setEvaluationResult] = useState<{
    accuracy: number;
    feedback: string;
    isSuccess: boolean;
  } | null>(null);

  // New Word Modal
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newWord, setNewWord] = useState('');
  const [newIpa, setNewIpa] = useState('');
  const [newNote, setNewNote] = useState('');

  const filteredCards = pronunciationMistakes.filter((item) =>
    activeTab === 'needs_practice' ? !item.isMastered : item.isMastered
  );

  // Guard against out-of-bounds index after card is marked mastered
  useEffect(() => {
    if (filteredCards.length > 0 && currentIndex >= filteredCards.length) {
      setCurrentIndex(Math.max(0, filteredCards.length - 1));
    }
  }, [filteredCards.length, currentIndex]);

  const activeCard: MistakeItem | undefined = filteredCards[currentIndex];

  const calculateLevenshteinSimilarity = (s1: string, s2: string): number => {
    const a = s1.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const b = s2.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    if (a === b) return 100;
    if (!a || !b) return 0;

    const matrix: number[][] = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0]![j] = j;

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i]![j] = matrix[i - 1]![j - 1]!;
        } else {
          matrix[i]![j] = Math.min(
            matrix[i - 1]![j - 1]! + 1,
            matrix[i][j - 1]! + 1,
            matrix[i - 1]![j]! + 1
          );
        }
      }
    }

    const dist = matrix[b.length]![a.length]!;
    const maxLen = Math.max(a.length, b.length);
    return Math.max(0, Math.round(((maxLen - dist) / maxLen) * 100));
  };

  const calculateSimilarity = (spoken: string, targetWord: string): number => {
    const cleanSpoken = spoken.trim().toLowerCase();
    const cleanTarget = targetWord.trim().toLowerCase().replace(/[^a-z0-9]/g, '');

    // Direct match
    if (cleanSpoken.replace(/[^a-z0-9]/g, '') === cleanTarget) {
      return 100;
    }

    // Individual tokens in spoken transcript
    const tokens = cleanSpoken
      .split(/\s+/)
      .map((w) => w.replace(/[^a-z0-9]/g, ''))
      .filter(Boolean);

    if (tokens.includes(cleanTarget)) {
      return 100;
    }

    const wholeSim = calculateLevenshteinSimilarity(spoken, targetWord);
    let maxTokenSim = 0;
    for (const t of tokens) {
      const sim = calculateLevenshteinSimilarity(t, cleanTarget);
      if (sim > maxTokenSim) {
        maxTokenSim = sim;
      }
    }

    return Math.max(wholeSim, maxTokenSim);
  };

  const isRecordingRef = useRef(false);
  isRecordingRef.current = isRecording;
  const activeCardRef = useRef<MistakeItem | undefined>(activeCard);
  activeCardRef.current = activeCard;

  const recognitionBufferRef = useRef('');

  const startPronounceTest = () => {
    const card = activeCardRef.current;
    if (!card || isRecordingRef.current) return;
    setEvaluationResult(null);
    setUserTranscript('');
    recognitionBufferRef.current = '';
    setIsRecording(true);

    container.speechTTSEngine.stop();

    container.speechSTTEngine.start({
      onUpdate: (finalText, interimText) => {
        const full = `${finalText} ${interimText}`.trim();
        recognitionBufferRef.current = full;
        setUserTranscript(full);
      },
      onError: (err) => {
        console.warn('STT Error in Lab:', err);
        setIsRecording(false);
      },
    });
  };

  const stopPronounceTest = () => {
    const card = activeCardRef.current;
    if (!card || !isRecordingRef.current) return;
    setIsRecording(false);
    const spoken = container.speechSTTEngine.stop() || recognitionBufferRef.current;
    setUserTranscript(spoken);

    if (!spoken.trim()) {
      setEvaluationResult({
        accuracy: 0,
        feedback: "Could not hear audio clearly. Please hold the Space key or microphone button while speaking.",
        isSuccess: false,
      });
      return;
    }

    const accuracy = calculateSimilarity(spoken, card.word);
    const isSuccess = accuracy >= 80;

    if (isSuccess) {
      markMistakeMastered(card.word);
      setEvaluationResult({
        accuracy,
        feedback: `Excellent! Your pronunciation matched with ${accuracy}% accuracy. Marked as Mastered!`,
        isSuccess: true,
      });
    } else {
      setEvaluationResult({
        accuracy,
        feedback: `Keep practicing! You pronounced: "${spoken}" (Accuracy: ${accuracy}%). Listen to the standard audio and try again.`,
        isSuccess: false,
      });
    }
  };

  const toggleRecording = () => {
    if (isRecordingRef.current) {
      stopPronounceTest();
    } else {
      startPronounceTest();
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        const target = e.target as HTMLElement | null;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
          return;
        }
        e.preventDefault();
        startPronounceTest();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        const target = e.target as HTMLElement | null;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
          return;
        }
        e.preventDefault();
        stopPronounceTest();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const handleNext = () => {
    setEvaluationResult(null);
    setUserTranscript('');
    if (currentIndex < filteredCards.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setCurrentIndex(0);
    }
  };

  const handlePrev = () => {
    setEvaluationResult(null);
    setUserTranscript('');
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    } else {
      setCurrentIndex(Math.max(0, filteredCards.length - 1));
    }
  };

  const handleListenStandard = (word: string) => {
    container.speechTTSEngine.speak(word, { rate: 0.9 });
  };

  const handleAddNewWord = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWord.trim()) return;

    addPronunciationMistake({
      word: newWord.trim(),
      ipa: newIpa.trim() || `/${newWord.trim().toLowerCase()}/`,
      contextSentence: `I am actively practicing the pronunciation of "${newWord.trim()}".`,
      errorReason: newNote.trim() || 'User custom practice word',
      suggestedAlternative: 'Standard native articulation',
      topicTitle: 'Custom Vocabulary',
    });

    setNewWord('');
    setNewIpa('');
    setNewNote('');
    setAddModalOpen(false);
  };

  const needsCount = pronunciationMistakes.filter((m) => !m.isMastered).length;
  const masteredCount = pronunciationMistakes.filter((m) => m.isMastered).length;

  return (
    <div className="flex-1 p-6 md:p-8 overflow-y-auto bg-slate-50 select-none">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <span>Pronunciation & IPA Lab</span>
              <span className="text-[11px] bg-teal-100 text-teal-800 font-bold px-2 py-0.5 rounded-full">
                Interactive Flashcards
              </span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Review and master words & phrases flagged during your conversation sessions.
            </p>
          </div>

          <button
            onClick={() => setAddModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add Custom Word</span>
          </button>
        </div>

        {/* Tab Filters */}
        <div className="flex items-center gap-2 p-1 bg-slate-200/70 rounded-2xl">
          <button
            onClick={() => {
              setActiveTab('needs_practice');
              setCurrentIndex(0);
              setEvaluationResult(null);
            }}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'needs_practice'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Needs Practice</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                activeTab === 'needs_practice'
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-slate-300 text-slate-700'
              }`}
            >
              {needsCount}
            </span>
          </button>

          <button
            onClick={() => {
              setActiveTab('mastered');
              setCurrentIndex(0);
              setEvaluationResult(null);
            }}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'mastered'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Mastered</span>
            </span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                activeTab === 'mastered'
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-slate-300 text-slate-700'
              }`}
            >
              {masteredCount}
            </span>
          </button>
        </div>

        {/* Flashcard Area */}
        {filteredCards.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 shadow-xs">
            <Award className="w-12 h-12 text-teal-500 mx-auto mb-3 stroke-1" />
            <h3 className="text-sm font-bold text-slate-800 mb-1">
              {activeTab === 'needs_practice'
                ? 'No words currently need practice!'
                : 'No words mastered yet.'}
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4 leading-relaxed">
              {activeTab === 'needs_practice'
                ? 'All flagged mispronunciations have been mastered, or you can practice in Conversation Practice to auto-capture new words.'
                : 'Practice words in the "Needs Practice" tab to achieve >= 80% accuracy and move them here.'}
            </p>
          </div>
        ) : activeCard ? (
          <div className="space-y-4">
            {/* Flashcard Card Body */}
            <div className="bg-white rounded-3xl border-2 border-slate-200/90 shadow-md p-6 md:p-8 space-y-6 relative overflow-hidden">
              {/* Top Card Badge: Source Topic & Mistake Count */}
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-teal-800 bg-teal-50 px-2.5 py-1 rounded-full border border-teal-100">
                  Topic: {activeCard.topicTitle}
                </span>

                <div className="flex items-center gap-1.5 text-xs text-amber-700 font-semibold bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                  <Flame className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                  <span>Mispronounced {activeCard.mistakeCount}x</span>
                </div>
              </div>

              {/* Main Word & IPA Display */}
              <div className="text-center space-y-2 py-2">
                <h3 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight">
                  {activeCard.word}
                </h3>
                <div className="flex items-center justify-center gap-3">
                  <span className="font-mono text-base font-bold text-teal-700 bg-teal-50/80 px-3 py-1 rounded-xl border border-teal-100">
                    {activeCard.ipa}
                  </span>
                  <button
                    onClick={() => handleListenStandard(activeCard.word)}
                    title="Listen to standard native pronunciation"
                    className="p-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white shadow-xs transition-all active:scale-95"
                  >
                    <Volume2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Mistake Diagnosis Box */}
              <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200/80 text-xs space-y-1">
                <span className="font-bold text-amber-900 block">
                  Diagnosis / Why you missed it:
                </span>
                <p className="text-amber-800 leading-relaxed font-normal">
                  {activeCard.errorReason}
                </p>
                {activeCard.suggestedAlternative && (
                  <p className="text-teal-800 font-medium pt-1 text-[11px]">
                    Tip: {activeCard.suggestedAlternative}
                  </p>
                )}
              </div>

              {/* Context Sentence */}
              <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                <span className="font-bold text-slate-700 block mb-0.5">Example in Context:</span>
                <p className="italic font-serif text-slate-700 text-sm">
                  "{activeCard.contextSentence}"
                </p>
              </div>

              {/* Interactive Practice Recording Area */}
              <div className="pt-2 border-t border-slate-100 flex flex-col items-center gap-3">
                <div className="text-center space-y-1">
                  <p className="text-[11px] font-semibold text-slate-500">
                    Nhấn giữ <kbd className="font-mono bg-slate-100 border border-slate-300 px-1.5 py-0.5 rounded text-[10px] font-bold text-slate-700">Space</kbd> hoặc click biểu tượng Micro để đọc thử từ này: <span className="text-slate-800 font-bold">"{activeCard.word}"</span>
                  </p>
                </div>

                <button
                  type="button"
                  onClick={toggleRecording}
                  className={`w-full max-w-sm py-3.5 px-6 rounded-2xl font-bold text-xs flex items-center justify-center gap-2.5 transition-all shadow-sm cursor-pointer ${
                    isRecording
                      ? 'bg-rose-600 hover:bg-rose-700 text-white ring-4 ring-rose-200 animate-pulse'
                      : 'bg-teal-600 hover:bg-teal-700 text-white active:scale-98'
                  }`}
                >
                  <Mic className={`w-4 h-4 ${isRecording ? 'animate-bounce' : ''}`} />
                  <span>{isRecording ? 'Listening... Click to Stop & Evaluate' : 'Click to Pronounce (or Hold Space)'}</span>
                </button>

                {userTranscript && (
                  <div className="text-xs text-slate-500 font-medium">
                    Detected speech: <span className="font-semibold text-slate-800">"{userTranscript}"</span>
                  </div>
                )}

                {/* Evaluation Feedback Banner */}
                {evaluationResult && (
                  <div
                    className={`w-full p-3.5 rounded-2xl text-xs font-semibold border flex items-start gap-2.5 animate-in fade-in ${
                      evaluationResult.isSuccess
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                        : 'bg-rose-50 border-rose-200 text-rose-900'
                    }`}
                  >
                    {evaluationResult.isSuccess ? (
                      <Award className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <RotateCcw className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <p>{evaluationResult.feedback}</p>
                      {evaluationResult.isSuccess && (
                        <button
                          onClick={handleNext}
                          className="mt-2 px-3 py-1 bg-emerald-600 text-white rounded-lg text-[11px] font-bold shadow-2xs hover:bg-emerald-700 transition-colors"
                        >
                          Next Card →
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Navigation Buttons & Progress Bar */}
            <div className="flex items-center justify-between px-2">
              <button
                onClick={handlePrev}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-100 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Previous</span>
              </button>

              <span className="text-xs font-bold text-slate-600 font-mono">
                Card {currentIndex + 1} of {filteredCards.length}
              </span>

              <button
                onClick={handleNext}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-100 transition-colors"
              >
                <span>Next</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : null}

        {/* Modal: Add Custom Word */}
        {addModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-xl border border-slate-200 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-900">Add Word to Pronunciation Lab</h3>
                <button
                  onClick={() => setAddModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleAddNewWord} className="space-y-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Word or Phrase <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newWord}
                    onChange={(e) => setNewWord(e.target.value)}
                    placeholder="e.g. entrepreneurship"
                    required
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    IPA Transcription (Optional)
                  </label>
                  <input
                    type="text"
                    value={newIpa}
                    onChange={(e) => setNewIpa(e.target.value)}
                    placeholder="e.g. /ˌɒntrəprəˈnɜːʃɪp/"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Pronunciation Note / Trọng âm (Optional)
                  </label>
                  <input
                    type="text"
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="e.g. Trọng âm chính rơi vào âm tiết thứ 4"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setAddModalOpen(false)}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-xs"
                  >
                    Save Word
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
