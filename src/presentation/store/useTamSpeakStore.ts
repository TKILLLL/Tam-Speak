import { create } from 'zustand';
import { DialogueTurn } from '../../domain/entities/PracticeSession';
import { PracticeSessionDTO, CustomTopicDTO, UserProfileDTO } from '../../application/dtos';

export type NavigationView =
  | 'ielts'
  | 'conversation'
  | 'pronunciation'
  | 'scratchpad'
  | 'vocab_bank'
  | 'progress'
  | 'raw_data'
  | 'settings';

export type RightPanelTab = 'quick_start' | 'qna' | 'scoring' | 'vocab_hints';

export type OrbState = 'idle' | 'listening' | 'thinking' | 'speaking';

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
  rightPanelOpenMobile: boolean;
  setRightPanelOpenMobile: (open: boolean) => void;

  // Voice Stage & AI Orb
  orbState: OrbState;
  setOrbState: (state: OrbState) => void;
  audioLevel: number; // 0.0 to 1.0
  setAudioLevel: (level: number) => void;
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

  // Practice Configuration
  practiceMode: 'mock_test' | 'coaching' | 'free_roleplay';
  setPracticeMode: (mode: 'mock_test' | 'coaching' | 'free_roleplay') => void;
  targetLevel: 'a2' | 'b1' | 'b2' | 'c1' | 'c2';
  setTargetLevel: (level: 'a2' | 'b1' | 'b2' | 'c1' | 'c2') => void;
  feedbackLanguage: 'en_vn' | 'en_en';
  setFeedbackLanguage: (lang: 'en_vn' | 'en_en') => void;
}

export const useTamSpeakStore = create<TamSpeakState>((set) => ({
  // User & Auth defaults (null initially until Supabase session restores)
  user: null,
  authModalOpen: false,
  setAuthModalOpen: (open) => set({ authModalOpen: open }),
  setUser: (user) => set({ user }),

  // Navigation & Layout
  currentView: 'ielts',
  setCurrentView: (view) => set({ currentView: view }),
  sidebarCollapsed: false,
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  // Right Panel
  rightPanelTab: 'quick_start',
  setRightPanelTab: (tab) => set({ rightPanelTab: tab }),
  rightPanelExpanded: false,
  setRightPanelExpanded: (expanded) => set({ rightPanelExpanded: expanded }),
  rightPanelOpenMobile: false,
  setRightPanelOpenMobile: (open) => set({ rightPanelOpenMobile: open }),

  // Voice Stage & AI Orb
  orbState: 'idle',
  setOrbState: (state) => set({ orbState: state }),
  audioLevel: 0,
  setAudioLevel: (audioLevel) => set({ audioLevel }),
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

  // Practice Configuration
  practiceMode: 'mock_test',
  setPracticeMode: (practiceMode) => set({ practiceMode }),
  targetLevel: 'b2',
  setTargetLevel: (targetLevel) => set({ targetLevel }),
  feedbackLanguage: 'en_vn',
  setFeedbackLanguage: (feedbackLanguage) => set({ feedbackLanguage }),
}));
