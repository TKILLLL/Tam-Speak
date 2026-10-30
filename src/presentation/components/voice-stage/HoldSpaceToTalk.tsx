import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Mic, Radio, Square } from 'lucide-react';
import { useTamSpeakStore } from '../../store';
import { useAudioAnalyzer } from '../../../infrastructure/audio/useAudioAnalyzer';
import { container } from '../../../di/DIContainer';
import { PracticeSession, DialogueTurn } from '../../../domain/entities/PracticeSession';
import { aiService } from '../../../infrastructure/ai/AIService';
import { SpeechNoiseFilter } from '../../../infrastructure/audio/SpeechNoiseFilter';

export const HoldSpaceToTalk: React.FC = () => {
  const {
    setOrbState,
    isAutoVadEnabled,
    toggleAutoVad,
    activeTopic,
    setActiveTopic,
    activeTopicTitle,
    activePart,
    setActivePart,
    activeSession,
    setActiveSession,
    lastAIMessage,
    setLastAIMessage,
    currentExaminerPrompt,
    setCurrentExaminerPrompt,
    toggleHideLastMessage,
    user,
    setRightPanelTab,
    addDialogueTurn,
    updateDialogueTurn,
    addPronunciationMistake,
    setLiveSpeechTranscript,
    setMockTestProgress,
    dialogueTurns,
    setAiVocabHints,
    setIsLoadingVocabHints,
  } = useTamSpeakStore();

  const [isHolding, setIsHolding] = useState(false);
  const audioAnalyzer = useAudioAnalyzer();
  const transcriptBufferRef = useRef('');
  const isHoldingRef = useRef(false);
  const activeAbortControllerRef = useRef<AbortController | null>(null);
  const currentSessionIdRef = useRef<string>(
    typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `session-${Date.now()}`
  );
  const lastReplayTimeRef = useRef<number>(0);

  const startVoiceInput = useCallback(async () => {
    if (isHoldingRef.current) return;
    isHoldingRef.current = true;
    setIsHolding(true);
    setOrbState('listening');

    // 0. Echo Prevention: Immediately cancel speech synthesis and TTS engine
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // noop
      }
    }
    container.speechTTSEngine.stop();

    // 1. Zero Learning Curve: Auto-pick starter topic if none selected
    let currentSessionId = activeSession?.id;
    let currentTopicId = activeTopic?.id;
    const currentUserId = user?.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'guest-user');

    if (!activeTopic) {
      currentTopicId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `topic-${Date.now()}`;
      setActiveTopic({
        id: currentTopicId,
        userId: currentUserId,
        title: 'AI-selected speaking topic',
        description: '',
        contextPrompt: '',
        aiRole: 'IELTS Speaking Examiner',
        userRole: 'Speaking Candidate',
        targetKeywords: [],
        targetLevel: 'b2',
        isPublic: false,
        createdAt: new Date().toISOString(),
      });
    }

    // 2. Initialize PracticeSession if not active
    if (!currentSessionId) {
      currentSessionId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `session-${Date.now()}`;
      const newSession = PracticeSession.create({
        id: currentSessionId,
        userId: currentUserId,
        mode: 'daily_conversation',
        topicId: currentTopicId || null,
      });
      newSession.startRecording();
      try {
        await container.sessionRepository.save(newSession);
      } catch (err) {
        console.warn('Session save local fallback:', err);
      }

      setActiveSession({
        id: currentSessionId,
        userId: currentUserId,
        topicId: currentTopicId || null,
        mode: 'daily_conversation',
        status: 'recording',
        durationSeconds: 0,
        overallScore: 7.0,
        pronunciationScore: 7.0,
        fluencyScore: 7.0,
        lexicalScore: 7.0,
        grammarScore: 7.0,
        wordsPerMinute: 0,
        hesitationCount: 0,
        transcriptDialogue: [],
        detailedFeedback: null,
        aiProviderUsed: null,
        createdAt: new Date().toISOString(),
      });
    }

    try {
      // 3. Start Web Audio Analyzer (RMS + Hesitation Detector)
      const micStream = await audioAnalyzer.startAnalyzing();

      // 4. Start MediaRecorder
      await container.audioRecorderEngine.start(micStream);

      // 5. Start Web Speech STT
      transcriptBufferRef.current = '';
      if (activeAbortControllerRef.current) {
        activeAbortControllerRef.current.abort();
        activeAbortControllerRef.current = null;
      }
      currentSessionIdRef.current = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : '';
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
      if (activeAbortControllerRef.current) {
        activeAbortControllerRef.current.abort();
        activeAbortControllerRef.current = null;
      }
      currentSessionIdRef.current = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : '';
      setLiveSpeechTranscript('');
      if (err?.name === 'NotAllowedError' || err?.message?.toLowerCase().includes('permission')) {
        alert('Microphone permission was denied. Please allow microphone access in your browser settings to practice speaking.');
      }
    }
  }, [activeSession, activeTopic, audioAnalyzer, setActiveSession, setActiveTopic, setLiveSpeechTranscript, setOrbState, user]);

  const stopVoiceInput = useCallback(async () => {
    if (!isHoldingRef.current) return;
    isHoldingRef.current = false;
    setIsHolding(false);
    setOrbState('thinking');

    // 1. Stop Speech-to-Text
    let spokenTranscript = container.speechSTTEngine.stop() || transcriptBufferRef.current;
    setLiveSpeechTranscript('');

    // 2. Stop Audio Analyzer & calculate WPM
    const wordCount = spokenTranscript.split(/\s+/).filter(Boolean).length;
    const analyzerStats = audioAnalyzer.stopAnalyzing(wordCount);

    // 3. Stop MediaRecorder and commit Blob to Dexie
    const userId = user?.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'guest-user');
    const sessionId = activeSession?.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `session-${Date.now()}`);

    let recResult: { recordingId: string; blob: Blob; mimeType: string; durationSeconds: number } | null = null;
    try {
      recResult = await container.audioRecorderEngine.stop(userId, sessionId);
    } catch {
      // Safe fallback
    }

    // High-Precision Hybrid Speech Recognition (gemini-3.5-transcribe STT):
    // Prioritize Gemini transcription from audio blob to accurately recognize Vietnamese names & accents
    if (recResult?.blob && container.aiGateway.transcribeAudio) {
      try {
        const verifiedTranscript = await container.aiGateway.transcribeAudio(
          recResult.blob,
          activeTopic?.title || 'English speaking practice'
        );
        if (verifiedTranscript && verifiedTranscript.trim().length > 0) {
          spokenTranscript = verifiedTranscript.trim();
        }
      } catch (err) {
        console.warn('Audio transcription fallback notice:', err);
      }
    }

    if (!spokenTranscript.trim()) {
      setLastAIMessage("Could not detect clear speech. Please hold the Space bar while speaking into your microphone.");
      setOrbState('idle');
      return;
    }

    const audioUrl = recResult?.blob ? URL.createObjectURL(recResult.blob) : undefined;
    const actualDurationSeconds = recResult?.durationSeconds || Math.max(1, analyzerStats.durationSeconds);

    // Accidental Noise & Murmur Filter
    const validation = SpeechNoiseFilter.validateSpeech(spokenTranscript, actualDurationSeconds);
    if (!validation.isValid) {
      console.warn('Ignored accidental noise or unintelligible speech:', validation.reason, spokenTranscript);
      setOrbState('idle');
      return;
    }
    spokenTranscript = validation.cleanedText;

    // 4. Optimistic UI: Append User Dialogue Turn immediately (0ms latency feedback)
    const userTurnId = `turn-user-${Date.now()}`;
    const userTurn: DialogueTurn = {
      id: userTurnId,
      speaker: 'user',
      text: spokenTranscript,
      timestampSeconds: Math.round(actualDurationSeconds),
      audioBlobId: recResult?.recordingId,
      audioUrl,
      actualDurationSeconds,
      hesitationsDetected: analyzerStats.hesitations.length,
      hesitationMarkers: analyzerStats.hesitations,
      wpm: Math.round(analyzerStats.wpm),
      mistakes: [],
    };
    addDialogueTurn(userTurn);

    // 5. Plan next question dynamically using AI (zero static question bank data)
    let plannedNextQuestion = '';
    let shouldAutoTriggerScoring = false;

    const currentMock = useTamSpeakStore.getState().mockTestProgress;
    if (currentMock) {
      if (currentMock.currentPart === 1) {
        const nextIdx = currentMock.questionIndex + 1;
        if (nextIdx < 3) {
          setMockTestProgress({ ...currentMock, questionIndex: nextIdx });
        } else {
          setActivePart('part2');
          setMockTestProgress({ ...currentMock, currentPart: 2, questionIndex: 0 });
          plannedNextQuestion = '';
        }
      } else if (currentMock.currentPart === 2) {
        setActivePart('part3');
        setMockTestProgress({ ...currentMock, currentPart: 3, questionIndex: 0 });
        plannedNextQuestion = '';
      } else if (currentMock.currentPart === 3) {
        const nextIdx = currentMock.questionIndex + 1;
        if (nextIdx < 3) {
          setMockTestProgress({ ...currentMock, questionIndex: nextIdx });
        } else {
          plannedNextQuestion = '';
          shouldAutoTriggerScoring = true;
          setMockTestProgress(null);
        }
      }
    }

    // 6. Network Race Condition Guard: Track current turn session ID & abort previous in-flight requests
    const turnSessionId = currentSessionIdRef.current;
    if (activeAbortControllerRef.current) {
      activeAbortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    activeAbortControllerRef.current = abortController;

    // 7. Call real Gemini AI Examiner Turn Evaluation
    try {
      const topicName = activeTopicTitle || activeTopic?.title || 'Daily Conversation';
      const promptToEvaluate = currentExaminerPrompt || lastAIMessage || 'Introduce yourself';

      const turnResult = await aiService.generateExaminerTurn({
        topicTitle: topicName,
        currentQuestion: promptToEvaluate,
        userAnswer: spokenTranscript,
        nextPlannedQuestion: plannedNextQuestion || undefined,
        isFullMock: Boolean(currentMock),
        partName: activePart,
      });

      // Async Race Condition Check: If user switched topic or view while AI was formulating response, drop result safely
      if (turnSessionId !== currentSessionIdRef.current) {
        return;
      }

      // Save any phonetic mistakes identified by AI into Pronunciation Lab
      const detectedMistakes: Array<{
        word: string;
        reason: string;
        ipa: string;
        suggestedAlternative: string;
      }> = [];

      if (turnResult.mistakes && turnResult.mistakes.length > 0) {
        turnResult.mistakes.forEach((m) => {
          if (!detectedMistakes.some((d) => d.word.toLowerCase() === m.word.toLowerCase())) {
            detectedMistakes.push({
              word: m.word,
              ipa: m.ipa,
              reason: m.reason,
              suggestedAlternative: m.suggestedAlternative,
            });
            addPronunciationMistake({
              word: m.word,
              ipa: m.ipa,
              contextSentence: spokenTranscript,
              errorReason: m.reason,
              suggestedAlternative: m.suggestedAlternative,
              topicTitle: topicName,
            });
          }
        });
      }

      // Update the user turn with mistakes, inferredIntendedSentence, and suggestedUpgrade
      updateDialogueTurn(userTurnId, {
        mistakes: detectedMistakes,
        inferredIntendedSentence: turnResult.inferredIntendedSentence || undefined,
        suggestedUpgrade: turnResult.suggestedUpgrade || undefined,
      });

      // 8. Append AI Dialogue Turn to Session Store
      const replyText = [turnResult.feedbackTransition, turnResult.nextQuestion].filter(Boolean).join(' ').trim();
      if (!replyText) {
        throw new Error('Gemini returned no examiner response.');
      }
      const aiTurn: DialogueTurn = {
        id: `turn-ai-${Date.now()}`,
        speaker: 'ai',
        text: replyText,
        timestampSeconds: Math.round(analyzerStats.durationSeconds) + 2,
      };
      addDialogueTurn(aiTurn);

      // 9. Update UI & Controls
      setLastAIMessage(replyText);
      setCurrentExaminerPrompt(turnResult.nextQuestion);
      setOrbState('speaking');

      if (shouldAutoTriggerScoring) {
        setRightPanelTab('scoring');
      } else {
        setRightPanelTab('qna');
      }

      // 10. Speak AI reply via TTS
      container.speechTTSEngine.speak(replyText, {
        onEnd: () => setOrbState('idle'),
        onError: () => setOrbState('idle'),
      });
    } catch (err) {
      console.error('AI examiner turn error:', err);
      setOrbState('idle');
      const errorMsg =
        (err as Error).message ||
        'Lỗi kết nối AI. Vui lòng kiểm tra API Key trong mục Settings.';
      setLastAIMessage(`[Lỗi kết nối AI] ${errorMsg}`);
    }
  }, [
    activePart,
    activeSession,
    activeTopic,
    activeTopicTitle,
    addDialogueTurn,
    updateDialogueTurn,
    addPronunciationMistake,
    audioAnalyzer,
    currentExaminerPrompt,
    dialogueTurns,
    lastAIMessage,
    setActivePart,
    setAiVocabHints,
    setCurrentExaminerPrompt,
    setIsLoadingVocabHints,
    setLastAIMessage,
    setMockTestProgress,
    setOrbState,
    setRightPanelTab,
    user,
  ]);

  const audioAnalyzerRef = useRef(audioAnalyzer);
  audioAnalyzerRef.current = audioAnalyzer;

  const startVoiceInputRef = useRef(startVoiceInput);
  const stopVoiceInputRef = useRef(stopVoiceInput);

  useEffect(() => {
    startVoiceInputRef.current = startVoiceInput;
    stopVoiceInputRef.current = stopVoiceInput;
  });

  // Global Keyboard Shortcuts (Space, R, H) & Window Focus Guards
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
      if (isTypingInInput(target)) {
        return;
      }

      if (useTamSpeakStore.getState().topicChangeWarningModalOpen) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        if (!e.repeat && !isHoldingRef.current) {
          startVoiceInputRef.current();
        }
      } else if (e.code === 'KeyR' && !e.repeat) {
        e.preventDefault();
        const now = Date.now();
        if (now - lastReplayTimeRef.current < 300) return;
        lastReplayTimeRef.current = now;
        const rBtn = document.querySelector('button[title*="Replay"]') as HTMLButtonElement | null;
        rBtn?.click();
      } else if (e.code === 'KeyH' && !e.repeat) {
        e.preventDefault();
        toggleHideLastMessage();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (isTypingInInput(target)) {
        return;
      }

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
  }, [toggleHideLastMessage]);

  // Auto VAD Hands-Free Flow with Echo Lock
  const vadSilenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const orbState = useTamSpeakStore((s) => s.orbState);

  // Unmount Cleanup: strictly abort any ongoing recognition, silence timers and reset hot-mic ONCE on unmount
  useEffect(() => {
    return () => {
      if (vadSilenceTimerRef.current) {
        clearTimeout(vadSilenceTimerRef.current);
        vadSilenceTimerRef.current = null;
      }
      isHoldingRef.current = false;
      container.speechSTTEngine.stop();
      container.speechSTTEngine.abort();
      audioAnalyzerRef.current.stopAnalyzing(0);
      if (activeAbortControllerRef.current) {
        activeAbortControllerRef.current.abort();
        activeAbortControllerRef.current = null;
      }
      currentSessionIdRef.current = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : '';
    };
  }, []);

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

  return (
    <div className="flex flex-col items-center gap-3 mt-8 select-none">
      <div className="flex items-center gap-3 sm:gap-4 flex-wrap justify-center">
        {/* Toggle 1-Click Recording Button (Ấn 1 lần để bật ghi âm, ấn 1 lần nữa để tắt/gửi) */}
        <button
          onClick={isHolding ? stopVoiceInput : startVoiceInput}
          title={isHolding ? 'Bấm để hoàn thành và gửi câu trả lời' : 'Bấm 1 lần để mở ghi âm, bấm lần nữa để gửi'}
          className={`flex items-center gap-2.5 px-6 py-4 rounded-2xl font-bold text-xs tracking-wide transition-all shadow-md active:scale-95 border cursor-pointer ${
            isHolding
              ? 'bg-red-500 hover:bg-red-600 text-white border-red-400 ring-4 ring-red-400/20 shadow-lg animate-pulse'
              : 'bg-teal-600 hover:bg-teal-700 text-white border-teal-500 hover:shadow-lg'
          }`}
        >
          {isHolding ? (
            <>
              <Square className="w-4 h-4 fill-white" />
              <span>Bấm để gửi</span>
            </>
          ) : (
            <>
              <Mic className="w-4 h-4" />
              <span>Bấm để nói</span>
            </>
          )}
        </button>

        {/* Main Push-To-Talk Button (Hold Space) */}
        <button
          onMouseDown={startVoiceInput}
          onMouseUp={stopVoiceInput}
          onTouchStart={startVoiceInput}
          onTouchEnd={stopVoiceInput}
          className={`relative group flex items-center gap-3 px-8 py-4 rounded-2xl font-bold text-xs tracking-wide transition-all shadow-md active:scale-95 border ${
            isHolding
              ? 'bg-gradient-to-r from-teal-500 to-cyan-500 text-white border-teal-400 ring-4 ring-teal-400/20 shadow-lg'
              : 'bg-gradient-to-b from-white to-slate-100 hover:to-slate-200 text-slate-800 border-slate-300 hover:shadow-lg'
          }`}
        >
          {isHolding ? (
            <>
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-white" />
              </span>
              <Mic className="w-4 h-4 animate-pulse" />
              <span>Thả để gửi</span>
            </>
          ) : (
            <>
              <Mic className="w-4 h-4 text-teal-600 group-hover:scale-110 transition-transform" />
              <span>Giữ [Space] để nói</span>
            </>
          )}
        </button>

        {/* Auto VAD Toggle Pill */}
        <button
          onClick={toggleAutoVad}
          title="Auto Voice Activity Detection (Hands-Free Mode)"
          className={`flex items-center gap-2 px-3.5 py-3.5 rounded-2xl border text-xs font-semibold transition-all ${
            isAutoVadEnabled
              ? 'bg-teal-50 border-teal-300 text-teal-800'
              : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
          }`}
        >
          <Radio className={`w-4 h-4 ${isAutoVadEnabled ? 'text-teal-600 animate-pulse' : 'text-slate-400'}`} />
          <span className="hidden sm:inline">Auto VAD</span>
        </button>
      </div>

      <p className="text-[11px] text-slate-400 font-medium">
        Tip: Press <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-300 font-mono text-[10px]">R</kbd> to replay,{' '}
        <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-300 font-mono text-[10px]">H</kbd> to hide text
      </p>
    </div>
  );
};
