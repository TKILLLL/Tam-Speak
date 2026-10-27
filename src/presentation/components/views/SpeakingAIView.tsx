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
import { useTamSpeakStore, EphemeralTurn } from '../../store';
import { useAudioAnalyzer } from '../../../infrastructure/audio/useAudioAnalyzer';
import { GlowingOrbVisualizer } from '../voice-stage/GlowingOrbVisualizer';
import { container } from '../../../di/DIContainer';

const INITIAL_FRIEND_GREETING =
  "Hey! What's up? How is your day going so far?";

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
  const audioAnalyzer = useAudioAnalyzer();
  const transcriptBufferRef = useRef('');
  const isHoldingRef = useRef(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const isMountedRef = useRef(false);

  // Sync real-time audio amplitude to store for Glowing Orb
  useEffect(() => {
    if (audioAnalyzer.isListening) {
      setAudioLevel(audioAnalyzer.audioLevel);
    }
  }, [audioAnalyzer.audioLevel, audioAnalyzer.isListening, setAudioLevel]);

  // Auto-scroll chat stream to bottom when new messages arrive
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTo({
        top: chatScrollRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [ephemeralMessages, orbState]);

  // Initial Greeting & Lifecycle Ephemeral Memory Cleanup (Requirement 2 & 3)
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
            suggestedAlternative: 'Practiced with Alex (Native Best Friend)',
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

  // Stop Voice Input & Send to AI Best Friend with Contextual Phonetic Auto-Correction
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

    // 4. Send to ChatSpeakingAIUseCase with Sliding Context Window (Last 6 turns)
    try {
      const history = ephemeralMessages.map((m) => ({
        speaker: m.speaker,
        text: m.text,
      }));

      const result = await container.chatSpeakingAIUseCase.execute({
        userId,
        rawSttInput: spokenTranscript,
        conversationHistory: history,
      });

      // 5. Save mispronounced words immediately to Pronunciation & IPA Lab
      result.mispronouncedWords?.forEach((m) => {
        addPronunciationMistake({
          word: m.word,
          ipa: m.ipa,
          contextSentence: result.inferredIntendedMeaning || spokenTranscript,
          errorReason: m.reason,
          suggestedAlternative: 'Practiced with Alex (Native Best Friend)',
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
      console.warn('Speaking AI conversation error:', err);
      const fallbackReply = "Haha totally, I feel you! What else is on your mind?";
      const aiFallbackTurn: EphemeralTurn = {
        id: `ephem-ai-${Date.now()}`,
        speaker: 'ai',
        text: fallbackReply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      addEphemeralMessage(aiFallbackTurn);

      setOrbState('speaking');
      container.speechTTSEngine.speak(fallbackReply, {
        onEnd: () => {
          if (isMountedRef.current) setOrbState('idle');
        },
        onError: () => {
          if (isMountedRef.current) setOrbState('idle');
        },
      });
    }
  }, [
    addEphemeralMessage,
    addPronunciationMistake,
    audioAnalyzer,
    ephemeralMessages,
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
    ephemeralMessages.forEach((turn) => {
      turn.mispronouncedWords?.forEach((m) => {
        addPronunciationMistake({
          word: m.word,
          ipa: m.ipa,
          contextSentence: turn.inferredIntendedMeaning || turn.text,
          errorReason: m.reason,
          suggestedAlternative: 'Practiced with Alex (Native Best Friend)',
          topicTitle: 'Speaking AI (Casual Chat)',
        });
      });
    });

    clearEphemeralMessages();

    // Start fresh with a friendly greeting
    const newGreetingTurn: EphemeralTurn = {
      id: `ephem-ai-init-${Date.now()}`,
      speaker: 'ai',
      text: "Fresh start! What would you like to chat about?",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    addEphemeralMessage(newGreetingTurn);

    setOrbState('speaking');
    container.speechTTSEngine.speak("Fresh start! What would you like to chat about?", {
      onEnd: () => {
        if (isMountedRef.current) setOrbState('idle');
      },
      onError: () => {
        if (isMountedRef.current) setOrbState('idle');
      },
    });
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-gradient-to-b from-white via-slate-50/70 to-slate-100/50 select-none overflow-hidden relative">
      {/* Top Navigation & Persona Bar */}
      <header className="px-6 py-3 border-b border-slate-200/80 bg-white/90 backdrop-blur-xs flex items-center justify-between shrink-0 shadow-2xs z-10">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-teal-600 to-cyan-500 text-white flex items-center justify-center font-bold text-sm shadow-xs">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full ring-2 ring-white" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-900">Alex</h2>
              <span className="text-[10px] font-semibold text-teal-800 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-full">
                Native Best Friend
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              Zero topic restrictions • Contextual phonetic auto-correction • Ephemeral memory
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

      {/* Main Split Layout: Voice Stage Visualizer (Top/Center) + Ephemeral Stream (Bottom/Scroll) */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Upper Zone: Glowing Orb Visualizer & Voice Controller */}
        <section className="shrink-0 flex flex-col items-center justify-center py-4 px-6 border-b border-slate-100 bg-white/50 backdrop-blur-2xs">
          <div className="scale-85 origin-center">
            <GlowingOrbVisualizer orbState={orbState} audioLevel={audioLevel} />
          </div>

          {/* Live Speech Detection Bar */}
          <div className="w-full max-w-xl min-h-[2.25rem] flex items-center justify-center my-1">
            {orbState === 'listening' ? (
              <div className="w-full p-2 px-4 rounded-xl bg-teal-50 border border-teal-200 text-teal-900 text-xs shadow-2xs flex items-center gap-2 animate-in fade-in">
                <span className="w-2 h-2 rounded-full bg-teal-500 animate-ping shrink-0" />
                <span className="text-slate-500 font-semibold shrink-0">Live Detection:</span>
                <span className="font-medium text-slate-900 truncate">
                  {liveSpeechTranscript ? `"${liveSpeechTranscript}"` : 'Listening... speak to Alex'}
                </span>
                <span className="inline-block w-1.5 h-3.5 bg-teal-600 animate-pulse shrink-0" />
              </div>
            ) : orbState === 'thinking' ? (
              <div className="p-1.5 px-4 rounded-xl bg-slate-100 border border-slate-200 text-slate-600 text-xs flex items-center gap-2 animate-in fade-in">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                <span>Alex is listening and thinking...</span>
              </div>
            ) : null}
          </div>

          {/* Push-to-Talk Controls */}
          <div className="flex items-center gap-3 pt-2">
            <button
              onMouseDown={startVoiceInput}
              onMouseUp={stopVoiceInput}
              onTouchStart={startVoiceInput}
              onTouchEnd={stopVoiceInput}
              className={`flex items-center gap-2.5 px-8 py-3 rounded-2xl font-bold text-xs tracking-wide transition-all shadow-sm active:scale-95 border ${
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

            {/* Auto VAD Toggle Button */}
            <button
              onClick={toggleAutoVad}
              title="Toggle Hands-Free Voice Detection"
              className={`flex items-center gap-1.5 px-3 py-3 rounded-2xl border text-xs font-semibold transition-all ${
                isAutoVadEnabled
                  ? 'bg-teal-50 border-teal-400 text-teal-800 ring-2 ring-teal-400/20'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Radio className={`w-3.5 h-3.5 ${isAutoVadEnabled ? 'text-teal-600 animate-pulse' : 'text-slate-400'}`} />
              <span className="hidden sm:inline">Auto VAD:</span>
              <span>{isAutoVadEnabled ? 'ON' : 'OFF'}</span>
            </button>
          </div>
        </section>

        {/* Lower Zone: Compact Ephemeral Chat Stream */}
        <section
          ref={chatScrollRef}
          className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 max-w-3xl w-full mx-auto"
        >
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
                    <span className="text-[10px] text-slate-400">Casual Voice</span>
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
        </section>
      </div>
    </div>
  );
};
