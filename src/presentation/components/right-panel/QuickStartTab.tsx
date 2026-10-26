import React, { useState } from 'react';
import {
  Mic,
  MessageSquare,
  Clock,
  Sparkles,
  ChevronRight,
  ArrowLeft,
  PlusCircle,
} from 'lucide-react';
import { useTamSpeakStore } from '../../store';
import { CustomTopicBuilder } from './CustomTopicBuilder';
import { container } from '../../../di/DIContainer';
import { PracticeMode } from '../../../domain/entities/PracticeSession';
import { SkillLevel } from '../../../domain/entities/User';

interface PresetCard {
  id: string;
  mode: PracticeMode;
  title: string;
  duration: string;
  description: string;
  tags: string[];
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

const CONVERSATION_PRESETS: PresetCard[] = [
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

const CURATED_IELTS_TOPICS = [
  'Hometown and Local Neighborhood',
  'Studies vs Work and Career Plans',
  'Accommodation & Living Spaces',
  'Weather, Seasons & Climate',
  'Public Transportation & Commuting',
  'Modern Technology & Artificial Intelligence',
  'Reading Habits & Favorite Books',
  'Health, Sports & Outdoor Leisure',
];

export const QuickStartTab: React.FC = () => {
  const {
    practiceMode,
    setPracticeMode,
    targetLevel,
    setTargetLevel,
    feedbackLanguage,
    setFeedbackLanguage,
    activeAIVoice,
    setActiveAIVoice,
    activeTopic,
    setActiveTopic,
    setActiveSession,
    setLastAIMessage,
    setOrbState,
    user,
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

  const presets = activeCategory === 'ielts' ? IELTS_PRESETS : CONVERSATION_PRESETS;
  const currentPreset = presets.find((p) => p.id === selectedPresetId) || presets[0]!;

  const handleStartPractice = async (topicTitle?: string) => {
    const title = topicTitle || activeTopic?.title || currentPreset.title;
    const mode = currentPreset.mode;

    const topicId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `topic-${Date.now()}`;
    const sessionId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `sess-${Date.now()}`;
    const userId = user?.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'guest-user');

    // 1. Set active topic in store
    setActiveTopic({
      id: topicId,
      userId,
      title,
      description: currentPreset.description,
      contextPrompt: currentPreset.description,
      aiRole: activeCategory === 'ielts' ? 'IELTS Speaking Examiner' : 'Conversational Partner',
      userRole: 'Speaking Candidate',
      targetKeywords: ['perspective', 'notably', 'consequently'],
      targetLevel,
      isPublic: false,
      createdAt: new Date().toISOString(),
    });

    // 2. Start practice session in domain
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

    // 3. Set active session in store
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

    // 4. Set AI greeting & speak with Web Speech TTS
    const greeting =
      activeCategory === 'ielts'
        ? `Welcome to the IELTS Speaking test. My name is your AI examiner. Today we will focus on: "${title}". Could you please introduce yourself?`
        : `Hi there! I am excited to practice speaking with you about "${title}". Whenever you are ready, hold [Space] and share your thoughts!`;

    setLastAIMessage(greeting);
    setOrbState('speaking');
    setShowTopicPicker(false);

    container.speechTTSEngine.speak(greeting, {
      onEnd: () => setOrbState('idle'),
      onError: () => setOrbState('idle'),
    });
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto pr-1 select-none">
      {/* Category Toggle: IELTS vs Conversation Practice */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-2xl mb-4">
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
            setSelectedPresetId('c1');
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

      {/* TOPIC PICKER MODAL/VIEW IF ACTIVE */}
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
                onClick={() => handleStartPractice(topic)}
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
          <div className="space-y-2.5 mb-4">
            {presets.map((preset) => {
              const isSelected = selectedPresetId === preset.id;
              return (
                <div
                  key={preset.id}
                  onClick={() => setSelectedPresetId(preset.id)}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-gradient-to-r from-teal-100/90 via-cyan-50/80 to-teal-50/90 border-teal-500 shadow-xs ring-1 ring-teal-500/30'
                      : 'bg-slate-200/70 hover:bg-slate-200 text-slate-800 border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between mb-1.5">
                    <div>
                      <h4 className="font-bold text-xs text-slate-900">{preset.title}</h4>
                      <p className="text-[11px] text-slate-600 mt-0.5 line-clamp-1">
                        {preset.description}
                      </p>
                    </div>
                    <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1 bg-white/70 px-2 py-0.5 rounded-full border border-slate-200 shrink-0">
                      <Clock className="w-3 h-3 text-teal-600" />
                      {preset.duration}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 mt-2">
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
          <div className="flex items-center gap-2 mb-5">
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
              className="flex-1 py-2.5 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-xs hover:shadow transition-all flex items-center justify-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Start Practice</span>
            </button>
          </div>

          {/* Essential Settings (2x2 Grid) */}
          <div className="border-t border-slate-100 pt-4 mt-auto">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2.5">
              Essential Practice Settings
            </span>

            <div className="grid grid-cols-2 gap-2 text-xs">
              {/* 1. Target Level */}
              <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/50">
                <span className="block text-[10px] font-semibold text-slate-500 mb-1">
                  Target CEFR Level
                </span>
                <select
                  value={targetLevel}
                  onChange={(e) => setTargetLevel(e.target.value as SkillLevel)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 uppercase focus:ring-1 focus:ring-teal-500"
                >
                  <option value="a2">A2 (Band 4.0 - 5.0)</option>
                  <option value="b1">B1 (Band 5.0 - 6.0)</option>
                  <option value="b2">B2 (Band 6.5 - 7.5)</option>
                  <option value="c1">C1 (Band 8.0 - 8.5)</option>
                  <option value="c2">C2 (Band 9.0)</option>
                </select>
              </div>

              {/* 2. Practice Mode */}
              <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/50">
                <span className="block text-[10px] font-semibold text-slate-500 mb-1">
                  Practice Mode
                </span>
                <select
                  value={practiceMode}
                  onChange={(e) => setPracticeMode(e.target.value as 'mock_test' | 'coaching' | 'free_roleplay')}
                  className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 focus:ring-1 focus:ring-teal-500"
                >
                  <option value="mock_test">Official Mock Test</option>
                  <option value="coaching">Coaching & Live Tips</option>
                  <option value="free_roleplay">Free Roleplay</option>
                </select>
              </div>

              {/* 3. Feedback Language */}
              <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/50">
                <span className="block text-[10px] font-semibold text-slate-500 mb-1">
                  Feedback Language
                </span>
                <div className="flex gap-1">
                  <button
                    onClick={() => setFeedbackLanguage('en_vn')}
                    className={`flex-1 py-1 rounded text-[11px] font-bold ${
                      feedbackLanguage === 'en_vn' ? 'bg-teal-600 text-white' : 'bg-white border text-slate-600'
                    }`}
                  >
                    EN - VN
                  </button>
                  <button
                    onClick={() => setFeedbackLanguage('en_en')}
                    className={`flex-1 py-1 rounded text-[11px] font-bold ${
                      feedbackLanguage === 'en_en' ? 'bg-teal-600 text-white' : 'bg-white border text-slate-600'
                    }`}
                  >
                    EN - EN
                  </button>
                </div>
              </div>

              {/* 4. AI Voice & Accent */}
              <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/50">
                <span className="block text-[10px] font-semibold text-slate-500 mb-1">
                  AI Voice & Accent
                </span>
                <select
                  value={activeAIVoice}
                  onChange={(e) => setActiveAIVoice(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 focus:ring-1 focus:ring-teal-500"
                >
                  <option value="Aoede (US)">Aoede (US English)</option>
                  <option value="Charon (UK)">Charon (UK English)</option>
                  <option value="Kore (AU)">Kore (AU English)</option>
                </select>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
