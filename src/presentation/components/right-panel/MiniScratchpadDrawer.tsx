import React, { useState } from 'react';
import {
  FileEdit,
  Sparkles,
  ChevronUp,
  ChevronDown,
  CheckCircle2,
  AlertTriangle,
  Languages,
  Loader2,
} from 'lucide-react';
import { container } from '../../../di/DIContainer';
import { GrammarCheckError } from '../../../domain/interfaces/IDictionaryGateway';
import { UpgradedExpressionResult } from '../../../domain/interfaces/IAIGateway';

export const MiniScratchpadDrawer: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [draftText, setDraftText] = useState('');
  const [grammarErrors, setGrammarErrors] = useState<GrammarCheckError[]>([]);
  const [translatedText, setTranslatedText] = useState<string>('');
  const [upgradedResult, setUpgradedResult] = useState<UpgradedExpressionResult | null>(null);
  const [isCheckingGrammar, setIsCheckingGrammar] = useState(false);
  const [isUpgrading, setIsUpgrading] = useState(false);

  const handleCheckGrammar = async () => {
    if (!draftText.trim()) return;
    setIsCheckingGrammar(true);
    setGrammarErrors([]);
    try {
      const errors = await container.dictionaryGateway.checkGrammar(draftText);
      setGrammarErrors(errors);
    } catch {
      // Safe ignore
    } finally {
      setIsCheckingGrammar(false);
    }
  };

  const handleTranslate = async () => {
    if (!draftText.trim()) return;
    try {
      const trans = await container.dictionaryGateway.translateText(draftText, 'en', 'vi');
      setTranslatedText(trans);
    } catch {
      // Safe ignore
    }
  };

  const handleBandUpgrade = async () => {
    if (!draftText.trim()) return;
    setIsUpgrading(true);
    setUpgradedResult(null);
    try {
      const res = await container.upgradeBandScoreUseCase.execute({
        sentence: draftText,
        currentBand: 5.5,
        targetBand: 8.5,
      });
      setUpgradedResult(res);
    } catch {
      // Safe ignore
    } finally {
      setIsUpgrading(false);
    }
  };

  return (
    <div className="border-t border-slate-200 bg-white rounded-b-2xl shadow-xs transition-all">
      {/* Header bar to toggle drawer */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <FileEdit className="w-3.5 h-3.5 text-teal-600" />
          <span>Mini Scratchpad & 0-Token Assistant</span>
          {grammarErrors.length > 0 && (
            <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.2 rounded-full font-bold">
              {grammarErrors.length} Issue{grammarErrors.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
        {isOpen ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronUp className="w-4 h-4 text-slate-400" />}
      </button>

      {/* Drawer Body */}
      {isOpen && (
        <div className="p-3 border-t border-slate-100 space-y-2.5 animate-in slide-in-from-bottom-2 text-xs">
          <textarea
            rows={3}
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            placeholder="Jot down speaking points or sentences to test before pressing Space..."
            className="w-full p-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-teal-500 text-xs resize-none"
          />

          {/* Quick 0-Token Action Buttons */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={handleCheckGrammar}
              disabled={isCheckingGrammar || !draftText.trim()}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-[11px] font-semibold text-slate-700 disabled:opacity-50"
            >
              {isCheckingGrammar ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
              <span>Check Grammar (0-Token)</span>
            </button>

            <button
              onClick={handleTranslate}
              disabled={!draftText.trim()}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-[11px] font-semibold text-slate-700 disabled:opacity-50"
            >
              <Languages className="w-3 h-3 text-cyan-600" />
              <span>Translate (GTX)</span>
            </button>

            <button
              onClick={handleBandUpgrade}
              disabled={isUpgrading || !draftText.trim()}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-[11px] font-bold shadow-2xs ml-auto disabled:opacity-50"
            >
              {isUpgrading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
              <span>AI Band Upgrade</span>
            </button>
          </div>

          {/* Grammar Errors Display */}
          {grammarErrors.length > 0 && (
            <div className="p-2.5 rounded-xl bg-red-50/80 border border-red-200 text-red-800 text-[11px] space-y-1">
              <span className="font-bold flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                LanguageTool Corrections:
              </span>
              {grammarErrors.map((err, i) => (
                <p key={i} className="pl-4">
                  • {err.message} {err.replacements.length > 0 && `(Suggestion: "${err.replacements.join('", "')}")`}
                </p>
              ))}
            </div>
          )}

          {/* Translation Output */}
          {translatedText && (
            <div className="p-2 rounded-xl bg-cyan-50/70 border border-cyan-200 text-cyan-900 text-[11px]">
              <span className="font-bold">Bản dịch: </span>
              {translatedText}
            </div>
          )}

          {/* Upgraded Sentence Result */}
          {upgradedResult && (
            <div className="p-3 rounded-xl bg-gradient-to-r from-teal-50 to-emerald-50 border border-teal-200 text-teal-950 text-[11px] space-y-1.5 animate-in fade-in">
              <div className="flex items-center justify-between">
                <span className="font-bold text-teal-800 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                  Band 8.5+ Native Upgrade:
                </span>
                <span className="bg-teal-600 text-white px-2 py-0.2 rounded-full font-bold text-[10px]">
                  Estimated Band {upgradedResult.estimatedBand.toString()}
                </span>
              </div>
              <p className="font-semibold text-slate-900 bg-white/80 p-2 rounded-lg border border-teal-100">
                "{upgradedResult.upgradedSentence}"
              </p>
              <p className="text-slate-600 text-[10px]">{upgradedResult.explanation}</p>
              {upgradedResult.nativeIdiomsUsed.length > 0 && (
                <div className="flex gap-1 flex-wrap pt-0.5">
                  <span className="text-slate-500 font-medium">Idioms used:</span>
                  {upgradedResult.nativeIdiomsUsed.map((idiom) => (
                    <span key={idiom} className="bg-white px-1.5 py-0.2 rounded border text-teal-800 font-mono text-[10px]">
                      {idiom}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
