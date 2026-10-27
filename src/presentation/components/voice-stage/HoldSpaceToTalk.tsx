import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Mic, Radio, Square } from 'lucide-react';
import { useTamSpeakStore } from '../../store';
import { useAudioAnalyzer } from '../../../infrastructure/audio/useAudioAnalyzer';
import { container } from '../../../di/DIContainer';
import { PracticeSession, DialogueTurn } from '../../../domain/entities/PracticeSession';
import { aiService } from '../../../infrastructure/ai/AIService';

const RANDOM_STARTER_TOPICS = [
  {
    title: 'Hometown and Memories',
    context: 'Discuss where you grew up, changes in your hometown, and your favorite local spots.',
    aiRole: 'IELTS Speaking Examiner',
  },
  {
    title: 'Technology and Daily Routine',
    context: 'Talk about how smartphones and artificial intelligence impact your daily productivity.',
    aiRole: 'Curious Tech Journalist',
  },
  {
    title: 'Travel and Memorable Journeys',
    context: 'Describe an unforgettable holiday trip and a cultural discovery you made.',
    aiRole: 'Fellow World Traveler',
  },
];

export const HoldSpaceToTalk: React.FC = () => {
  const {
    setOrbState,
    setAudioLevel,
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

  // Sync real-time audio amplitude to store for Glowing Orb
  useEffect(() => {
    if (audioAnalyzer.isListening) {
      setAudioLevel(audioAnalyzer.audioLevel);
    }
  }, [audioAnalyzer.audioLevel, audioAnalyzer.isListening, setAudioLevel]);

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
      const randomStarter = RANDOM_STARTER_TOPICS[Math.floor(Math.random() * RANDOM_STARTER_TOPICS.length)]!;
      currentTopicId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `topic-${Date.now()}`;
      setActiveTopic({
        id: currentTopicId,
        userId: currentUserId,
        title: randomStarter.title,
        description: randomStarter.context,
        contextPrompt: randomStarter.context,
        aiRole: randomStarter.aiRole,
        userRole: 'Speaking Candidate',
        targetKeywords: ['perspective', 'significant', 'memorable'],
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

    // High-Precision Hybrid Fallback: Only call multimodal transcription if WebSpeech STT was empty
    if (!spokenTranscript.trim() && recResult?.blob && container.aiGateway.transcribeAudio) {
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

    // 4. Mistakes array to be populated dynamically by real LLM Examiner evaluation
    const detectedMistakes: Array<{
      word: string;
      reason: string;
      ipa: string;
      suggestedAlternative: string;
    }> = [];

    const audioUrl = recResult?.blob ? URL.createObjectURL(recResult.blob) : undefined;
    const actualDurationSeconds = recResult?.durationSeconds || Math.max(1, analyzerStats.durationSeconds);

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
          // Completed Part 1 -> Transition to Part 2 Cue Card dynamically
          setActivePart('part2');
          setMockTestProgress({ ...currentMock, currentPart: 2, questionIndex: 0 });
          plannedNextQuestion = `Now let us proceed to Part 2: Individual Long Turn. Your topic is: "${activeTopicTitle || 'Your memorable experience'}". Please describe a significant moment related to this topic, who was with you, what occurred, and why it influenced you. You have 1 minute to prepare notes, then speak for up to 2 minutes. When ready, press the microphone button to begin!`;
        }
      } else if (currentMock.currentPart === 2) {
        // Completed Part 2 -> Transition to Part 3 Analytical Discussion dynamically
        setActivePart('part3');
        setMockTestProgress({ ...currentMock, currentPart: 3, questionIndex: 0 });
        plannedNextQuestion = `Thank you. Now let us move on to Part 3: Two-Way Analytical Discussion on "${activeTopicTitle || 'this topic'}". How do you see the broader societal impact of this issue developing over the next decade?`;
      } else if (currentMock.currentPart === 3) {
        const nextIdx = currentMock.questionIndex + 1;
        if (nextIdx < 3) {
          setMockTestProgress({ ...currentMock, questionIndex: nextIdx });
        } else {
          // Full Mock completed!
          plannedNextQuestion = 'Thank you very much. That concludes your Full IELTS Speaking Mock Test. Let us analyze your comprehensive band rating and detailed feedback now.';
          shouldAutoTriggerScoring = true;
          setMockTestProgress(null);
        }
      }
    }

    // 6. Call real Gemini AI Examiner Turn Evaluation
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

      // Save any phonetic mistakes identified by AI into Pronunciation Lab
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

      // 7. Append User Dialogue Turn to Session Store with suggested upgrade
      const userTurn: DialogueTurn = {
        id: `turn-user-${Date.now()}`,
        speaker: 'user',
        text: spokenTranscript,
        timestampSeconds: Math.round(actualDurationSeconds),
        audioBlobId: recResult?.recordingId,
        audioUrl,
        actualDurationSeconds,
        hesitationsDetected: analyzerStats.hesitations.length,
        wpm: Math.round(analyzerStats.wpm),
        mistakes: detectedMistakes,
        suggestedUpgrade: turnResult.suggestedUpgrade,
      };
      addDialogueTurn(userTurn);

      // 8. Append AI Dialogue Turn to Session Store
      const replyText = `${turnResult.feedbackTransition} ${turnResult.nextQuestion}`.trim();
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

  // Global Keyboard Shortcuts (Space, R, H)
  useEffect(() => {
    const isTypingInInput = (target: HTMLElement | null): boolean => {
      if (!target) return false;
      const tag = target.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (isTypingInInput(target)) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        if (!e.repeat && !isHoldingRef.current) {
          startVoiceInput();
        }
      } else if (e.code === 'KeyR' && !e.repeat) {
        e.preventDefault();
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
  }, [startVoiceInput, stopVoiceInput, toggleHideLastMessage]);

  // Auto VAD Hands-Free Flow with Echo Lock
  const vadSilenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const orbState = useTamSpeakStore((s) => s.orbState);

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
        stopVoiceInput();
      }
      return;
    }

    // If idle and not holding, auto-start listening
    if (orbState === 'idle' && !isHoldingRef.current) {
      startVoiceInput();
    }
  }, [isAutoVadEnabled, orbState, startVoiceInput, stopVoiceInput]);

  // VAD Auto-Submit when silence follows speech
  useEffect(() => {
    if (!isAutoVadEnabled || !isHoldingRef.current || orbState !== 'listening') {
      return;
    }

    if (transcriptBufferRef.current.trim().length > 0) {
      if (vadSilenceTimerRef.current) clearTimeout(vadSilenceTimerRef.current);
      vadSilenceTimerRef.current = setTimeout(() => {
        if (isHoldingRef.current && orbState === 'listening') {
          stopVoiceInput();
        }
      }, 1600);
    }

    return () => {
      if (vadSilenceTimerRef.current) clearTimeout(vadSilenceTimerRef.current);
    };
  }, [isAutoVadEnabled, orbState, stopVoiceInput]);

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
