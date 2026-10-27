import { create } from 'zustand';
import { DialogueTurn } from '../../domain/entities/PracticeSession';
import { PracticeSessionDTO, CustomTopicDTO, UserProfileDTO } from '../../application/dtos';
import { GeneratedVocabHints } from '../../infrastructure/ai/AIService';

export interface MockTestProgress {
  topicTitle: string;
  currentPart: 1 | 2 | 3;
  questionIndex: number;
  part1Questions: string[];
  part2CueCard: { title: string; cueBulletPoints: string[] } | null;
  part3Questions: string[];
}

export type NavigationView =
  | 'speaking_ai'
  | 'conversation'
  | 'pronunciation'
  | 'progress'
  | 'profile'
  | 'raw_data'
  | 'settings'
  | 'ielts'
  | 'scratchpad'
  | 'vocab_bank';

export type RightPanelTab = 'quick_start' | 'qna' | 'scoring' | 'vocab_hints';

export type OrbState = 'idle' | 'listening' | 'thinking' | 'speaking';

export type ActivePartType = 'part1' | 'part2' | 'part3' | 'full_test' | 'roleplay' | 'free_talk';

export interface EphemeralMistake {
  word: string;
  ipa: string;
  reason: string;
}

export interface EphemeralTurn {
  id: string;
  speaker: 'user' | 'ai';
  text: string;
  timestamp: string;
  rawSttInput?: string;
  inferredIntendedMeaning?: string;
  wasSttMisrecognized?: boolean;
  casualNativeTip?: string;
  mispronouncedWords?: EphemeralMistake[];
}

export interface PendingTargetConfig {
  part: ActivePartType;
  topicTitle: string;
  mode: string;
  initialGreeting: string;
}

export interface MistakeItem {
  id: string;
  word: string;
  ipa: string;
  contextSentence: string;
  errorReason: string;
  suggestedAlternative: string;
  topicTitle: string;
  mistakeCount: number;
  isMastered: boolean;
  createdAt: string;
}

const INITIAL_STARTER_MISTAKES: MistakeItem[] = [
  {
    id: 'mistake-init-1',
    word: 'comfortable',
    ipa: '/ˈkʌmftəbl/',
    contextSentence: 'Living in my hometown is very comfortable and peaceful.',
    errorReason: 'Omitted ending sound /bl/, read extra middle syllable (/kʌm-fɔː-teɪ-bl/)',
    suggestedAlternative: 'pronounced /ˈkʌmftəbl/ with 3 crisp syllables',
    topicTitle: 'Hometown and Memories',
    mistakeCount: 2,
    isMastered: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'mistake-init-2',
    word: 'specifically',
    ipa: '/spəˈsɪfɪkli/',
    contextSentence: 'I specifically enjoy using AI to accelerate my language learning.',
    errorReason: 'Weak S-cluster /sp/, incorrect primary stress placement',
    suggestedAlternative: 'stress on second syllable /spə-ˈsɪ-fɪk-li/',
    topicTitle: 'Technology and Daily Routine',
    mistakeCount: 1,
    isMastered: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'mistake-init-3',
    word: 'thought',
    ipa: '/θɔːt/',
    contextSentence: 'I thought that artificial intelligence would replace routine tasks.',
    errorReason: 'Read /tɔːt/ instead of voiceless dental fricative /θ/, missed final /t/',
    suggestedAlternative: 'place tongue between teeth for /θ/, release crisp /t/',
    topicTitle: 'Technology and Daily Routine',
    mistakeCount: 3,
    isMastered: false,
    createdAt: new Date().toISOString(),
  },
];

export interface TamSpeakState {
  // User & Auth
  user: UserProfileDTO | null;
  authModalOpen: boolean;
  setAuthModalOpen: (open: boolean) => void;
  setUser: (user: UserProfileDTO | null) => void;

  // Navigation & Layout
  currentView: NavigationView;
  setCurrentView: (view: NavigationView) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;

