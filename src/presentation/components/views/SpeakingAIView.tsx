import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Mic,
  Radio,
  RotateCcw,
  Volume2,
  Sparkles,
  AlertCircle,
  CheckCircle,
  Lightbulb,
  Square,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useTamSpeakStore, EphemeralTurn, OrbState } from '../../store';
import { useAudioAnalyzer } from '../../../infrastructure/audio/useAudioAnalyzer';
import { SpeechNoiseFilter } from '../../../infrastructure/audio/SpeechNoiseFilter';
import { SharedAudioContext } from '../../../infrastructure/audio/SharedAudioContext';
import { LiveSpeechDetectionBar } from '../voice-stage/LiveSpeechDetectionBar';
import { container } from '../../../di/DIContainer';
import { aiService } from '../../../infrastructure/ai/AIService';

const MiniGlowingOrb: React.FC<{ orbState: OrbState }> = ({
  orbState,
}) => {
  const coreRef = useRef<HTMLDivElement>(null);
  const haloRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (orbState !== 'listening') return;

    const unsubscribe = SharedAudioContext.subscribeLevel((level) => {
      const scale = 1 + level * 0.35;
      if (coreRef.current) {
        coreRef.current.style.transform = `scale3d(${scale}, ${scale}, 1)`;
      }
      if (haloRef.current) {
        haloRef.current.style.transform = `scale3d(${scale * 1.2}, ${scale * 1.2}, 1)`;
      }
    });

    return () => {
      unsubscribe();
      if (coreRef.current) coreRef.current.style.transform = '';
      if (haloRef.current) haloRef.current.style.transform = '';
    };
  }, [orbState]);

  return (
    <div className="relative flex items-center justify-center w-10 h-10 shrink-0">
      <div
        ref={haloRef}
        style={{ willChange: 'transform' }}
        className="absolute w-8 h-8 rounded-full bg-gradient-to-tr from-teal-500 via-cyan-400 to-sky-300 blur-xs pointer-events-none transition-transform duration-75"
      >
        <motion.div
          animate={
            orbState === 'idle'
              ? { scale: [1, 1.1, 1], opacity: [0.35, 0.55, 0.35] }
              : orbState === 'thinking'
              ? { rotate: 360, opacity: [0.5, 0.8, 0.5] }
              : { scale: [1, 1.18, 1], opacity: [0.65, 0.95, 0.65] }
          }
          transition={
            orbState === 'thinking'
              ? { repeat: Infinity, duration: 2.2, ease: 'linear' }
              : { repeat: Infinity, duration: 3, ease: 'easeInOut' }
          }
          className="w-full h-full rounded-full"
        />
      </div>
      <div
        ref={coreRef}
        style={{ willChange: 'transform' }}
        className="relative w-8 h-8 rounded-full bg-gradient-to-br from-teal-500 via-cyan-500 to-teal-700 shadow-xs border border-white/70 flex items-center justify-center transition-transform duration-75"
      >
        <Sparkles className="w-3.5 h-3.5 text-white" />
      </div>
    </div>
  );
};

