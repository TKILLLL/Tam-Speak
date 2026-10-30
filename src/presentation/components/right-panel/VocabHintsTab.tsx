import React, { useCallback, useEffect, useState } from 'react';
import { Volume2, Copy, Check, Lightbulb, BookOpen, Sparkles, RefreshCw } from 'lucide-react';
import { useTamSpeakStore } from '../../store';
import { container } from '../../../di/DIContainer';
import { aiService } from '../../../infrastructure/ai/AIService';

export const VocabHintsTab: React.FC = () => {
  const {
    activeTopicTitle,
    currentExaminerPrompt,
    lastAIMessage,
    aiVocabHints,
    setAiVocabHints,
    isLoadingVocabHints,
    setIsLoadingVocabHints,
  } = useTamSpeakStore();

  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const hasHints = Boolean(
    aiVocabHints &&
      (aiVocabHints.activeKeywords?.length ||
        aiVocabHints.collocations?.length ||
        aiVocabHints.idioms?.length)
  );

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handlePlay = (text: string) => {
    container.speechTTSEngine.speak(text, { rate: 0.9 });
  };

  const handleRefreshHints = useCallback(async () => {
    setIsLoadingVocabHints(true);
    try {
      const topic = activeTopicTitle.trim();
      const prompt = (currentExaminerPrompt || lastAIMessage).trim();
      if (!topic || !prompt) {
        setAiVocabHints(null);
        return;
      }
      const hints = await aiService.generateVocabHints(topic, prompt);
      setAiVocabHints(hints);
    } catch (err) {
      console.warn('Failed to refresh vocab hints:', err);
    } finally {
      setIsLoadingVocabHints(false);
    }
  }, [activeTopicTitle, currentExaminerPrompt, lastAIMessage, setAiVocabHints, setIsLoadingVocabHints]);

  // Refresh only when the actual discussion context changes. AIService caches
  // the same topic/question pair, so this stays responsive without stale hints.
  useEffect(() => {
    if (activeTopicTitle && (currentExaminerPrompt || lastAIMessage)) {
      void handleRefreshHints();
    }
  }, [activeTopicTitle, currentExaminerPrompt, lastAIMessage, handleRefreshHints]);

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto pr-1 select-none text-xs space-y-4 pb-4">
      {/* Header bar with Refresh button */}
      <div className="flex items-center justify-between p-3 rounded-2xl bg-gradient-to-r from-teal-50 to-cyan-50 border border-teal-200">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700 block">
            AI Lexical Suggestions
          </span>
          <p className="text-slate-800 font-bold text-xs truncate max-w-[200px]">
            {activeTopicTitle || 'General Speaking'}
          </p>
        </div>
        <button
          onClick={handleRefreshHints}
          disabled={isLoadingVocabHints}
          title="Tạo lại gợi ý từ vựng mới theo ngữ cảnh"
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white border border-teal-200 hover:bg-teal-50 text-teal-700 text-[11px] font-semibold transition-all disabled:opacity-50 shadow-2xs"
        >
          <RefreshCw className={`w-3 h-3 ${isLoadingVocabHints ? 'animate-spin' : ''}`} />
          <span>Làm mới</span>
        </button>
      </div>

      {isLoadingVocabHints ? (
        <div className="space-y-3 p-4">
          <div className="flex items-center justify-center gap-2 text-teal-600 font-medium text-xs py-4">
            <Sparkles className="w-4 h-4 animate-spin text-teal-600" />
            <span>AI đang tạo bộ từ vựng Band 8.0+ theo chủ đề...</span>
          </div>
          <div className="h-16 bg-slate-100 rounded-xl animate-pulse" />
          <div className="h-16 bg-slate-100 rounded-xl animate-pulse" />
          <div className="h-16 bg-slate-100 rounded-xl animate-pulse" />
        </div>
      ) : aiVocabHints && hasHints ? (
        <>
          {/* Active Band 7.5 - 8.5 Keywords */}
          {aiVocabHints.activeKeywords && aiVocabHints.activeKeywords.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-slate-800 text-[11px] flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                  Band 7.5 - 8.5 Lexical Keywords
                </span>
                <span className="text-[10px] text-teal-600 font-semibold font-mono">
                  {aiVocabHints.activeKeywords.length} từ
                </span>
              </div>

              <div className="space-y-2">
                {aiVocabHints.activeKeywords.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-xl border border-slate-200 bg-white hover:border-teal-300 transition-all shadow-2xs"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-xs">{item.word}</span>
                        <span className="font-mono text-[10px] text-teal-700 font-bold bg-teal-50 px-1.5 py-0.5 rounded border border-teal-100">
                          {item.ipa}
                        </span>
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1 rounded border border-emerald-100">
                          Band {item.band}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handlePlay(item.word)}
                          title="Listen pronunciation"
                          className="p-1 text-slate-400 hover:text-teal-600 rounded transition-colors"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleCopy(item.word, `kw-${idx}`)}
                          title="Copy word"
                          className="p-1 text-slate-400 hover:text-slate-700 rounded transition-colors"
                        >
                          {copiedKey === `kw-${idx}` ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                    <p className="text-[11px] text-teal-800 font-medium">{item.meaningVi}</p>
                    {item.example && (
                      <p className="text-[10px] text-slate-500 italic mt-1 bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                        "{item.example}"
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Natural Collocations */}
          {aiVocabHints.collocations && aiVocabHints.collocations.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-slate-800 text-[11px] flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-teal-600" />
                  Natural Topic Collocations
                </span>
                <span className="text-[10px] text-teal-600 font-semibold font-mono">
                  {aiVocabHints.collocations.length} cụm
                </span>
              </div>

              <div className="space-y-2">
                {aiVocabHints.collocations.map((c, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-xl border border-slate-200 bg-white hover:border-teal-300 transition-all shadow-2xs"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-slate-900 text-xs">{c.phrase}</span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handlePlay(c.phrase)}
                          title="Listen pronunciation"
                          className="p-1 text-slate-400 hover:text-teal-600 rounded transition-colors"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleCopy(c.phrase, `col-${idx}`)}
                          title="Copy phrase"
                          className="p-1 text-slate-400 hover:text-slate-700 rounded transition-colors"
                        >
                          {copiedKey === `col-${idx}` ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                    <p className="text-[11px] text-teal-800 font-medium">{c.meaningVi}</p>
                    {c.example && (
                      <p className="text-[10px] text-slate-500 italic mt-1 bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                        "{c.example}"
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Contextual Idioms */}
          {aiVocabHints.idioms && aiVocabHints.idioms.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-slate-800 text-[11px] flex items-center gap-1.5">
                  <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                  Contextual Idiomatic Expressions
                </span>
                <span className="text-[10px] text-teal-600 font-semibold font-mono">
                  {aiVocabHints.idioms.length} thành ngữ
                </span>
              </div>

              <div className="space-y-2">
                {aiVocabHints.idioms.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-xl border border-slate-200 bg-white hover:border-teal-300 transition-all shadow-2xs"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-xs">{item.idiom}</span>
                        {item.ipa && (
                          <span className="font-mono text-[10px] text-teal-700 font-bold bg-teal-50 px-1.5 py-0.5 rounded border border-teal-100">
                            {item.ipa}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handlePlay(item.idiom)}
                          title="Listen pronunciation"
                          className="p-1 text-slate-400 hover:text-teal-600 rounded transition-colors"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleCopy(item.idiom, `idm-${idx}`)}
                          title="Copy idiom"
                          className="p-1 text-slate-400 hover:text-slate-700 rounded transition-colors"
                        >
                          {copiedKey === `idm-${idx}` ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-600 font-medium">{item.meaningEn}</p>
                    <p className="text-[11px] text-teal-800 font-medium mt-0.5">{item.meaningVi}</p>
                    {item.example && (
                      <p className="text-[10px] text-slate-500 italic mt-1 bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                        "{item.example}"
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="p-6 text-center text-slate-400 border border-dashed border-slate-200 rounded-2xl">
          <BookOpen className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="font-medium text-xs text-slate-600">Chưa có gợi ý từ vựng</p>
          <p className="text-[11px] text-slate-400 mt-1 mb-3">
            Bấm nút dưới đây để AI phân tích chủ đề và sinh gợi ý từ vựng Band 8.0+
          </p>
          <button
            onClick={handleRefreshHints}
            className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors"
          >
            Tạo gợi ý từ vựng
          </button>
        </div>
      )}
    </div>
  );
};