  // Right Panel
  rightPanelTab: RightPanelTab;
  setRightPanelTab: (tab: RightPanelTab) => void;
  rightPanelExpanded: boolean;
  setRightPanelExpanded: (expanded: boolean) => void;
  rightPanelCollapsed: boolean;
  setRightPanelCollapsed: (collapsed: boolean) => void;
  rightPanelOpenMobile: boolean;
  setRightPanelOpenMobile: (open: boolean) => void;

  // Voice Stage & AI Orb
  orbState: OrbState;
  setOrbState: (state: OrbState) => void;
  audioLevel: number;
  setAudioLevel: (level: number) => void;
  liveSpeechTranscript: string;
  setLiveSpeechTranscript: (transcript: string) => void;
  activeAIProvider: string;
  setActiveAIProvider: (provider: string) => void;
  activeAIVoice: string;
  setActiveAIVoice: (voice: string) => void;
  isFallbackActive: boolean;
  setIsFallbackActive: (active: boolean) => void;

  // Interactive Transcript & Audio Controls
  lastAIMessage: string;
  setLastAIMessage: (message: string) => void;
  currentExaminerPrompt: string;
  setCurrentExaminerPrompt: (prompt: string) => void;
  isLastMessageHidden: boolean;
  toggleHideLastMessage: () => void;
  setIsLastMessageHidden: (hidden: boolean) => void;
  isAutoVadEnabled: boolean;
  toggleAutoVad: () => void;

  // Active Practice & Dialogue (Single Source of Truth)
  activePart: ActivePartType;
  setActivePart: (part: ActivePartType) => void;
  activeTopicTitle: string;
  setActiveTopicTitle: (title: string) => void;
  activeSession: PracticeSessionDTO | null;
  setActiveSession: (session: PracticeSessionDTO | null) => void;
  activeTopic: CustomTopicDTO | null;
  setActiveTopic: (topic: CustomTopicDTO | null) => void;
  dialogueTurns: DialogueTurn[];
  messages: DialogueTurn[];
  addDialogueTurn: (turn: DialogueTurn) => void;
  clearDialogueTurns: () => void;

  // Topic Switch & Synchronization
  pendingTargetConfig: PendingTargetConfig | null;
  setPendingTargetConfig: (config: PendingTargetConfig | null) => void;
  requestTopicSwitch: (config: PendingTargetConfig) => void;
  confirmTopicSwitch: () => void;

  // Interactive Reveal & Penalty System
  hasShownRevealWarningInSession: boolean;
  setHasShownRevealWarningInSession: (shown: boolean) => void;
  revealedTurnIds: string[];
  revealTurn: (turnId: string) => void;
  revealWarningModalOpen: boolean;
  pendingRevealTurnId: string | null;
  openRevealWarningModal: (turnId: string) => void;
  closeRevealWarningModal: () => void;
  penaltyToastMessage: string | null;
  showPenaltyToast: (message: string) => void;

  // Topic Switch Warning
  topicChangeWarningModalOpen: boolean;
  pendingTopicSwitch: (() => void) | null;
  openTopicChangeWarningModal: (onConfirm: () => void) => void;
  closeTopicChangeWarningModal: () => void;

  // Pronunciation Lab Flashcards
  pronunciationMistakes: MistakeItem[];
  addPronunciationMistake: (mistake: Omit<MistakeItem, 'id' | 'mistakeCount' | 'isMastered' | 'createdAt'>) => void;
  markMistakeMastered: (word: string) => void;

  // Speaking AI: Ephemeral In-Memory Chat (RAM-only, volatile)
  ephemeralMessages: EphemeralTurn[];
  addEphemeralMessage: (turn: EphemeralTurn) => void;
  clearEphemeralMessages: () => void;

  // Practice Configuration
  practiceMode: 'mock_test' | 'coaching' | 'free_roleplay';
  setPracticeMode: (mode: 'mock_test' | 'coaching' | 'free_roleplay') => void;
  targetLevel: 'a2' | 'b1' | 'b2' | 'c1' | 'c2';
  setTargetLevel: (level: 'a2' | 'b1' | 'b2' | 'c1' | 'c2') => void;
  feedbackLanguage: 'en_vn' | 'en_en';
  setFeedbackLanguage: (lang: 'en_vn' | 'en_en') => void;

