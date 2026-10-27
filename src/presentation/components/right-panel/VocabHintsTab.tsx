import React, { useState, useEffect } from 'react';
import { Volume2, Copy, Check, Lightbulb, BookOpen } from 'lucide-react';
import { useTamSpeakStore } from '../../store';
import { container } from '../../../di/DIContainer';
import { CollocationSuggestion } from '../../../domain/interfaces/IDictionaryGateway';

interface CuratedIdiom {
  idiom: string;
  ipa: string;
  meaningEn: string;
  meaningVn: string;
}

const TOPIC_IDIOMS: Record<string, CuratedIdiom[]> = {
  technology: [
    { idiom: 'at the cutting edge', ipa: '/æt ðə ˈkʌtɪŋ edʒ/', meaningEn: 'at the forefront of innovation', meaningVn: 'ở đỉnh cao công nghệ tiên tiến' },
    { idiom: 'game-changer', ipa: '/ˈɡeɪmˌtʃeɪndʒər/', meaningEn: 'a newly introduced element that changes everything', meaningVn: 'bước ngoặt đột phá thay đổi cục diện' },
    { idiom: 'state of the art', ipa: '/steɪt əv ði ɑːrt/', meaningEn: 'using the most recent ideas and materials', meaningVn: 'hiện đại bậc nhất' },
    { idiom: 'pave the way', ipa: '/peɪv ðə weɪ/', meaningEn: 'create the conditions for future development', meaningVn: 'mở đường cho sự phát triển mới' },
  ],
  hometown: [
    { idiom: 'down memory lane', ipa: '/daʊn ˈmeməri leɪn/', meaningEn: 'remembering happy events from the past', meaningVn: 'hồi tưởng lại miền ký ức xưa' },
    { idiom: 'hustle and bustle', ipa: '/ˈhʌsl ənd ˈbʌsl/', meaningEn: 'busy, noisy activity of city life', meaningVn: 'sự hối hả và nhộn nhịp của phố thị' },
    { idiom: 'close-knit community', ipa: '/ˌkloʊsˈnɪt kəˈmjuːnəti/', meaningEn: 'a tightly united and supportive group of people', meaningVn: 'cộng đồng đoàn kết, gắn bó khăng khít' },
    { idiom: 'heart of the city', ipa: '/hɑːrt əv ðə ˈsɪti/', meaningEn: 'the central, most vibrant area', meaningVn: 'trung tâm sầm uất nhất' },
  ],
  environment: [
    { idiom: 'carbon footprint', ipa: '/ˈkɑːrbən ˈfʊtprɪnt/', meaningEn: 'the amount of greenhouse gas produced', meaningVn: 'dấu chân carbon / lượng khí thải' },
    { idiom: 'tip of the iceberg', ipa: '/tɪp əv ði ˈaɪsbɜːrɡ/', meaningEn: 'a small evident part of a larger issue', meaningVn: 'phần nổi của tảng băng chìm' },
    { idiom: 'irreversible damage', ipa: '/ˌɪrɪˈvɜːrsəbl ˈdæmɪdʒ/', meaningEn: 'harm that cannot be repaired or undone', meaningVn: 'tổn hại không thể đảo ngược' },
    { idiom: 'eco-friendly alternatives', ipa: '/ˈiːkoʊ ˌfrendli ɔːlˈtɜːrnətɪvz/', meaningEn: 'sustainable choices not harmful to nature', meaningVn: 'giải pháp thân thiện với môi trường' },
  ],
  work: [
    { idiom: 'climb the corporate ladder', ipa: '/klaɪm ðə ˈkɔːrpərət ˈlædər/', meaningEn: 'advance professionally to senior roles', meaningVn: 'thăng tiến nấc thang sự nghiệp' },
    { idiom: 'hit the ground running', ipa: '/hɪt ðə ɡraʊnd ˈrʌnɪŋ/', meaningEn: 'start immediately with speed and enthusiasm', meaningVn: 'bắt nhịp công việc cực kỳ nhanh chóng' },
    { idiom: 'burn the midnight oil', ipa: '/bɜːrn ðə ˈmɪdnaɪt ɔɪl/', meaningEn: 'work or study late into the night', meaningVn: 'thức khuya miệt mài làm việc' },
    { idiom: 'think outside the box', ipa: '/θɪŋk ˌaʊtˈsaɪd ðə bɑːks/', meaningEn: 'think creatively and unconventionally', meaningVn: 'tư duy đột phá, sáng tạo' },
  ],
  society: [
    { idiom: 'double-edged sword', ipa: '/ˌdʌbl edʒd sɔːrd/', meaningEn: 'something that has both benefits and drawbacks', meaningVn: 'con dao hai lưỡi' },
    { idiom: 'part and parcel', ipa: '/pɑːrt ənd ˈpɑːrsl/', meaningEn: 'an essential or integral component', meaningVn: 'yếu tố thiết yếu, không thể tách rời' },
    { idiom: 'food for thought', ipa: '/fuːd fər θɔːt/', meaningEn: 'an idea that makes you think carefully', meaningVn: 'điều đáng để suy ngẫm sâu sắc' },
    { idiom: 'broaden one\'s horizon', ipa: '/ˈbrɔːdn wʌnz həˈraɪzn/', meaningEn: 'expand range of knowledge and experience', meaningVn: 'mở rộng tầm nhìn và hiểu biết' },
  ],
};

