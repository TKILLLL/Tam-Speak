import React, { useState } from 'react';
import {
  Mic,
  MessageSquare,
  Clock,
  ChevronRight,
  ArrowLeft,
  PlusCircle,
  Trash2,
} from 'lucide-react';
import { useTamSpeakStore, ActivePartType } from '../../store';
import { CustomTopicBuilder } from './CustomTopicBuilder';
import { container } from '../../../di/DIContainer';
import { PracticeMode } from '../../../domain/entities/PracticeSession';
import { aiService } from '../../../infrastructure/ai/AIService';

const mapPresetToActivePart = (presetId: string, mode: string): ActivePartType => {
  if (presetId === 'p1' || mode === 'ielts_part1') return 'part1';
  if (presetId === 'p2' || mode === 'ielts_part2') return 'part2';
  if (presetId === 'p3' || mode === 'ielts_part3') return 'part3';
  if (presetId === 'mock' || mode === 'ielts_full_mock') return 'full_test';
  if (mode === 'custom_roleplay') return 'roleplay';
  return 'free_talk';
};

interface PresetCard {
  id: string;
  mode: PracticeMode;
  title: string;
  duration: string;
  description: string;
  tags: string[];
  isCustom?: boolean;
  aiRole?: string;
  userRole?: string;
}

const IELTS_PRESETS: PresetCard[] = [
  {
    id: 'p1',
    mode: 'ielts_part1',
    title: 'Part 1: Introduction & Interview',
    duration: '4-5 min',
    description: 'Familiar daily topics (hometown, studies, hobbies) to build confidence.',
    tags: ['4-5 Questions', 'Fluency Building'],
  },
  {
    id: 'p2',
    mode: 'ielts_part2',
    title: 'Part 2: Individual Long Turn',
    duration: '3-4 min',
    description: '1 minute preparation with cue card + 2 minutes continuous speaking.',
    tags: ['Cue Card', 'Coherence & Structure'],
  },
  {
    id: 'p3',
    mode: 'ielts_part3',
    title: 'Part 3: Two-Way Discussion',
    duration: '4-5 min',
    description: 'Abstract and analytical questions delving into social trends.',
    tags: ['Critical Thinking', 'Complex Grammar'],
  },
  {
    id: 'mock',
    mode: 'ielts_full_mock',
    title: 'Full IELTS Mock Test',
    duration: '14 min',
    description: 'Full simulation covering Parts 1, 2, and 3 with full 4-criterion band report.',
    tags: ['Full Exam', 'Official Band Rating'],
  },
];

const DEFAULT_CONVERSATION_PRESETS: PresetCard[] = [
  {
    id: 'c1',
    mode: 'daily_conversation',
    title: 'Everyday Casual & Small Talk',
    duration: 'Open',
    description: 'Casual talk on weekend plans, hobbies, coffee shop banter.',
    tags: ['Natural Flow', 'Slang & Idioms'],
  },
  {
    id: 'c2',
    mode: 'daily_conversation',
    title: 'Travel & Airport Immersion',
    duration: '5-10 min',
    description: 'Hotel check-in, ordering at a restaurant, asking for directions abroad.',
    tags: ['Practical English', 'Global Accents'],
  },
  {
    id: 'c3',
    mode: 'custom_roleplay',
    title: 'Workplace & Standup Meeting',
    duration: '5-10 min',
    description: 'Sprint demo, answering technical questions, discussing project roadblocks.',
    tags: ['Professional Vocab', 'Clear Articulation'],
  },
  {
    id: 'c4',
    mode: 'custom_roleplay',
    title: 'Polite Debate & Diplomacy',
    duration: '5-10 min',
    description: 'Expressing nuanced viewpoints, polite disagreement, counterarguments.',
    tags: ['Advanced Linking', 'Nuanced Tone'],
  },
];

const CURATED_IELTS_TOPICS: string[] = [
  'Hometown & Living Environment',
  'Studies, Work & Career Aspirations',
  'Technology, Smartphones & AI',
  'Environment & Climate Change',
  'Travel, Culture & Tourism',
  'Art, Music & Creative Expression',
  'Health, Fitness & Balanced Lifestyle',
  'Media, Social Networks & News',
  'Education & Lifelong Learning',
  'Family, Friends & Social Bonds',
  'Consumer Habits & Online Shopping',
  'Transportation & Urban Planning',
  'Books, Literature & Reading',
  'Sports, Competition & Leisure',
  'Traditions, Holidays & Celebrations',
];