  // Onboarding
  hasCompletedOnboarding: boolean;
  setHasCompletedOnboarding: (completed: boolean) => void;

  // Dynamic AI Vocab Hints
  aiVocabHints: GeneratedVocabHints | null;
  setAiVocabHints: (hints: GeneratedVocabHints | null) => void;
  isLoadingVocabHints: boolean;
  setIsLoadingVocabHints: (loading: boolean) => void;

  // Full Mock Test Progress Tracker
  mockTestProgress: MockTestProgress | null;
  setMockTestProgress: (progress: MockTestProgress | null) => void;
}

export const useTamSpeakStore = create<TamSpeakState>((set, get) => ({
  // User & Auth
  user: null,
  authModalOpen: false,
  setAuthModalOpen: (open) => set({ authModalOpen: open }),
  setUser: (user) => set({ user }),

  // Navigation & Layout (Default: 'conversation')
  currentView: 'conversation',
  setCurrentView: (view) => set({ currentView: view }),
  sidebarCollapsed: false,
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  // Right Panel
  rightPanelTab: 'quick_start',
  setRightPanelTab: (tab) => set({ rightPanelTab: tab }),
  rightPanelExpanded: false,
  setRightPanelExpanded: (expanded) => set({ rightPanelExpanded: expanded }),
  rightPanelCollapsed: false,
  setRightPanelCollapsed: (collapsed) => set({ rightPanelCollapsed: collapsed }),
  rightPanelOpenMobile: false,
  setRightPanelOpenMobile: (open) => set({ rightPanelOpenMobile: open }),

  // Voice Stage & AI Orb
  orbState: 'idle',
  setOrbState: (state) => set({ orbState: state }),
  audioLevel: 0,
  setAudioLevel: (audioLevel) => set({ audioLevel }),
  liveSpeechTranscript: '',
  setLiveSpeechTranscript: (liveSpeechTranscript) => set({ liveSpeechTranscript }),
  activeAIProvider: 'Gemini 3.8 Flash',
  setActiveAIProvider: (activeAIProvider) => set({ activeAIProvider }),
  activeAIVoice: 'Aoede (US)',
  setActiveAIVoice: (activeAIVoice) => set({ activeAIVoice }),
  isFallbackActive: false,
  setIsFallbackActive: (isFallbackActive) => set({ isFallbackActive }),

  // Interactive Transcript
  lastAIMessage:
    'Welcome to TamSpeak. Choose a topic from Quick Start and press and hold Space to begin speaking!',
  setLastAIMessage: (message) => set({ lastAIMessage: message }),
  currentExaminerPrompt:
    'Welcome to TamSpeak. Choose a topic from Quick Start and press and hold Space to begin speaking!',
  setCurrentExaminerPrompt: (prompt) => set({ currentExaminerPrompt: prompt, lastAIMessage: prompt }),
  isLastMessageHidden: false,
  toggleHideLastMessage: () => set((state) => ({ isLastMessageHidden: !state.isLastMessageHidden })),
  setIsLastMessageHidden: (hidden) => set({ isLastMessageHidden: hidden }),
  isAutoVadEnabled: false,
  toggleAutoVad: () => set((state) => ({ isAutoVadEnabled: !state.isAutoVadEnabled })),

  // Active Practice & Dialogue (Single Source of Truth)
  activePart: 'part1',
  setActivePart: (activePart) => set({ activePart }),
  activeTopicTitle: 'Part 1: Introduction & Interview',
  setActiveTopicTitle: (activeTopicTitle) => set({ activeTopicTitle }),
  activeSession: null,
  setActiveSession: (session) => set({ activeSession: session }),
  activeTopic: null,
  setActiveTopic: (topic) => set({ activeTopic: topic }),
  dialogueTurns: [],
  messages: [],
  addDialogueTurn: (turn) =>
    set((state) => ({
      dialogueTurns: [...state.dialogueTurns, turn],
      messages: [...state.messages, turn],
    })),
  clearDialogueTurns: () => {
    // Revoke old audio URLs to prevent memory leak
    get().dialogueTurns.forEach((turn) => {
      if (turn.audioUrl && typeof window !== 'undefined') {
        try {
          window.URL.revokeObjectURL(turn.audioUrl);
        } catch {
          // ignore
        }
      }
    });
    set({ dialogueTurns: [], messages: [] });
  },

  // Topic Switch & Synchronization
  pendingTargetConfig: null,
  setPendingTargetConfig: (pendingTargetConfig) => set({ pendingTargetConfig }),
  requestTopicSwitch: (config: PendingTargetConfig) => {
    if (get().dialogueTurns.length > 0) {
      set({ pendingTargetConfig: config, topicChangeWarningModalOpen: true });
    } else {
      set({ pendingTargetConfig: config });
      get().confirmTopicSwitch();
    }
  },
  confirmTopicSwitch: () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // noop
      }
    }

    const config = get().pendingTargetConfig;
    if (!config) {
      set({ topicChangeWarningModalOpen: false });
      return;
    }

    // Revoke old audio URLs to prevent memory leak
    get().dialogueTurns.forEach((turn) => {
      if (turn.audioUrl && typeof window !== 'undefined') {
        try {
          window.URL.revokeObjectURL(turn.audioUrl);
        } catch {
          // ignore
        }
      }
    });

    // Preserve errors into Pronunciation Lab
    get().dialogueTurns.forEach((turn) => {
      turn.mistakes?.forEach((m) => {
        get().addPronunciationMistake({
          word: m.word,
          ipa: m.ipa,
          contextSentence: turn.text,
          errorReason: m.reason || 'Phonetic friction',
          suggestedAlternative: m.suggestedAlternative || '',
          topicTitle: get().activeTopicTitle || 'IELTS Speaking',
        });
      });
    });

    const initialGreeting =
      config.initialGreeting ||
      `Welcome to ${config.topicTitle}. When you are ready, press and hold Space to speak!`;

    const initialTurn: DialogueTurn = {
      id: `turn-ai-init-${Date.now()}`,
      speaker: 'ai',
      text: initialGreeting,
      timestampSeconds: 0,
    };

    set({
      activePart: config.part,
      activeTopicTitle: config.topicTitle,
      practiceMode: (config.mode as any) || get().practiceMode,
      currentExaminerPrompt: initialGreeting,
      lastAIMessage: initialGreeting,
      dialogueTurns: [initialTurn],
      messages: [initialTurn],
      activeSession: null,
      topicChangeWarningModalOpen: false,
      pendingTargetConfig: null,
      pendingTopicSwitch: null,
      orbState: 'speaking',
    });

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        const utterance = new SpeechSynthesisUtterance(initialGreeting);
        utterance.lang = 'en-US';
        utterance.rate = 0.95;
        utterance.onend = () => {
          if (get().orbState === 'speaking') {
            set({ orbState: 'idle' });
          }
        };
        utterance.onerror = () => {
          set({ orbState: 'idle' });
        };
        window.speechSynthesis.speak(utterance);
      } catch {
        set({ orbState: 'idle' });
      }
    } else {
      set({ orbState: 'idle' });
    }
  },

  // Interactive Reveal & Penalty System
  hasShownRevealWarningInSession: false,
  setHasShownRevealWarningInSession: (shown) => set({ hasShownRevealWarningInSession: shown }),
  revealedTurnIds: [],
  revealTurn: (turnId: string) =>
    set((state) => ({
      revealedTurnIds: state.revealedTurnIds.includes(turnId)
        ? state.revealedTurnIds
        : [...state.revealedTurnIds, turnId],
      activeSession: state.activeSession
        ? {
            ...state.activeSession,
            overallScore: Math.max(1.0, (state.activeSession.overallScore ?? 7.0) - 0.5),
            fluencyScore: Math.max(1.0, (state.activeSession.fluencyScore ?? 7.0) - 0.5),
          }
        : null,
    })),
  revealWarningModalOpen: false,
  pendingRevealTurnId: null,
  openRevealWarningModal: (turnId: string) =>
    set({ revealWarningModalOpen: true, pendingRevealTurnId: turnId }),
  closeRevealWarningModal: () =>
    set({ revealWarningModalOpen: false, pendingRevealTurnId: null }),
  penaltyToastMessage: null,
  showPenaltyToast: (message: string) => {
    set({ penaltyToastMessage: message });
    setTimeout(() => {
      if (get().penaltyToastMessage === message) {
        set({ penaltyToastMessage: null });
      }
    }, 3500);
  },

  // Topic Switch Warning
  topicChangeWarningModalOpen: false,
  pendingTopicSwitch: null,
  openTopicChangeWarningModal: (onConfirm: () => void) =>
    set({ topicChangeWarningModalOpen: true, pendingTopicSwitch: onConfirm }),
  closeTopicChangeWarningModal: () =>
    set({ topicChangeWarningModalOpen: false, pendingTopicSwitch: null }),

  // Pronunciation Lab Flashcards
  pronunciationMistakes: INITIAL_STARTER_MISTAKES,
  addPronunciationMistake: (mistake) =>
    set((state) => {
      const normalizedWord = mistake.word.trim().toLowerCase();
      const existingIndex = state.pronunciationMistakes.findIndex(
        (m) => m.word.toLowerCase() === normalizedWord
      );

      if (existingIndex >= 0) {
        const updated = [...state.pronunciationMistakes];
        const prev = updated[existingIndex]!;
        updated[existingIndex] = {
          ...prev,
          mistakeCount: prev.mistakeCount + 1,
          isMastered: false,
          errorReason: mistake.errorReason || prev.errorReason,
          contextSentence: mistake.contextSentence || prev.contextSentence,
        };
        return { pronunciationMistakes: updated };
      }

      const newMistake: MistakeItem = {
        ...mistake,
        id: `mistake-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        mistakeCount: 1,
        isMastered: false,
        createdAt: new Date().toISOString(),
      };
      return { pronunciationMistakes: [newMistake, ...state.pronunciationMistakes] };
    }),

  markMistakeMastered: (word: string) =>
    set((state) => ({
      pronunciationMistakes: state.pronunciationMistakes.map((m) =>
        m.word.toLowerCase() === word.trim().toLowerCase() ? { ...m, isMastered: true } : m
      ),
    })),

  // Speaking AI: Ephemeral In-Memory Chat (RAM-only, volatile)
  ephemeralMessages: [],
  addEphemeralMessage: (turn) =>
    set((state) => {
      const last = state.ephemeralMessages[state.ephemeralMessages.length - 1];
      if (
        last &&
        (last.id === turn.id ||
          (last.speaker === turn.speaker && last.text.trim() === turn.text.trim()))
      ) {
        return state;
      }
      return { ephemeralMessages: [...state.ephemeralMessages, turn] };
    }),
  clearEphemeralMessages: () => set({ ephemeralMessages: [] }),

  // Practice Configuration
  practiceMode: 'mock_test',
  setPracticeMode: (practiceMode) => set({ practiceMode }),
  targetLevel: 'b2',
  setTargetLevel: (targetLevel) => set({ targetLevel }),
  feedbackLanguage: 'en_vn',
  setFeedbackLanguage: (feedbackLanguage) => set({ feedbackLanguage }),

  // Onboarding
  hasCompletedOnboarding:
    typeof window !== 'undefined'
      ? window.localStorage.getItem('tamspeak_onboarding_completed') === 'true'
      : true,
  setHasCompletedOnboarding: (completed: boolean) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('tamspeak_onboarding_completed', String(completed));
    }
    set((state) => ({
      hasCompletedOnboarding: completed,
      user: state.user ? { ...state.user, hasCompletedOnboarding: completed } : null,
    }));
  },

  // Dynamic AI Vocab Hints
  aiVocabHints: null,
  setAiVocabHints: (aiVocabHints) => set({ aiVocabHints }),
  isLoadingVocabHints: false,
  setIsLoadingVocabHints: (isLoadingVocabHints) => set({ isLoadingVocabHints }),

  // Full Mock Test Progress Tracker
  mockTestProgress: null,
  setMockTestProgress: (mockTestProgress) => set({ mockTestProgress }),
}));
