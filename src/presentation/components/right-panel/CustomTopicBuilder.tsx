import React, { useState } from 'react';
import { ArrowLeft, Plus, X, Loader2, ShieldCheck } from 'lucide-react';
import { useTamSpeakStore } from '../../store';
import { container } from '../../../di/DIContainer';
import { aiService } from '../../../infrastructure/ai/AIService';
import { SkillLevel } from '../../../domain/entities/User';

interface CustomTopicBuilderProps {
  onBack: () => void;
  onTopicCreated?: () => void;
}

export const CustomTopicBuilder: React.FC<CustomTopicBuilderProps> = ({ onBack, onTopicCreated }) => {
  const {
    user,
    setActiveTopic,
    setOrbState,
    setLastAIMessage,
    setCurrentExaminerPrompt,
    addDialogueTurn,
    addCustomRoleplayTopic,
  } = useTamSpeakStore();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [contextPrompt, setContextPrompt] = useState('');
  const [aiRole, setAiRole] = useState('Interviewer');
  const [userRole, setUserRole] = useState('Candidate');
  const [keywordInput, setKeywordInput] = useState('');
  const [keywords, setKeywords] = useState<string[]>([]);
  const [targetLevel, setTargetLevel] = useState<SkillLevel>('b2');
  const [isPublic, setIsPublic] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleAddKeyword = () => {
    const trimmed = keywordInput.trim().toLowerCase();
    if (trimmed && !keywords.includes(trimmed) && keywords.length < 20) {
      setKeywords([...keywords, trimmed]);
      setKeywordInput('');
    }
  };

  const handleRemoveKeyword = (keywordToRemove: string) => {
    setKeywords(keywords.filter((k) => k !== keywordToRemove));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);

    try {
      const topicDto = await container.createCustomTopicUseCase.execute({
        userId: user?.id || 'guest-user',
        title,
        description,
        contextPrompt: contextPrompt || description,
        aiRole,
        userRole,
        targetKeywords: keywords,
        targetLevel,
        isPublic,
      });

      // Save custom topic to store so it permanently stays in Roleplay & Chat list
      addCustomRoleplayTopic({
        id: topicDto.id,
        title: topicDto.title,
        description: topicDto.description,
        aiRole: topicDto.aiRole,
        userRole: topicDto.userRole,
        duration: 'Custom',
        tags: ['Custom Roleplay', topicDto.aiRole],
        targetKeywords: topicDto.targetKeywords,
        createdAt: topicDto.createdAt,
      });

      // Activate topic in state
      setActiveTopic(topicDto);

      // 100% Dynamic AI Roleplay initial greeting via Gemini
      let greeting = '';
      try {
        greeting = await aiService.generateTopicOpening({
          topicTitle: topicDto.title,
          mode: 'roleplay',
          aiRole: topicDto.aiRole,
          userRole: topicDto.userRole,
        });
      } catch {
        greeting = `Hello! I will be acting as your ${aiRole}. In this scenario, you are the ${userRole}. Whenever you are ready, press and hold [Space] to introduce yourself!`;
      }

      setLastAIMessage(greeting);
      setCurrentExaminerPrompt(greeting);
      addDialogueTurn({
        id: `turn-ai-greeting-${Date.now()}`,
        speaker: 'ai',
        text: greeting,
        timestampSeconds: 0,
      });

      setOrbState('speaking');
      container.speechTTSEngine.speak(greeting, {
        onEnd: () => setOrbState('idle'),
        onError: () => setOrbState('idle'),
      });

      if (onTopicCreated) {
        onTopicCreated();
      } else {
        onBack();
      }
    } catch (err) {
      setErrorMessage((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto pr-1 animate-in fade-in">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-teal-700 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Presets</span>
        </button>
        <span className="text-[11px] font-bold uppercase text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full flex items-center gap-1">
          <ShieldCheck className="w-3 h-3" />
          Zero-Trust Guarded
        </span>
      </div>

      <div className="mb-4">
        <h3 className="text-base font-bold text-slate-900">Custom Topic Builder</h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Design any speaking scenario, interview, or roleplay context with AI.
        </p>
      </div>

      {errorMessage && (
        <div className="mb-3 p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">
          {errorMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3.5 text-xs flex-1">
        {/* Topic Title */}
        <div>
          <label className="block font-semibold text-slate-700 mb-1">
            Topic Title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Senior Tech Lead Behavioral Interview"
            className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-teal-500 text-xs"
          />
        </div>

        {/* Roles 2-Column Grid */}
        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">AI's Role</label>
            <input
              type="text"
              required
              value={aiRole}
              onChange={(e) => setAiRole(e.target.value)}
              placeholder="e.g. Hiring Manager"
              className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-teal-500 text-xs"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">My Role</label>
            <input
              type="text"
              required
              value={userRole}
              onChange={(e) => setUserRole(e.target.value)}
              placeholder="e.g. Job Candidate"
              className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-teal-500 text-xs"
            />
          </div>
        </div>

        {/* Scenario Description & Context */}
        <div>
          <label className="block font-semibold text-slate-700 mb-1">
            Description & Context Prompt <span className="text-red-500">*</span>
          </label>
          <textarea
            required
            rows={3}
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              if (!contextPrompt) setContextPrompt(e.target.value);
            }}
            placeholder="Paste Job Description, situation context, or background requirements here..."
            className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-teal-500 text-xs resize-none"
          />
        </div>

        {/* Target Level */}
        <div>
          <label className="block font-semibold text-slate-700 mb-1">Target CEFR Level</label>
          <div className="flex items-center gap-1.5">
            {(['a2', 'b1', 'b2', 'c1', 'c2'] as SkillLevel[]).map((level) => (
              <button
                type="button"
                key={level}
                onClick={() => setTargetLevel(level)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold uppercase transition-all ${
                  targetLevel === level
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {level}
              </button>
            ))}
          </div>
        </div>

        {/* Target Keywords / Idioms */}
        <div>
          <label className="block font-semibold text-slate-700 mb-1">
            Target Keywords & Idioms
          </label>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddKeyword();
                }
              }}
              placeholder="e.g. scalability, trade-off, paradigm shift"
              className="flex-1 px-3 py-1.5 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-teal-500 text-xs"
            />
            <button
              type="button"
              onClick={handleAddKeyword}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              Add
            </button>
          </div>

          {keywords.length > 0 && (
            <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 rounded-xl border border-slate-200">
              {keywords.map((kw) => (
                <span
                  key={kw}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-teal-50 border border-teal-200 text-teal-800 font-medium text-[11px]"
                >
                  {kw}
                  <button
                    type="button"
                    onClick={() => handleRemoveKeyword(kw)}
                    className="hover:text-red-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Public Sharing Toggle */}
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200">
          <div>
            <span className="font-semibold text-slate-800">Make Topic Public</span>
            <p className="text-[10px] text-slate-500">Allow other learners to practice this scenario</p>
          </div>
          <input
            type="checkbox"
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
            className="w-4 h-4 text-teal-600 rounded border-slate-300 focus:ring-teal-500"
          />
        </div>

        {/* Submit Button */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-sm hover:shadow transition-all flex items-center justify-center gap-2"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <span>Save & Start Conversation</span>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
