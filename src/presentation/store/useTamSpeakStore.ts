import { create } from 'zustand';
import { DialogueTurn } from '../../domain/entities/PracticeSession';
import { PracticeSessionDTO, CustomTopicDTO, UserProfileDTO } from '../../application/dtos';

export type NavigationView =
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
  isLastMessageHidden: boolean;
  toggleHideLastMessage: () => void;
  setIsLastMessageHidden: (hidden: boolean) => void;
  isAutoVadEnabled: boolean;
  toggleAutoVad: () => void;

  // Active Practice & Dialogue
  activeSession: PracticeSessionDTO | null;
  setActiveSession: (session: PracticeSessionDTO | null) => void;
  activeTopic: CustomTopicDTO | null;
  setActiveTopic: (topic: CustomTopicDTO | null) => void;
  dialogueTurns: DialogueTurn[];
  addDialogueTurn: (turn: DialogueTurn) => void;
  clearDialogueTurns: () => void;

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

  // Practice Configuration
  practiceMode: 'mock_test' | 'coaching' | 'free_roleplay';
  setPracticeMode: (mode: 'mock_test' | 'coaching' | 'free_roleplay') => void;
  targetLevel: 'a2' | 'b1' | 'b2' | 'c1' | 'c2';
  setTargetLevel: (level: 'a2' | 'b1' | 'b2' | 'c1' | 'c2') => void;
  feedbackLanguage: 'en_vn' | 'en_en';
  setFeedbackLanguage: (lang: 'en_vn' | 'en_en') => void;
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
  activeAIProvider: 'Gemini 2.5 Flash',
  setActiveAIProvider: (activeAIProvider) => set({ activeAIProvider }),
  activeAIVoice: 'Aoede (US)',
  setActiveAIVoice: (activeAIVoice) => set({ activeAIVoice }),
  isFallbackActive: false,
  setIsFallbackActive: (isFallbackActive) => set({ isFallbackActive }),

  // Interactive Transcript
  lastAIMessage: 'Hello! Welcome to TamSpeak. I am your AI Speaking Examiner. Press and hold Space to begin speaking!',
  setLastAIMessage: (message) => set({ lastAIMessage: message }),
  isLastMessageHidden: false,
  toggleHideLastMessage: () => set((state) => ({ isLastMessageHidden: !state.isLastMessageHidden })),
  setIsLastMessageHidden: (hidden) => set({ isLastMessageHidden: hidden }),
  isAutoVadEnabled: false,
  toggleAutoVad: () => set((state) => ({ isAutoVadEnabled: !state.isAutoVadEnabled })),

  // Active Practice & Dialogue
  activeSession: null,
  setActiveSession: (session) => set({ activeSession: session }),
  activeTopic: null,
  setActiveTopic: (topic) => set({ activeTopic: topic }),
  dialogueTurns: [],
  addDialogueTurn: (turn) => set((state) => ({ dialogueTurns: [...state.dialogueTurns, turn] })),
  clearDialogueTurns: () => set({ dialogueTurns: [] }),

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
    set({ topicChangeWarningModalOpen: true, pendingTopicSwitch: () => onConfirm }),
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

  // Practice Configuration
  practiceMode: 'mock_test',
  setPracticeMode: (practiceMode) => set({ practiceMode }),
  targetLevel: 'b2',
  setTargetLevel: (targetLevel) => set({ targetLevel }),
  feedbackLanguage: 'en_vn',
  setFeedbackLanguage: (feedbackLanguage) => set({ feedbackLanguage }),
}));