export const VocabHintsTab: React.FC = () => {
  const { activeTopic, dialogueTurns } = useTamSpeakStore();
  const [collocations, setCollocations] = useState<CollocationSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [activeIdiomDetails, setActiveIdiomDetails] = useState<string | null>(null);

  const lastAiTurn = [...dialogueTurns].reverse().find((t) => t.speaker === 'ai');
  const contextText = `${activeTopic?.title || ''} ${activeTopic?.description || ''} ${lastAiTurn?.text || ''}`.toLowerCase();

  const getTopicCategory = (): 'technology' | 'hometown' | 'environment' | 'work' | 'society' => {
    if (contextText.includes('tech') || contextText.includes('ai') || contextText.includes('computer') || contextText.includes('digital') || contextText.includes('internet')) {
      return 'technology';
    }
    if (contextText.includes('home') || contextText.includes('city') || contextText.includes('country') || contextText.includes('neighborhood') || contextText.includes('childhood') || contextText.includes('place')) {
      return 'hometown';
    }
    if (contextText.includes('environment') || contextText.includes('climate') || contextText.includes('nature') || contextText.includes('green') || contextText.includes('pollution')) {
      return 'environment';
    }
    if (contextText.includes('work') || contextText.includes('job') || contextText.includes('career') || contextText.includes('business') || contextText.includes('meeting') || contextText.includes('office')) {
      return 'work';
    }
    return 'society';
  };

  const topicCategory = getTopicCategory();
  const currentIdioms = TOPIC_IDIOMS[topicCategory] || TOPIC_IDIOMS.society;

  useEffect(() => {
    let isMounted = true;
    const fetchHints = async () => {
      setLoading(true);
      try {
        let keyword = 'perspective';
        if (activeTopic?.targetKeywords && activeTopic.targetKeywords.length > 0) {
          keyword = activeTopic.targetKeywords[0];
        } else if (topicCategory === 'technology') {
          keyword = 'technology';
        } else if (topicCategory === 'hometown') {
          keyword = 'hometown';
        } else if (topicCategory === 'environment') {
          keyword = 'environment';
        } else if (topicCategory === 'work') {
          keyword = 'career';
        }

        const suggestions = await container.dictionaryGateway.getCollocations(keyword);
        if (isMounted) {
          setCollocations(suggestions);
        }
      } catch {
        // Safe fallback
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchHints();
    return () => {
      isMounted = false;
    };
  }, [activeTopic, topicCategory]);

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handlePlay = (text: string) => {
    container.speechTTSEngine.speak(text);
  };

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
            <BookOpen className="w-3.5 h-3.5 text-teal-600" />
            Natural Collocations (Datamuse 0-Token)
          </span>
          <span className="text-[10px] text-slate-400">Score</span>
        </div>

        {loading ? (
          <div className="p-4 text-center text-slate-400">Loading collocations...</div>
        ) : collocations.length > 0 ? (
          <div className="space-y-1.5">
            {collocations.slice(0, 6).map((c, idx) => (
              <div
                key={c.phrase}
                onClick={() => handlePlay(c.phrase)}
                className="p-2 rounded-xl border border-slate-200 bg-white hover:border-teal-300 hover:bg-teal-50/20 cursor-pointer transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-800 group-hover:text-teal-900">{c.phrase}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePlay(c.phrase);
                    }}
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
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCopy(c.phrase, idx);
                    }}
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
        <div className="flex items-center justify-between mb-2">
          <span className="font-bold text-slate-800 text-[11px] flex items-center gap-1.5">
            <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
            Topic-Specific Idioms ({topicCategory.toUpperCase()})
          </span>
          <span className="text-[10px] text-teal-600 font-semibold capitalize">{topicCategory}</span>
        </div>

        <div className="space-y-1.5">
          {currentIdioms.map((item) => {
            const isExpanded = activeIdiomDetails === item.idiom;
            return (
              <div
                key={item.idiom}
                onClick={() => {
                  handlePlay(item.idiom);
                  setActiveIdiomDetails(isExpanded ? null : item.idiom);
                }}
                className="p-2.5 rounded-xl border border-slate-200 bg-white hover:border-teal-300 hover:bg-teal-50/20 cursor-pointer transition-all"
              >
                <div className="flex items-center justify-between mb-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">{item.idiom}</span>
                    <span className="font-mono text-[10px] text-teal-700 font-bold bg-teal-50 px-1 rounded">
                      {item.ipa}
                    </span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePlay(item.idiom);
                    }}
                    className="p-1 text-slate-400 hover:text-teal-600 rounded"
                  >
                    <Volume2 className="w-3 h-3" />
                  </button>
                </div>
                <p className="text-[10px] text-slate-500">{item.meaningEn}</p>
                <p className="text-[10px] text-teal-700 font-medium mt-0.5">{item.meaningVn}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sample Band 8 Response */}
      <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
        <span className="font-bold text-slate-800 text-[11px] block mb-1">
          Sample High-Band Phrasing
        </span>
        <p className="text-slate-700 text-[11px] leading-relaxed italic">
          "If I recall correctly, what struck me most profoundly was not just the physical landscape,
          but the remarkable hospitality of the locals. It truly broadened my horizons in ways I had never anticipated."
        </p>
      </div>
    </div>
  );
};
