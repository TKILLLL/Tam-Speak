import React, { useState } from 'react';
import {
  Database,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { container } from '../../../di/DIContainer';
import { IngestionResult } from '../../../infrastructure/ingestion/RawDataIngestionService';

export const RawDataStudioView: React.FC = () => {
  const [targetType, setTargetType] = useState<'md_questions' | 'csv_questions' | 'cmu_lexicon'>('md_questions');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<IngestionResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const sampleMarkdown = `# Accommodation and Housing
- What kind of housing do you live in? [apartment, suburban, spacious]
- Do you plan to move to a different home in the future? [relocate, countryside]
- What do you like most about your room? [sunlight, cozy, minimalist]

# Environmental Protection
- What environmental issues are most serious in your country? [pollution, emissions]
- How can individuals reduce their plastic waste? [reusable, biodegradable]`;

  const sampleCSV = `category,topic,part,questionText,targetKeywords
ielts_part1,Technology & Daily Life,1,How often do you use your smartphone?,essential;connectivity
ielts_part1,Technology & Daily Life,1,Do you prefer reading physical books or e-books?,tactile;convenience
ielts_part2,Memorable Journey,2,Describe a road trip or holiday you enjoyed,breathtaking;scenic;memorable`;

  const handleLoadSample = () => {
    if (targetType === 'md_questions') {
      setContent(sampleMarkdown);
    } else if (targetType === 'csv_questions') {
      setContent(sampleCSV);
    }
  };

  const handleIngest = async () => {
    if (!content.trim()) return;
    setLoading(true);
    setResult(null);
    setErrorMsg(null);

    try {
      if (targetType === 'cmu_lexicon') {
        const parsed = JSON.parse(content);
        const res = await container.importRawDataUseCase.execute({
          format: 'cmu_lexicon',
          rawContent: parsed,
        });
        setResult(res);
      } else {
        const res = await container.importRawDataUseCase.execute({
          format: targetType,
          rawContent: content,
          category: 'ielts_part1',
        });
        setResult(res);
      }
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 p-6 md:p-8 overflow-y-auto bg-slate-50 select-none">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
            Raw Data Studio
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Ingest external Question Banks, Markdown study lists, and CMUdict phonetic lexicons into offline IndexedDB.
          </p>
        </div>

        {/* Target Select */}
        <div className="p-4 rounded-3xl border border-slate-200 bg-white shadow-xs space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1.5">
              Select Ingestion Target & Format
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  setTargetType('md_questions');
                  setResult(null);
                }}
                className={`p-3 rounded-2xl border text-left transition-all ${
                  targetType === 'md_questions'
                    ? 'border-teal-500 bg-teal-50/60 ring-1 ring-teal-500/20'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span className="font-bold text-slate-900 block mb-0.5">Markdown (.md)</span>
                <span className="text-[10px] text-slate-500">
                  Headers as Topics & bullet questions [keywords]
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setTargetType('csv_questions');
                  setResult(null);
                }}
                className={`p-3 rounded-2xl border text-left transition-all ${
                  targetType === 'csv_questions'
                    ? 'border-teal-500 bg-teal-50/60 ring-1 ring-teal-500/20'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span className="font-bold text-slate-900 block mb-0.5">CSV File (.csv)</span>
                <span className="text-[10px] text-slate-500">
                  Structured columns with formula injection defense
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setTargetType('cmu_lexicon');
                  setResult(null);
                }}
                className={`p-3 rounded-2xl border text-left transition-all ${
                  targetType === 'cmu_lexicon'
                    ? 'border-teal-500 bg-teal-50/60 ring-1 ring-teal-500/20'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span className="font-bold text-slate-900 block mb-0.5">CMUdict JSON</span>
                <span className="text-[10px] text-slate-500">
                  130,000 Offline IPA words (0-Token, 0ms)
                </span>
              </button>
            </div>
          </div>

          {/* Text Editor / Paste Box */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="font-bold text-slate-700">Paste Data Content (Max 5MB)</label>
              <button
                type="button"
                onClick={handleLoadSample}
                className="text-[11px] text-teal-700 hover:text-teal-800 font-semibold"
              >
                Fill Sample Data
              </button>
            </div>
            <textarea
              rows={8}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Paste Markdown questions, CSV lines, or CMUdict JSON here..."
              className="w-full p-3 rounded-xl border border-slate-300 font-mono text-xs focus:ring-2 focus:ring-teal-500 resize-none"
            />
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-[10px] text-slate-400">
              Sanitized against XSS, Prototype Pollution, and CSV Formula Injection.
            </span>
            <button
              onClick={handleIngest}
              disabled={loading || !content.trim()}
              className="py-2.5 px-6 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-xs hover:shadow transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Database className="w-3.5 h-3.5" />
                  <span>Ingest Into Offline Dexie</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Results Badge */}
        {result && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs space-y-1 animate-in fade-in">
            <div className="flex items-center gap-2 font-bold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Ingestion Complete!</span>
            </div>
            <p className="text-[11px]">
              Successfully parsed and committed <strong>{result.successCount}</strong> records to local IndexedDB.
            </p>
          </div>
        )}

        {errorMsg && (
          <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-900 text-xs flex items-center gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-red-600" />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>
    </div>
  );
};
