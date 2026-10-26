import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Mic, Radio } from 'lucide-react';
import { useTamSpeakStore } from '../../store';
import { useAudioAnalyzer } from '../../../infrastructure/audio/useAudioAnalyzer';
import { container } from '../../../di/DIContainer';
import { PracticeSession } from '../../../domain/entities/PracticeSession';

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
    activeSession,
    setActiveSession,
    setLastAIMessage,
    toggleHideLastMessage,
    user,
    setRightPanelTab,
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

    // 0. Cancel any currently playing AI audio so mic doesn't pick up TTS echo
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
        overallScore: null,
        pronunciationScore: null,
        fluencyScore: null,
        lexicalScore: null,
        grammarScore: null,
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
      container.speechSTTEngine.start({
        onUpdate: (finalText, interimText) => {
          transcriptBufferRef.current = `${finalText} ${interimText}`.trim();
        },
        onError: (err) => {
          console.warn('Speech recognition warning:', err);
        },
      });
    } catch (err) {
      console.error('Failed to access microphone or start STT:', err);
      setOrbState('idle');
      setIsHolding(false);
      isHoldingRef.current = false;
    }
  }, [activeSession, activeTopic, audioAnalyzer, setActiveSession, setActiveTopic, setOrbState, user]);

  const stopVoiceInput = useCallback(async () => {
    if (!isHoldingRef.current) return;
    isHoldingRef.current = false;
    setIsHolding(false);
    setOrbState('thinking');

    // 1. Stop Speech-to-Text
    const spokenTranscript = container.speechSTTEngine.stop() || transcriptBufferRef.current;

    // 2. Stop Audio Analyzer & calculate WPM
    const wordCount = spokenTranscript.split(/\s+/).filter(Boolean).length;
    const analyzerStats = audioAnalyzer.stopAnalyzing(wordCount);

    // 3. Stop MediaRecorder and commit Blob to Dexie
    const userId = user?.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'guest-user');
    const sessionId = activeSession?.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `session-${Date.now()}`);

    try {
      await container.audioRecorderEngine.stop(userId, sessionId);
    } catch {
      // Safe fallback
    }

    if (!spokenTranscript.trim()) {
      setLastAIMessage("I couldn't hear you clearly. Please press and hold [Space] while speaking into your microphone!");
      setOrbState('idle');
      return;
    }

    // 4. Send turn to AI Roleplay Chat with Sliding Window
    try {
      const topicInstruction =
        activeTopic?.contextPrompt ||
        'You are an encouraging IELTS Speaking Examiner. Ask follow-up questions and assess fluency.';

      const result = await container.chatRoleplayUseCase.execute({
        sessionId,
        userId,
        systemInstruction: topicInstruction,
        userMessage: spokenTranscript,
        timestampSeconds: Math.round(analyzerStats.durationSeconds),
      });

      // 5. Update UI & Play Audio Reply
      setLastAIMessage(result.replyText);
      setOrbState('speaking');

      // Automatically switch right panel to Q&A tab so user sees their waveform & feedback
      setRightPanelTab('qna');

      container.speechTTSEngine.speak(result.replyText, {
        onEnd: () => setOrbState('idle'),
        onError: () => setOrbState('idle'),
      });
    } catch (err) {
      console.warn('AI execution fallback:', err);
      const fallbackReply = `That is an interesting thought regarding "${activeTopic?.title || 'our discussion'}". Could you elaborate more on how that impacts you personally?`;
      setLastAIMessage(fallbackReply);
      setOrbState('speaking');
      setRightPanelTab('qna');

      container.speechTTSEngine.speak(fallbackReply, {
        onEnd: () => setOrbState('idle'),
        onError: () => setOrbState('idle'),
      });
    }
  }, [activeSession, activeTopic, audioAnalyzer, setLastAIMessage, setOrbState, setRightPanelTab, user]);

  // Global Keyboard Shortcuts (Space, R, H)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing inside input, textarea, or contentEditable
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      if (e.code === 'Space' && !e.repeat && !isHoldingRef.current) {
        e.preventDefault();
        startVoiceInput();
      } else if (e.code === 'KeyR' && !e.repeat) {
        e.preventDefault();
        // Trigger Replay
        const rBtn = document.querySelector('button[title*="Replay"]') as HTMLButtonElement | null;
        rBtn?.click();
      } else if (e.code === 'KeyH' && !e.repeat) {
        e.preventDefault();
        toggleHideLastMessage();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' && isHoldingRef.current) {
        e.preventDefault();
        stopVoiceInput();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [startVoiceInput, stopVoiceInput, toggleHideLastMessage]);

  return (
    <div className="flex flex-col items-center gap-3 mt-8 select-none">
      <div className="flex items-center gap-4">
        {/* Main Push-To-Talk Button */}
        <button
          onMouseDown={startVoiceInput}
          onMouseUp={stopVoiceInput}
          onTouchStart={startVoiceInput}
          onTouchEnd={stopVoiceInput}
          className={`relative group flex items-center gap-3 px-10 py-4 rounded-2xl font-bold text-sm tracking-wide transition-all shadow-md active:scale-95 border ${
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
              <Mic className="w-5 h-5 animate-pulse" />
              <span>Release to Send</span>
            </>
          ) : (
            <>
              <Mic className="w-5 h-5 text-teal-600 group-hover:scale-110 transition-transform" />
              <span>Hold [Space] to Talk</span>
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
