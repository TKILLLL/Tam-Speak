import React, { useState, useEffect, useRef } from 'react';
import { Volume2, Bookmark, X, Loader2 } from 'lucide-react';
import { container } from '../../../di/DIContainer';
import { DictionaryEntry } from '../../../domain/interfaces/IDictionaryGateway';
import { useTamSpeakStore } from '../../store';
import { VocabularyItem } from '../../../domain/entities/VocabularyItem';

interface WordLookupTooltipProps {
  selectedText: string;
  position: { top: number; left: number };
  onClose: () => void;
}

export const WordLookupTooltip: React.FC<WordLookupTooltipProps> = ({
  selectedText,
  position,
  onClose,
}) => {
  const { user } = useTamSpeakStore();
  const [loading, setLoading] = useState(true);
  const [entry, setEntry] = useState<DictionaryEntry | null>(null);
  const [translatedText, setTranslatedText] = useState<string>('');
  const [saved, setSaved] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchWordInfo = async () => {
      setLoading(true);
      try {
        const cleaned = selectedText.trim().replace(/[^a-zA-Z-]/g, '');
        if (!cleaned) return;

        // Parallel 0-token lookups: Free Dictionary + GTX Translate
        const [dictData, translation] = await Promise.all([
          container.dictionaryGateway.lookupWord(cleaned),
          container.dictionaryGateway.translateText(cleaned, 'en', 'vi'),
        ]);

        if (isMounted) {
          setEntry(dictData);
          setTranslatedText(translation);
        }
      } catch {
        // Safe ignore
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchWordInfo();
    return () => {
      isMounted = false;
    };
  }, [selectedText]);

  const handlePlayAudio = () => {
    if (entry?.audioSampleUrl) {
      const audio = new Audio(entry.audioSampleUrl);
      audio.play().catch(() => {
        container.speechTTSEngine.speak(selectedText);
      });
    } else {
      container.speechTTSEngine.speak(selectedText);
    }
  };

  const handleSaveToVocabBank = async () => {
    if (!user || !entry) return;
    try {
      const firstMeaning = entry.meanings[0];
      await container.vocabRepository.save(
        VocabularyItem.create({
          id: `vocab-${Date.now()}`,
          userId: user.id,
          word: entry.word,
          ipa: entry.ipa,
          definitionEn: firstMeaning?.definition || 'Saved from transcript',
          definitionVi: translatedText,
          exampleSentence: firstMeaning?.example || null,
        })
      );
      setSaved(true);
    } catch {
      // Handled
    }
  };

  return (
    <div
      ref={tooltipRef}
      style={{
        top: `${Math.max(10, position.top - 120)}px`,
        left: `${Math.max(10, Math.min(window.innerWidth - 300, position.left - 130))}px`,
      }}
      className="fixed z-50 w-72 rounded-xl border border-slate-200 bg-white p-3.5 shadow-xl transition-all duration-150 animate-in fade-in zoom-in-95 text-left"
    >
      <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2">
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-900 text-sm">{selectedText}</span>
          {entry?.ipa && (
            <span className="text-xs font-mono text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded">
              {entry.ipa.toEnclosedString()}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handlePlayAudio}
            title="Listen native pronunciation (0-Token)"
            className="p-1 text-slate-500 hover:text-teal-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <Volume2 className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-4 text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : (
        <div className="space-y-1.5 text-xs">
          {translatedText && (
            <p className="font-medium text-slate-700">
              <span className="text-slate-400 font-normal">Dịch: </span>
              {translatedText}
            </p>
          )}

          {entry?.meanings[0] && (
            <p className="text-slate-600 line-clamp-2">
              <span className="text-slate-400 italic">({entry.meanings[0].partOfSpeech}) </span>
              {entry.meanings[0].definition}
            </p>
          )}

          <div className="pt-2 flex justify-end">
            <button
              onClick={handleSaveToVocabBank}
              disabled={saved}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                saved
                  ? 'bg-teal-50 text-teal-700 border border-teal-200 cursor-default'
                  : 'bg-slate-900 text-white hover:bg-slate-800'
              }`}
            >
              <Bookmark className="w-3 h-3" />
              {saved ? 'Saved in Bank' : 'Save Word'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
