import React, { useState, useEffect } from 'react';
import { Sparkles, Volume2, Copy, Check, Lightbulb } from 'lucide-react';
import { useTamSpeakStore } from '../../store';
import { container } from '../../../di/DIContainer';
import { CollocationSuggestion } from '../../../domain/interfaces/IDictionaryGateway';

export const VocabHintsTab: React.FC = () => {
  const { activeTopic } = useTamSpeakStore();
  const [collocations, setCollocations] = useState<CollocationSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchHints = async () => {
      setLoading(true);
      try {
        // Extract main keyword from topic title
        const keyword = activeTopic?.targetKeywords?.[0] || 'memory';
        const suggestions = await container.dictionaryGateway.getCollocations(keyword);
        if (isMounted) {
          setCollocations(suggestions);
        }
      } catch {
        // Safe ignore
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchHints();
    return () => {
      isMounted = false;
    };
  }, [activeTopic]);

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handlePlay = (text: string) => {
    container.speechTTSEngine.speak(text);
  };

  const curatedIdioms = [
    { idiom: 'once in a blue moon', meaning: 'very rarely; once in a long while' },
    { idiom: 'at the drop of a hat', meaning: 'instantly, without hesitation' },
    { idiom: 'broaden my horizons', meaning: 'expand personal perspectives and cultural understanding' },
    { idiom: 'a double-edged sword', meaning: 'something having both advantages and disadvantages' },
  ];

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto pr-1 select-none text-xs space-y-4 pb-4">
      {/* Topic Keywords Header */}
      <div className="p-3 rounded-2xl bg-gradient-to-r from-teal-50 to-cyan-50 border border-teal-200">
        <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700 block mb-1">
          Active Scenario Keywords
        </span>
        <div className="flex flex-wrap gap-1.5">
          {(activeTopic?.targetKeywords || ['perspective', 'consequently', 'distinctive']).map((kw) => (
            <span
              key={kw}
              className="bg-white border border-teal-200 px-2 py-0.5 rounded-full font-bold text-teal-800 text-[11px]"
            >
              {kw}
            </span>
          ))}
        </div>
      </div>

      {/* Datamuse Collocations (0-Token) */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="font-bold text-slate-800 text-[11px] flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-teal-600" />
            Datamuse Natural Collocations (0-Token)
          </span>
          <span className="text-[10px] text-slate-400">Freq Score</span>
        </div>

        {loading ? (
          <div className="p-4 text-center text-slate-400">Loading collocations...</div>
        ) : collocations.length > 0 ? (
          <div className="space-y-1.5">
            {collocations.slice(0, 6).map((c, idx) => (
              <div
                key={c.phrase}
                className="p-2 rounded-xl border border-slate-200 bg-white hover:border-teal-300 transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-800">{c.phrase}</span>
                  <button
                    onClick={() => handlePlay(c.phrase)}
                    title="Listen pronunciation"
                    className="p-1 text-slate-400 hover:text-teal-600 rounded transition-colors"
                  >
                    <Volume2 className="w-3 h-3" />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono font-semibold text-slate-400">
                    {c.score}
                  </span>
                  <button
                    onClick={() => handleCopy(c.phrase, idx)}
                    title="Copy phrase"
                    className="p-1 text-slate-400 hover:text-slate-700 rounded transition-colors"
                  >
                    {copiedIndex === idx ? (
                      <Check className="w-3 h-3 text-emerald-600" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-slate-400 italic">No collocations available for this query.</p>
        )}
      </div>

      {/* Curated High-Band Idioms */}
      <div>
        <span className="font-bold text-slate-800 text-[11px] block mb-2 flex items-center gap-1.5">
          <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
          High-Yield Idiomatic Phrases (Band 8.0+)
        </span>
        <div className="space-y-1.5">
          {curatedIdioms.map((item) => (
            <div
              key={item.idiom}
              className="p-2.5 rounded-xl border border-slate-200 bg-white hover:border-teal-300 transition-all"
            >
              <div className="flex items-center justify-between mb-0.5">
                <span className="font-bold text-slate-900">{item.idiom}</span>
                <button
                  onClick={() => handlePlay(item.idiom)}
                  className="p-0.5 text-slate-400 hover:text-teal-600 rounded"
                >
                  <Volume2 className="w-3 h-3" />
                </button>
              </div>
              <p className="text-[10px] text-slate-500">{item.meaning}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Sample Band 8 Response */}
      <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
        <span className="font-bold text-slate-800 text-[11px] block mb-1">
          Sample Band 8.5 Response Model
        </span>
        <p className="text-slate-700 text-[11px] leading-relaxed italic">
          "If I recall correctly, what struck me most profoundly was not just the physical landscape,
          but the remarkable hospitality of the locals. It truly broadened my horizons in ways I had never anticipated."
        </p>
      </div>
    </div>
  );
};
