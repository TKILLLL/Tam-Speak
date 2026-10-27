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
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useTamSpeakStore, EphemeralTurn, OrbState } from '../../store';
import { useAudioAnalyzer } from '../../../infrastructure/audio/useAudioAnalyzer';
import { container } from '../../../di/DIContainer';

const INITIAL_FRIEND_GREETING =
  "Hey! What's up? How is your day going so far?";

const MiniGlowingOrb: React.FC<{ orbState: OrbState; audioLevel: number }> = ({
  orbState,
  audioLevel,
}) => {
  const dynamicScale = orbState === 'listening' ? 1 + audioLevel * 0.35 : 1;

  return (
    <div className="relative flex items-center justify-center w-10 h-10 shrink-0">
      <motion.div
        animate={
          orbState === 'idle'
            ? { scale: [1, 1.1, 1], opacity: [0.35, 0.55, 0.35] }
            : orbState === 'listening'
            ? { scale: dynamicScale * 1.25, opacity: 0.8 }
            : orbState === 'thinking'
            ? { rotate: 360, opacity: [0.5, 0.8, 0.5] }
            : { scale: [1, 1.18, 1], opacity: [0.65, 0.95, 0.65] }
        }
        transition={
          orbState === 'thinking'
            ? { repeat: Infinity, duration: 2.2, ease: 'linear' }
            : { repeat: Infinity, duration: 3, ease: 'easeInOut' }
        }
        className="absolute w-8 h-8 rounded-full bg-gradient-to-tr from-teal-500 via-cyan-400 to-sky-300 blur-xs pointer-events-none"
      />
      <motion.div
        animate={
          orbState === 'idle'
            ? { scale: [1, 1.05, 1] }
            : orbState === 'listening'
            ? { scale: dynamicScale }
            : orbState === 'thinking'
            ? { scale: [0.95, 1.05, 0.95] }
            : { scale: [1, 1.08, 1] }
        }
        className="relative w-8 h-8 rounded-full bg-gradient-to-br from-teal-500 via-cyan-500 to-teal-700 shadow-xs border border-white/70 flex items-center justify-center"
      >
        <Sparkles className="w-3.5 h-3.5 text-white" />
      </motion.div>
    </div>
  );
};