export const QuickStartTab: React.FC = () => {
  const {
    targetLevel,
    setTargetLevel,
    feedbackLanguage,
    setFeedbackLanguage,
    setActiveTopic,
    setActiveSession,
    setLastAIMessage,
    setCurrentExaminerPrompt,
    setActivePart,
    setActiveTopicTitle,
    setPendingTargetConfig,
    setOrbState,
    user,
    dialogueTurns,
    clearDialogueTurns,
    openTopicChangeWarningModal,
    addDialogueTurn,
    addPronunciationMistake,
    setHasShownRevealWarningInSession,
    setRightPanelTab,
    setMockTestProgress,
    setAiVocabHints,
    setIsLoadingVocabHints,
    customRoleplayTopics,
    removeCustomRoleplayTopic,
  } = useTamSpeakStore();

  const [activeCategory, setActiveCategory] = useState<'ielts' | 'conversation'>('ielts');
  const [selectedPresetId, setSelectedPresetId] = useState<string>('p1');
  const [showTopicPicker, setShowTopicPicker] = useState(false);
  const [isBuildingCustomTopic, setIsBuildingCustomTopic] = useState(false);

  // If currently in Custom Topic Builder mode, render that view
  if (isBuildingCustomTopic) {
    return (
      <CustomTopicBuilder
        onBack={() => setIsBuildingCustomTopic(false)}
        onTopicCreated={() => setIsBuildingCustomTopic(false)}
      />
    );
  }

  // Dynamic custom roleplay cards
  const customPresets: PresetCard[] = customRoleplayTopics.map((ct) => ({
    id: ct.id,
    mode: 'custom_roleplay' as PracticeMode,
    title: ct.title,
    duration: ct.duration || 'Custom',
    description: ct.description,
    tags: ct.tags && ct.tags.length > 0 ? ct.tags : ['Custom Roleplay', ct.aiRole],
    isCustom: true,
    aiRole: ct.aiRole,
    userRole: ct.userRole,
  }));

  const presets =
    activeCategory === 'ielts'
      ? IELTS_PRESETS
      : [...customPresets, ...DEFAULT_CONVERSATION_PRESETS];

  const currentPreset = presets.find((p) => p.id === selectedPresetId) || presets[0]!;

  const executeStartPractice = async (preset: PresetCard, topicTitle?: string) => {
    const title = topicTitle || preset.title;
    const mode = preset.mode;

    const topicId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `topic-${Date.now()}`;
    const sessionId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `sess-${Date.now()}`;
    const userId = user?.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'guest-user');

    // 1. Save unmastered errors from old dialogue turns to Pronunciation Lab
    dialogueTurns.forEach((turn) => {
      turn.mistakes?.forEach((m) => {
        addPronunciationMistake({
          word: m.word,
          ipa: m.ipa,
          contextSentence: turn.text,
          errorReason: m.reason,
          suggestedAlternative: m.suggestedAlternative,
          topicTitle: title,
        });
      });
    });

    // 2. Reset previous conversation & penalty flags
    clearDialogueTurns();
    setHasShownRevealWarningInSession(false);

    // 3. Set active topic in store
    const aiRole = preset.aiRole || (activeCategory === 'ielts' ? 'IELTS Speaking Examiner' : 'Conversational Partner');
    const userRole = preset.userRole || 'Speaking Candidate';

    setActiveTopic({
      id: topicId,
      userId,
      title,
      description: preset.description,
      contextPrompt: preset.description,
      aiRole,
      userRole,
      targetKeywords: [],
      targetLevel,
      isPublic: false,
      createdAt: new Date().toISOString(),
    });

    // 4. Start practice session in domain
    try {
      const { PracticeSession: PSClass } = await import('../../../domain/entities/PracticeSession');
      const newSession = PSClass.create({
        id: sessionId,
        userId,
        mode,
        topicId,
      });
      newSession.startRecording();
      await container.sessionRepository.save(newSession);
    } catch (err) {
      console.warn('Session save notice:', err);
    }

    // 5. Set active session in store without hardcoded scores (real evaluation required)
    setActiveSession({
      id: sessionId,
      userId,
      topicId,
      mode,
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

    const calculatedPart = mapPresetToActivePart(preset.id, mode);
    setActivePart(calculatedPart);
    setActiveTopicTitle(title);

    // 6. 100% Dynamic AI Examiner initial prompts via Gemini (Zero raw question bank data)
    let greeting = '';
    try {
      greeting = await aiService.generateTopicOpening({
        topicTitle: title,
        mode,
        part: calculatedPart,
        aiRole,
        userRole,
      });
    } catch (error) {
      console.warn('Could not generate the opening prompt:', error);
      greeting = '';
    }

    if (mode === 'ielts_full_mock') {
      setMockTestProgress({
        topicTitle: title,
        currentPart: 1,
        questionIndex: 0,
        part1Questions: [],
        part2CueCard: null,
        part3Questions: [],
      });
    } else {
      setMockTestProgress(null);
    }

    setCurrentExaminerPrompt(greeting);
    setLastAIMessage(greeting);

    // Dynamic Vocab Hints generation in background
    setIsLoadingVocabHints(true);
    aiService
      .generateVocabHints(title, greeting)
      .then((hints) => {
        setAiVocabHints(hints);
        setIsLoadingVocabHints(false);
      })
      .catch(() => {
        setIsLoadingVocabHints(false);
      });

    // 7. Push initial greeting to dialogueTurns so Q&A displays it immediately
    if (greeting) {
      addDialogueTurn({
        id: `turn-ai-greeting-${Date.now()}`,
        speaker: 'ai',
        text: greeting,
        timestampSeconds: 0,
      });
    }

    // 8. Speak greeting & switch to Q&A
    setOrbState('speaking');
    setShowTopicPicker(false);
    setRightPanelTab('qna');

    if (greeting) {
      container.speechTTSEngine.speak(greeting, {
        onEnd: () => setOrbState('idle'),
        onError: () => setOrbState('idle'),
      });
    } else {
      setOrbState('idle');
    }
  };

  const handleStartPractice = (presetToUse?: PresetCard, topicTitle?: string) => {
    const preset = presetToUse || currentPreset;
    const title = topicTitle || preset.title;
    const part = mapPresetToActivePart(preset.id, preset.mode);

    if (dialogueTurns.length > 0) {
      setPendingTargetConfig({
        part,
        topicTitle: title,
        mode: preset.mode,
        initialGreeting: '',
      });
      openTopicChangeWarningModal(() => executeStartPractice(preset, topicTitle));
    } else {
      executeStartPractice(preset, topicTitle);
    }
  };

  const handleSelectPreset = (preset: PresetCard) => {
    setSelectedPresetId(preset.id);
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto pr-1 select-none">
      {/* Category Toggle: IELTS vs Conversation Practice */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-2xl mb-3">
        <button
          onClick={() => {
            setActiveCategory('ielts');
            setSelectedPresetId('p1');
            setShowTopicPicker(false);
          }}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all ${
            activeCategory === 'ielts'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Mic className={`w-3.5 h-3.5 ${activeCategory === 'ielts' ? 'text-teal-600' : 'text-slate-400'}`} />
          <span>IELTS Speaking</span>
        </button>

        <button
          onClick={() => {
            setActiveCategory('conversation');
            setSelectedPresetId(customPresets[0]?.id || 'c1');
            setShowTopicPicker(false);
          }}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all ${
            activeCategory === 'conversation'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <MessageSquare className={`w-3.5 h-3.5 ${activeCategory === 'conversation' ? 'text-teal-600' : 'text-slate-400'}`} />
          <span>Roleplay & Chat</span>
        </button>
      </div>

      {/* Sleek Practice Controls Bar (Feedback Language & Target Level) */}
      <div className="flex items-center justify-between gap-2 px-1 mb-3.5 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-bold text-slate-500">Feedback:</span>
          <div className="flex p-0.5 bg-slate-100 rounded-lg">
            <button
              onClick={() => setFeedbackLanguage('en_vn')}
              className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition-all ${
                feedbackLanguage === 'en_vn'
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              EN-VN
            </button>
            <button
              onClick={() => setFeedbackLanguage('en_en')}
              className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition-all ${
                feedbackLanguage === 'en_en'
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              EN-EN
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-bold text-slate-500">Target:</span>
          <select
            value={targetLevel}
            onChange={(e) => setTargetLevel(e.target.value as 'a2' | 'b1' | 'b2' | 'c1' | 'c2')}
            className="bg-slate-100 border-0 rounded-lg px-2 py-0.5 text-[11px] font-bold text-slate-800 uppercase cursor-pointer hover:bg-slate-200/70"
          >
            <option value="a2">A2 (4.0-5.0)</option>
            <option value="b1">B1 (5.0-6.0)</option>
            <option value="b2">B2 (6.5-7.5)</option>
            <option value="c1">C1 (8.0-8.5)</option>
            <option value="c2">C2 (9.0)</option>
          </select>
        </div>
      </div>

      {/* TOPIC PICKER VIEW IF ACTIVE */}
      {showTopicPicker ? (
        <div className="flex-1 flex flex-col animate-in fade-in">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
            <button
              onClick={() => setShowTopicPicker(false)}
              className="flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-teal-700"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>
            <span className="text-xs font-bold text-slate-800">Select IELTS Topic</span>
          </div>

          <div className="space-y-2 flex-1 overflow-y-auto mb-4">
            {CURATED_IELTS_TOPICS.map((topic, i) => (
              <button
                key={topic}
                onClick={() => handleStartPractice(undefined, topic)}
                className="w-full p-3 rounded-xl border border-slate-200 hover:border-teal-400 hover:bg-teal-50/50 text-left transition-all group flex items-center justify-between"
              >
                <div>
                  <span className="text-xs font-semibold text-slate-800 group-hover:text-teal-900">
                    {i + 1}. {topic}
                  </span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-teal-600" />
              </button>
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* Create Custom Topic Banner in Conversation Mode */}
          {activeCategory === 'conversation' && (
            <button
              onClick={() => setIsBuildingCustomTopic(true)}
              className="w-full mb-3.5 p-3 rounded-2xl bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white font-bold text-xs shadow-xs hover:shadow transition-all flex items-center justify-between group"
            >
              <div className="flex items-center gap-2">
                <PlusCircle className="w-4 h-4 text-white" />
                <span className="text-left">Create Custom Topic & JD Roleplay</span>
              </div>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </button>
          )}

          {/* Preset Cards List */}
          <div className="space-y-2.5 mb-4 flex-1 overflow-y-auto">
            {presets.map((preset) => {
              const isSelected = selectedPresetId === preset.id;
              return (
                <div
                  key={preset.id}
                  onClick={() => handleSelectPreset(preset)}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative group ${
                    isSelected
                      ? 'bg-gradient-to-r from-teal-100/90 via-cyan-50/80 to-teal-50/90 border-teal-500 shadow-xs ring-1 ring-teal-500/30'
                      : 'bg-slate-200/70 hover:bg-slate-200 text-slate-800 border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between mb-1.5">
                    <div className="pr-2">
                      <div className="flex items-center gap-1.5">
                        <h4 className="font-bold text-xs text-slate-900">{preset.title}</h4>
                        {preset.isCustom && (
                          <span className="text-[9px] bg-teal-600 text-white px-1.5 py-0.2 rounded-full font-bold">
                            User Created
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-600 mt-0.5 line-clamp-1">
                        {preset.description}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1 bg-white/70 px-2 py-0.5 rounded-full border border-slate-200">
                        <Clock className="w-3.5 h-3.5 text-teal-600" />
                        {preset.duration}
                      </span>
                      {preset.isCustom && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeCustomRoleplayTopic(preset.id);
                          }}
                          title="Delete custom topic"
                          className="p-1 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    {preset.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-[10px] rounded-full px-2 py-0.5 border border-slate-300 bg-white/60 text-slate-700 font-medium"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Action Row: Choose Topic & Start */}
          <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
            {activeCategory === 'ielts' && (
              <button
                onClick={() => setShowTopicPicker(true)}
                className="flex-1 py-2.5 px-3 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-bold transition-all text-center"
              >
                Choose Topic
              </button>
            )}
            <button
              onClick={() => handleStartPractice()}
              className="flex-1 py-2.5 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-xs hover:shadow transition-all text-center"
            >
              Start Practice
            </button>
          </div>
        </>
      )}
    </div>
  );
};