export const SpeakingAIView: React.FC = () => {
  const {
    orbState,
    setOrbState,
    setLiveSpeechTranscript,
    isAutoVadEnabled,
    setIsAutoVadEnabled,
    toggleAutoVad,
    user,
    ephemeralMessages,
    addEphemeralMessage,
    clearEphemeralMessages,
    addPronunciationMistake,
    setCurrentView,
  } = useTamSpeakStore();

  const [isHolding, setIsHolding] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const audioAnalyzer = useAudioAnalyzer();
  const transcriptBufferRef = useRef('');
  const isHoldingRef = useRef(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const isMountedRef = useRef(false);
  const lastApiCallTimestampRef = useRef<number>(0);
  const activeAbortControllerRef = useRef<AbortController | null>(null);
  const sessionIdRef = useRef<string>(
    typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `ai-session-${Date.now()}`
  );

  const audioAnalyzerRef = useRef(audioAnalyzer);
  audioAnalyzerRef.current = audioAnalyzer;

  const startVoiceInputRef = useRef<() => Promise<void>>(() => Promise.resolve());
  const stopVoiceInputRef = useRef<() => Promise<void>>(() => Promise.resolve());

  // Auto-scroll chat stream to the latest message
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [ephemeralMessages, orbState]);

  // Initial Greeting & Lifecycle Ephemeral Memory Cleanup (Run ONCE on mount and unmount)
  useEffect(() => {
    isMountedRef.current = true;

    // 1. 100% Dynamic Contextual AI Greeting via Gemini when entering view
    if (ephemeralMessages.length === 0) {
      setOrbState('thinking');
      aiService
        .generateAlexGreeting(user?.displayName)
        .then((greeting) => {
          if (!isMountedRef.current) return;
          const initGreetingTurn: EphemeralTurn = {
            id: `ephem-ai-init-${Date.now()}`,
            speaker: 'ai',
            text: greeting,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          };
          addEphemeralMessage(initGreetingTurn);

          setOrbState('speaking');
          container.speechTTSEngine.speak(greeting, {
            onEnd: () => {
              if (isMountedRef.current) setOrbState('idle');
            },
            onError: () => {
              if (isMountedRef.current) setOrbState('idle');
            },
          });
        })
        .catch(() => {
          if (isMountedRef.current) setOrbState('idle');
        });
    }

    // 2. Unmount Cleanup: Stop TTS & STT, abort recordings, export mistakes, wipe ephemeral memory
    return () => {
      isMountedRef.current = false;

      if (vadSilenceTimerRef.current) {
        clearTimeout(vadSilenceTimerRef.current);
        vadSilenceTimerRef.current = null;
      }

      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try {
          window.speechSynthesis.cancel();
        } catch {
          // noop
        }
      }
      container.speechTTSEngine.stop();
      container.speechSTTEngine.stop();
      container.speechSTTEngine.abort();
      audioAnalyzerRef.current.stopAnalyzing(0);
      setIsAutoVadEnabled(false);

      // Automatically push detected mistakes to Pronunciation & IPA Lab before clearing
      const currentMessages = useTamSpeakStore.getState().ephemeralMessages;
      currentMessages.forEach((turn) => {
        turn.mispronouncedWords?.forEach((m) => {
          addPronunciationMistake({
            word: m.word,
            ipa: m.ipa,
            contextSentence: turn.inferredIntendedMeaning || turn.text,
            errorReason: m.reason,
            suggestedAlternative: 'Practiced with Alex (Native Companion)',
            topicTitle: 'Speaking AI (Casual Chat)',
          });
        });
      });

      // Clear volatile in-memory messages & reset orb
      clearEphemeralMessages();
      setOrbState('idle');
      setLiveSpeechTranscript('');
    };
  }, []);

  // Start Voice Input
  const startVoiceInput = useCallback(async () => {
    if (isHoldingRef.current) return;
    isHoldingRef.current = true;
    setIsHolding(true);
    setOrbState('listening');

    // Echo Prevention: Cancel running TTS immediately to avoid microphone picking up speaker echo
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // noop
      }
    }
    container.speechTTSEngine.stop();

    try {
      const micStream = await audioAnalyzer.startAnalyzing();
      await container.audioRecorderEngine.start(micStream);

      transcriptBufferRef.current = '';
      setLiveSpeechTranscript('');

      container.speechSTTEngine.start({
        onUpdate: (finalText, interimText) => {
          const combined = `${finalText} ${interimText}`.trim();
          transcriptBufferRef.current = combined;
          setLiveSpeechTranscript(combined);
        },
        onError: (err) => {
          console.warn('Speech recognition warning:', err);
        },
      });
    } catch (err: any) {
      console.error('Failed to access microphone or start STT:', err);
      setOrbState('idle');
      setIsHolding(false);
      isHoldingRef.current = false;
      setLiveSpeechTranscript('');
    }
  }, [audioAnalyzer, setLiveSpeechTranscript, setOrbState]);

  // Stop Voice Input & Send to AI Best Friend with Full History & Contextual Phonetic Auto-Correction
  const stopVoiceInput = useCallback(async () => {
    if (!isHoldingRef.current) return;
    isHoldingRef.current = false;
    setIsHolding(false);
    setOrbState('thinking');

    // 1. Stop Speech-to-Text
    let spokenTranscript = container.speechSTTEngine.stop() || transcriptBufferRef.current;
    setLiveSpeechTranscript('');

    // 2. Stop Audio Analyzer
    const wordCount = spokenTranscript.split(/\s+/).filter(Boolean).length;
    audioAnalyzer.stopAnalyzing(wordCount);

    // 3. Stop MediaRecorder
    const userId = user?.id || 'guest-user';
    const tempSessionId = `speaking-ai-${Date.now()}`;
    let recResult: { recordingId: string; blob: Blob; mimeType: string; durationSeconds: number } | null = null;
    try {
      recResult = await container.audioRecorderEngine.stop(userId, tempSessionId);
    } catch {
      // safe fallback
    }

    // High-Precision Hybrid Speech Recognition (gemini-3.5-transcribe STT):
    // Prioritize Gemini transcription from audio blob to accurately recognize Vietnamese names & accents
    if (recResult?.blob && container.aiGateway.transcribeAudio) {
      try {
        const verified = await container.aiGateway.transcribeAudio(
          recResult.blob,
          'Casual English conversation between close friends'
        );
        if (verified && verified.trim().length > 0) {
          spokenTranscript = verified.trim();
        }
      } catch (err) {
        console.warn('Whisper verification notice:', err);
      }
    }

    if (!spokenTranscript.trim()) {
      setOrbState('idle');
      return;
    }

    const actualDurationSeconds = recResult?.durationSeconds || 1;
    const speechValidation = SpeechNoiseFilter.validateSpeech(spokenTranscript, actualDurationSeconds);
    if (!speechValidation.isValid) {
      console.warn('Discarded accidental voice / noise input:', speechValidation.reason, spokenTranscript);
      setOrbState('idle');
      return;
    }
    spokenTranscript = speechValidation.cleanedText;

    // 4. Optimistic UI: Display user utterance immediately (0ms latency feedback)
    const optimisticTurnId = `ephem-user-${Date.now()}`;
    const optimisticUserTurn: EphemeralTurn = {
      id: optimisticTurnId,
      speaker: 'user',
      text: spokenTranscript,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      rawSttInput: spokenTranscript,
    };
    addEphemeralMessage(optimisticUserTurn);

    // 5. Network Race Condition Guard: Track current turn session ID
    const turnSessionId = sessionIdRef.current;
    if (activeAbortControllerRef.current) {
      activeAbortControllerRef.current.abort();
    }
    activeAbortControllerRef.current = new AbortController();

    // 6. Stale Closure Fix: Always read the latest full session history directly from store
    const latestMessages = useTamSpeakStore.getState().ephemeralMessages;
    const fullSessionHistory = latestMessages.map((m) => ({
      speaker: m.speaker,
      text: m.text,
    }));

    try {
      // Silent Rate Limit Pacing: Ensure at least 3.8s spacing between consecutive AI calls while showing 'thinking'
      const MIN_INTERVAL_MS = 3800;
      const now = Date.now();
      const elapsed = now - lastApiCallTimestampRef.current;
      if (lastApiCallTimestampRef.current > 0 && elapsed < MIN_INTERVAL_MS) {
        const silentDelay = MIN_INTERVAL_MS - elapsed;
        await new Promise((resolve) => setTimeout(resolve, silentDelay));
      }
      lastApiCallTimestampRef.current = Date.now();

      const result = await container.chatSpeakingAIUseCase.execute({
        userId,
        rawSttInput: spokenTranscript,
        conversationHistory: fullSessionHistory,
      });

      // Async Race Condition Check: If user cleared chat or left view, drop stale result
      if (turnSessionId !== sessionIdRef.current) {
        return;
      }

      // 7. Save mispronounced words immediately to Pronunciation & IPA Lab
      result.mispronouncedWords?.forEach((m) => {
        addPronunciationMistake({
          word: m.word,
          ipa: m.ipa,
          contextSentence: result.inferredIntendedMeaning || spokenTranscript,
          errorReason: m.reason,
          suggestedAlternative: 'Practiced with Alex (Native Companion)',
          topicTitle: 'Speaking AI (Casual Chat)',
        });
      });

      // 8. Push AI Turn
      const aiTurn: EphemeralTurn = {
        id: `ephem-ai-${Date.now()}`,
        speaker: 'ai',
        text: result.friendReply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      addEphemeralMessage(aiTurn);

      // 9. Play AI speech reply via TTS
      setOrbState('speaking');
      container.speechTTSEngine.speak(result.friendReply, {
        onEnd: () => {
          if (isMountedRef.current) setOrbState('idle');
        },
        onError: () => {
          if (isMountedRef.current) setOrbState('idle');
        },
      });
    } catch (err) {
      console.error('Speaking AI conversation error:', err);
      setOrbState('idle');
      const errorMsg =
        (err as Error).message ||
        'Chưa cấu hình API Key hoặc kết nối AI thất bại. Vui lòng kiểm tra API Key Google Gemini trong mục "AI & Voice Settings".';
      setErrorMessage(errorMsg);

      // Preserve user speech in the ephemeral stream without fake AI reply
      const userTurn: EphemeralTurn = {
        id: `ephem-user-${Date.now()}`,
        speaker: 'user',
        text: spokenTranscript,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        rawSttInput: spokenTranscript,
      };
      addEphemeralMessage(userTurn);
    }
  }, [
    addEphemeralMessage,
    addPronunciationMistake,
    audioAnalyzer,
    setLiveSpeechTranscript,
    setOrbState,
    user?.id,
  ]);

  useEffect(() => {
    startVoiceInputRef.current = startVoiceInput;
    stopVoiceInputRef.current = stopVoiceInput;
  });

  // Global Keyboard listener for Space bar
  useEffect(() => {
    const isTypingInInput = (target: HTMLElement | null): boolean => {
      if (!target) return false;
      const tag = target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) {
        return true;
      }
      if (target.closest('[role="dialog"]') || target.closest('.modal')) {
        return true;
      }
      return false;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (isTypingInInput(target)) return;

      if (e.code === 'Space') {
        e.preventDefault();
        if (!e.repeat && !isHoldingRef.current) {
          startVoiceInputRef.current();
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (isTypingInInput(target)) return;

      if (e.code === 'Space') {
        e.preventDefault();
        if (isHoldingRef.current) {
          stopVoiceInputRef.current();
        }
      }
    };

    // Prevent stuck "Recording" state when Alt+Tabbing or clicking out of browser
    const handleBlur = () => {
      if (isHoldingRef.current) {
        stopVoiceInputRef.current();
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden && isHoldingRef.current) {
        stopVoiceInputRef.current();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Auto VAD Hands-Free Flow with Echo Lock
  const vadSilenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isAutoVadEnabled) {
      if (vadSilenceTimerRef.current) {
        clearTimeout(vadSilenceTimerRef.current);
        vadSilenceTimerRef.current = null;
      }
      return;
    }

    // ECHO LOCK: Strictly forbid mic activation if AI is speaking or thinking
    if (orbState === 'speaking' || orbState === 'thinking') {
      if (isHoldingRef.current) {
        stopVoiceInputRef.current();
      }
    }
  }, [isAutoVadEnabled, orbState]);

  // VAD Auto-Submit when silence follows substantial speech
  useEffect(() => {
    if (!isAutoVadEnabled || !isHoldingRef.current || orbState !== 'listening') {
      return;
    }

    if (SpeechNoiseFilter.hasSubstantialSpeechForVad(transcriptBufferRef.current)) {
      if (vadSilenceTimerRef.current) clearTimeout(vadSilenceTimerRef.current);
      vadSilenceTimerRef.current = setTimeout(() => {
        if (isHoldingRef.current && orbState === 'listening') {
          stopVoiceInputRef.current();
        }
      }, 2000);
    }

    return () => {
      if (vadSilenceTimerRef.current) clearTimeout(vadSilenceTimerRef.current);
    };
  }, [isAutoVadEnabled, orbState]);

  // Replay AI Audio
  const handleReplayAIMessage = (text: string) => {
    container.speechTTSEngine.stop();
    setOrbState('speaking');
    container.speechTTSEngine.speak(text, {
      onEnd: () => {
        if (isMountedRef.current) setOrbState('idle');
      },
      onError: () => {
        if (isMountedRef.current) setOrbState('idle');
      },
    });
  };

  // Reset / Clear Chat Stream
  const handleClearChat = () => {
    if (activeAbortControllerRef.current) {
      activeAbortControllerRef.current.abort();
      activeAbortControllerRef.current = null;
    }
    sessionIdRef.current = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `ai-session-${Date.now()}`;

    container.speechTTSEngine.stop();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    // Export any unmastered mistakes to Pronunciation Lab before wiping
    const currentMessages = useTamSpeakStore.getState().ephemeralMessages;
    currentMessages.forEach((turn) => {
      turn.mispronouncedWords?.forEach((m) => {
        addPronunciationMistake({
          word: m.word,
          ipa: m.ipa,
          contextSentence: turn.inferredIntendedMeaning || turn.text,
          errorReason: m.reason,
          suggestedAlternative: 'Practiced with Alex (Native Companion)',
          topicTitle: 'Speaking AI (Casual Chat)',
        });
      });
    });

    clearEphemeralMessages();
    setErrorMessage(null);

    // Start fresh with a friendly greeting
    const newGreetingTurn: EphemeralTurn = {
      id: `ephem-ai-init-${Date.now()}`,
      speaker: 'ai',
      text: "Fresh start! What is on your mind today?",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    addEphemeralMessage(newGreetingTurn);

    setOrbState('speaking');
    container.speechTTSEngine.speak("Fresh start! What is on your mind today?", {
      onEnd: () => {
        if (isMountedRef.current) setOrbState('idle');
      },
      onError: () => {
        if (isMountedRef.current) setOrbState('idle');
      },
    });
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-slate-50 select-none relative">
      {/* Top Header: Companion Status */}
      <header className="px-6 py-3 border-b border-slate-200 bg-white/95 backdrop-blur-xs flex items-center justify-between shrink-0 shadow-2xs z-10">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-teal-600 to-cyan-500 text-white flex items-center justify-center font-bold text-xs shadow-xs">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full ring-2 ring-white" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-900">Alex</h2>
              <span className="text-[10px] font-semibold text-teal-800 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-full">
                Native Companion
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              Natural conversation • Real-time phonetic auto-correction • Ephemeral memory
            </p>
          </div>
        </div>

        <button
          onClick={handleClearChat}
          title="Clear Chat and Start Fresh"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition-all active:scale-95"
        >
          <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
          <span>Clear Chat</span>
        </button>
      </header>

      {/* Part 1: Upper Chat Area (Scrollable Message Thread) */}
      <section className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        <div className="max-w-3xl w-full mx-auto space-y-4">
          {errorMessage && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center justify-between shadow-2xs gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                <span className="font-medium truncate">{errorMessage}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setCurrentView('settings')}
                  className="bg-red-600 hover:bg-red-700 text-white font-semibold px-2.5 py-1 rounded-lg transition-colors text-[11px]"
                >
                  Mở Cài Đặt
                </button>
                <button
                  onClick={() => setErrorMessage(null)}
                  className="text-red-500 hover:text-red-700 font-semibold px-2 py-1 rounded-md hover:bg-red-100 transition-colors"
                >
                  Đóng
                </button>
              </div>
            </div>
          )}

          {ephemeralMessages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.speaker === 'user' ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-2`}
            >
              {/* Message Header (Speaker & Timestamp) */}
              <div className="flex items-center gap-2 mb-1 px-1">
                <span className="text-[11px] font-bold text-slate-600">
                  {msg.speaker === 'user' ? 'You' : 'Alex'}
                </span>
                <span className="text-[10px] text-slate-400">{msg.timestamp}</span>
              </div>

              {/* Message Bubble */}
              <div
                className={`max-w-xl p-3.5 rounded-2xl shadow-2xs text-xs leading-relaxed ${
                  msg.speaker === 'user'
                    ? 'bg-teal-600 text-white rounded-tr-xs'
                    : 'bg-white border border-slate-200/90 text-slate-800 rounded-tl-xs'
                }`}
              >
                {/* Contextual Phonetic Auto-Correction Box (Requirement 4) */}
                {msg.speaker === 'user' && msg.wasSttMisrecognized && (
                  <div className="mb-2 p-2 rounded-xl bg-teal-700/70 border border-teal-500/80 text-[11px] space-y-1">
                    <div className="flex items-center gap-1 font-bold text-teal-100">
                      <CheckCircle className="w-3 h-3 text-teal-200" />
                      <span>Context Auto-Corrected</span>
                    </div>
                    <div className="text-teal-100 text-[10px] space-y-0.5">
                      <div>
                        <span className="opacity-75">STT heard: </span>
                        <span className="line-through italic opacity-85">"{msg.rawSttInput}"</span>
                      </div>
                      <div>
                        <span className="opacity-75">Understood as: </span>
                        <span className="font-semibold text-white">"{msg.inferredIntendedMeaning}"</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Primary Message Text */}
                <p className="font-normal text-[13px]">{msg.text}</p>

                {/* AI Audio Replay Button */}
                {msg.speaker === 'ai' && (
                  <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between">
                    <button
                      onClick={() => handleReplayAIMessage(msg.text)}
                      className="flex items-center gap-1 text-[11px] font-semibold text-teal-700 hover:text-teal-900 transition-colors"
                      title="Replay Audio"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                      <span>Listen</span>
                    </button>
                    <span className="text-[10px] text-slate-400">Spoken Reply</span>
                  </div>
                )}
              </div>

              {/* User Native Tip & Mispronounced Word Cards */}
              {msg.speaker === 'user' && (
                <div className="max-w-xl w-full space-y-1.5 mt-1.5">
                  {/* Mispronounced Words (Auto-saved to Pronunciation Lab) */}
                  {msg.mispronouncedWords && msg.mispronouncedWords.length > 0 && (
                    <div className="p-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] flex items-start gap-2">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                      <div className="space-y-0.5 flex-1">
                        <span className="font-bold text-[10px] uppercase tracking-wider text-amber-800 block">
                          Phonetic Friction (Saved to Pronunciation Lab)
                        </span>
                        {msg.mispronouncedWords.map((item, idx) => (
                          <div key={idx} className="flex items-baseline gap-1.5">
                            <span className="font-bold text-slate-900">{item.word}</span>
                            <span className="font-mono text-teal-700 text-[10px]">{item.ipa}</span>
                            <span className="text-slate-600 text-[10px]">- {item.reason}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Casual Native Tip */}
                  {msg.casualNativeTip && (
                    <div className="p-2 rounded-xl bg-sky-50 border border-sky-200 text-sky-900 text-[11px] flex items-start gap-2">
                      <Lightbulb className="w-3.5 h-3.5 text-sky-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-[10px] uppercase tracking-wider text-sky-800 block">
                          Casual Native Tip
                        </span>
                        <p className="text-sky-950 mt-0.5">{msg.casualNativeTip}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* Thinking indicator bubble */}
          {orbState === 'thinking' && (
            <div className="flex items-center gap-2 p-3 rounded-2xl bg-white border border-slate-200 text-slate-500 text-xs w-fit animate-pulse">
              <span className="w-2 h-2 rounded-full bg-teal-500 animate-ping" />
              <span>Alex is formulating a response...</span>
            </div>
          )}

          <div ref={chatBottomRef} />
        </div>
      </section>

      {/* Part 2: Fixed Audio Station (Pinned permanently at bottom) */}
      <footer className="shrink-0 border-t border-slate-200 bg-white/95 backdrop-blur-md px-6 py-3.5 z-10 shadow-lg">
        <div className="max-w-3xl w-full mx-auto space-y-2.5">
          {/* Live Speech Detection Text (Decoupled atomic 60fps renderer) */}
          <LiveSpeechDetectionBar />

          {/* Control Bar: Mini Glowing Orb + Hold [Space] Button + Auto VAD & Clear */}
          <div className="flex items-center justify-between gap-3">
            {/* Left: Mini Glowing AI Orb & State */}
            <div className="flex items-center gap-2.5 min-w-[120px]">
              <MiniGlowingOrb orbState={orbState} />
              <div className="hidden sm:flex flex-col">
                <span className="text-xs font-bold text-slate-800">Alex</span>
                <span className="text-[10px] text-slate-500">
                  {orbState === 'listening'
                    ? 'Listening...'
                    : orbState === 'thinking'
                    ? 'Thinking...'
                    : orbState === 'speaking'
                    ? 'Speaking...'
                    : 'Ready to talk'}
                </span>
              </div>
            </div>

            {/* Center Controls: 1-Click Toggle + Hold Space to Talk */}
            <div className="flex-1 max-w-md flex items-center justify-center gap-2">
              {/* Toggle 1-Click Recording Button (Ấn 1 lần để bật ghi âm, ấn 1 lần nữa để tắt/gửi) */}
              <button
                type="button"
                onClick={isHolding ? stopVoiceInput : startVoiceInput}
                title={isHolding ? 'Bấm để gửi câu trả lời' : 'Bấm 1 lần để mở ghi âm, bấm lần nữa để gửi'}
                className={`flex items-center gap-1.5 px-3.5 sm:px-4 py-3 rounded-2xl font-bold text-xs tracking-wide transition-all shadow-xs active:scale-95 border cursor-pointer ${
                  isHolding
                    ? 'bg-red-500 hover:bg-red-600 text-white border-red-400 ring-2 ring-red-400/20 shadow-md animate-pulse'
                    : 'bg-teal-600 hover:bg-teal-700 text-white border-teal-500 hover:shadow-md'
                }`}
              >
                {isHolding ? (
                  <>
                    <Square className="w-3.5 h-3.5 fill-white" />
                    <span>Bấm gửi</span>
                  </>
                ) : (
                  <>
                    <Mic className="w-3.5 h-3.5" />
                    <span>Bấm nói</span>
                  </>
                )}
              </button>

              {/* Push-to-Talk (Hold [Space]) */}
              <button
                type="button"
                onMouseDown={startVoiceInput}
                onMouseUp={stopVoiceInput}
                onTouchStart={startVoiceInput}
                onTouchEnd={stopVoiceInput}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-2xl font-bold text-xs tracking-wide transition-all shadow-xs active:scale-95 border cursor-pointer ${
                  isHolding
                    ? 'bg-gradient-to-r from-teal-500 to-cyan-500 text-white border-teal-400 ring-4 ring-teal-400/20 shadow-md'
                    : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-300 hover:shadow-md'
                }`}
              >
                {isHolding ? (
                  <>
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white" />
                    </span>
                    <Mic className="w-4 h-4 animate-pulse" />
                    <span>Thả để gửi</span>
                  </>
                ) : (
                  <>
                    <Mic className="w-4 h-4 text-teal-600" />
                    <span>Giữ [Space]</span>
                  </>
                )}
              </button>
            </div>

            {/* Right: Auto VAD & Clear Chat Actions */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                onClick={toggleAutoVad}
                title="Toggle Hands-Free Voice Activity Detection"
                className={`flex items-center gap-1 px-2.5 sm:px-3 py-2 rounded-xl border text-xs font-semibold transition-all ${
                  isAutoVadEnabled
                    ? 'bg-teal-50 border-teal-400 text-teal-800 ring-2 ring-teal-400/20'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Radio className={`w-3.5 h-3.5 ${isAutoVadEnabled ? 'text-teal-600 animate-pulse' : 'text-slate-400'}`} />
                <span className="hidden lg:inline">Auto VAD:</span>
                <span>{isAutoVadEnabled ? 'ON' : 'OFF'}</span>
              </button>

              <button
                onClick={handleClearChat}
                title="Reset conversation"
                className="flex items-center gap-1 px-2.5 sm:px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-semibold transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Reset</span>
              </button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