export const SpeakingAIView: React.FC = () => {
  const {
    orbState,
    setOrbState,
    audioLevel,
    setAudioLevel,
    liveSpeechTranscript,
    setLiveSpeechTranscript,
    isAutoVadEnabled,
    toggleAutoVad,
    user,
    ephemeralMessages,
    addEphemeralMessage,
    clearEphemeralMessages,
    addPronunciationMistake,
  } = useTamSpeakStore();

  const [isHolding, setIsHolding] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const audioAnalyzer = useAudioAnalyzer();
  const transcriptBufferRef = useRef('');
  const isHoldingRef = useRef(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const isMountedRef = useRef(false);

  // Sync real-time audio amplitude to store for Mini Glowing Orb
  useEffect(() => {
    if (audioAnalyzer.isListening) {
      setAudioLevel(audioAnalyzer.audioLevel);
    }
  }, [audioAnalyzer.audioLevel, audioAnalyzer.isListening, setAudioLevel]);

  // Auto-scroll chat stream to the latest message
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [ephemeralMessages, liveSpeechTranscript, orbState]);

  // Initial Greeting & Lifecycle Ephemeral Memory Cleanup (Requirement 2 & 3 & 4)
  useEffect(() => {
    isMountedRef.current = true;

    // 1. Initial Greeting when entering view
    if (ephemeralMessages.length === 0) {
      const initGreetingTurn: EphemeralTurn = {
        id: `ephem-ai-init-${Date.now()}`,
        speaker: 'ai',
        text: INITIAL_FRIEND_GREETING,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      addEphemeralMessage(initGreetingTurn);

      setOrbState('speaking');
      container.speechTTSEngine.speak(INITIAL_FRIEND_GREETING, {
        onEnd: () => {
          if (isMountedRef.current) setOrbState('idle');
        },
        onError: () => {
          if (isMountedRef.current) setOrbState('idle');
        },
      });
    }

    // 2. Unmount Cleanup: Stop TTS, export mistakes to Pronunciation Lab, wipe ephemeral memory
    return () => {
      isMountedRef.current = false;

      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try {
          window.speechSynthesis.cancel();
        } catch {
          // noop
        }
      }
      container.speechTTSEngine.stop();

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
  }, [addEphemeralMessage, addPronunciationMistake, clearEphemeralMessages, setLiveSpeechTranscript, setOrbState]);

  // Start Voice Input
  const startVoiceInput = useCallback(async () => {
    if (isHoldingRef.current) return;
    isHoldingRef.current = true;
    setIsHolding(true);
    setOrbState('listening');

    // Cancel running TTS to avoid microphone picking up speaker echo
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

    // High-Precision Hybrid Live STT Verification
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

    // 4. Stale Closure Fix: Always read the latest full session history directly from store
    const latestMessages = useTamSpeakStore.getState().ephemeralMessages;
    const fullSessionHistory = latestMessages.map((m) => ({
      speaker: m.speaker,
      text: m.text,
    }));

    try {
      const result = await container.chatSpeakingAIUseCase.execute({
        userId,
        rawSttInput: spokenTranscript,
        conversationHistory: fullSessionHistory,
      });

      // 5. Save mispronounced words immediately to Pronunciation & IPA Lab
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

      // 6. Push User Turn (with Contextual Phonetic Auto-Correction metadata)
      const userTurn: EphemeralTurn = {
        id: `ephem-user-${Date.now()}`,
        speaker: 'user',
        text: result.inferredIntendedMeaning || spokenTranscript,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        rawSttInput: spokenTranscript,
        inferredIntendedMeaning: result.inferredIntendedMeaning,
        wasSttMisrecognized: result.wasSttMisrecognized,
        casualNativeTip: result.casualNativeTip,
        mispronouncedWords: result.mispronouncedWords,
      };
      addEphemeralMessage(userTurn);

      // 7. Push AI Turn
      const aiTurn: EphemeralTurn = {
        id: `ephem-ai-${Date.now()}`,
        speaker: 'ai',
        text: result.friendReply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      addEphemeralMessage(aiTurn);

      // 8. Play AI speech reply via TTS
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
        'Chưa cấu hình API Key hoặc kết nối AI thất bại. Vui lòng kiểm tra API Key (Google Gemini hoặc Groq) trong mục "AI & Voice Settings".';
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

  // Global Keyboard listener for Space bar
  useEffect(() => {
    const isTypingInInput = (target: HTMLElement | null): boolean => {
      if (!target) return false;
      const tag = target.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (isTypingInInput(target)) return;

      if (e.code === 'Space') {
        e.preventDefault();
        if (!e.repeat && !isHoldingRef.current) {
          startVoiceInput();
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (isTypingInInput(target)) return;

      if (e.code === 'Space') {
        e.preventDefault();
        if (isHoldingRef.current) {
          stopVoiceInput();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [startVoiceInput, stopVoiceInput]);

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
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center justify-between shadow-2xs">
              <div className="flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                <span className="font-medium">{errorMessage}</span>
              </div>
              <button
                onClick={() => setErrorMessage(null)}
                className="text-red-500 hover:text-red-700 font-semibold px-2 py-0.5 rounded-md hover:bg-red-100 transition-colors shrink-0"
              >
                Đóng
              </button>
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
          {/* Live Speech Detection Text (real-time stream) */}
          {(orbState === 'listening' || liveSpeechTranscript) && (
            <div className="w-full p-2 px-3.5 rounded-xl bg-teal-50 border border-teal-200 text-teal-900 text-xs shadow-2xs flex items-center gap-2 animate-in fade-in">
              <span className="w-2 h-2 rounded-full bg-teal-500 animate-ping shrink-0" />
              <span className="text-slate-500 font-semibold shrink-0">Live Detection:</span>
              <span className="font-medium text-slate-900 truncate">
                {liveSpeechTranscript || 'Listening... speak into your microphone'}
              </span>
              <span className="inline-block w-1.5 h-3.5 bg-teal-600 animate-pulse shrink-0" />
            </div>
          )}

          {/* Control Bar: Mini Glowing Orb + Hold [Space] Button + Auto VAD & Clear */}
          <div className="flex items-center justify-between gap-3">
            {/* Left: Mini Glowing AI Orb & State */}
            <div className="flex items-center gap-2.5 min-w-[120px]">
              <MiniGlowingOrb orbState={orbState} audioLevel={audioLevel} />
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

            {/* Center: Prominent Push-to-Talk Button */}
            <button
              onMouseDown={startVoiceInput}
              onMouseUp={stopVoiceInput}
              onTouchStart={startVoiceInput}
              onTouchEnd={stopVoiceInput}
              className={`flex-1 max-w-sm flex items-center justify-center gap-2.5 px-6 py-3 rounded-2xl font-bold text-xs tracking-wide transition-all shadow-sm active:scale-95 border cursor-pointer ${
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
                  <span>Release to Send</span>
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4 text-teal-600" />
                  <span>Hold [Space] to Talk</span>
                </>
              )}
            </button>

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
