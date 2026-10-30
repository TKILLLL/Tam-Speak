import React, { useState } from 'react';
import {
  Award,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  Info,
} from 'lucide-react';
import { useTamSpeakStore } from '../../store';
import { container } from '../../../di/DIContainer';
import { UserStorageService } from '../../../infrastructure/security/UserStorageService';

export const convertBandToCEFR = (band: number): 'a2' | 'b1' | 'b2' | 'c1' | 'c2' => {
  if (band < 4.0) return 'a2';
  if (band <= 5.0) return 'b1';
  if (band <= 6.5) return 'b2';
  if (band <= 8.0) return 'c1';
  return 'c2';
};

export const ScoringTab: React.FC = () => {
  const { activeSession, setActiveSession, dialogueTurns, activeTopic, user, setUser } = useTamSpeakStore();
  const [evaluating, setEvaluating] = useState(false);
  const [evaluationError, setEvaluationError] = useState<string | null>(null);
  const [evaluationData, setEvaluationData] = useState<{
    overallScore: number;
    pronunciationScore: number;
    fluencyScore: number;
    lexicalScore: number;
    grammarScore: number;
    wpm: number;
    hesitationCount: number;
    strengths: string[];
    weaknesses: string[];
  } | null>(
    activeSession?.overallScore
      ? {
          overallScore: activeSession.overallScore,
          pronunciationScore: activeSession.pronunciationScore ?? 0,
          fluencyScore: activeSession.fluencyScore ?? 0,
          lexicalScore: activeSession.lexicalScore ?? 0,
          grammarScore: activeSession.grammarScore ?? 0,
          wpm: activeSession.wordsPerMinute ?? 0,
          hesitationCount: activeSession.hesitationCount ?? 0,
          strengths: activeSession.detailedFeedback?.strengths ?? [],
          weaknesses: activeSession.detailedFeedback?.weaknesses ?? [],
        }
      : null
  );

  const userTurns = dialogueTurns.filter((d) => d.speaker === 'user');
  const totalUserWords = userTurns.reduce(
    (sum, d) => sum + (d.text ? d.text.trim().split(/\s+/).filter(Boolean).length : 0),
    0
  );
  const totalSpeechSeconds = userTurns.reduce(
    (sum, d) =>
      sum +
      (d.actualDurationSeconds && d.actualDurationSeconds > 0
        ? d.actualDurationSeconds
        : Math.max(1.5, d.text.split(' ').length * 0.45)),
    0
  );
  const realWpm = totalSpeechSeconds > 0 ? Math.round((totalUserWords / totalSpeechSeconds) * 60) : 0;
  // Use the actual marker list so SpeechMetrics receives a count that exactly
  // matches the pause durations passed below.
  const pauseDurations = userTurns.flatMap((turn) =>
    (turn.hesitationMarkers || [])
      .map((marker) => marker.durationSeconds)
      .filter((duration) => duration >= 0.8)
  );
  const totalHesitations = pauseDurations.length;
  const hasEnoughData = userTurns.length >= 3 || totalUserWords >= 15;

  const handleEvaluate = async () => {
    if (!hasEnoughData) {
      return;
    }

    setEvaluating(true);
    setEvaluationError(null);
    const sessionId = activeSession?.id || `sess-${Date.now()}`;
    try {
      const res = await container.evaluateSpeechUseCase.execute({
        sessionId,
        userId: user?.id || 'guest-user',
        durationSeconds: Math.max(15, Math.round(totalSpeechSeconds)),
        wpm: realWpm,
        hesitationCount: totalHesitations,
        silenceDurations: pauseDurations,
        contextTitle: activeTopic?.title || 'IELTS Speaking Practice',
        targetLevel: user?.currentLevel && user.currentLevel !== 'unrated' ? user.currentLevel : 'b2',
        dialogue: dialogueTurns,
      });

      if (
        res.overallScore == null ||
        res.pronunciationScore == null ||
        res.fluencyScore == null ||
        res.lexicalScore == null ||
        res.grammarScore == null ||
        !res.detailedFeedback
      ) {
        throw new Error('AI returned an incomplete scoring result.');
      }

      const evaluated = {
        overallScore: res.overallScore,
        pronunciationScore: res.pronunciationScore,
        fluencyScore: res.fluencyScore,
        lexicalScore: res.lexicalScore,
        grammarScore: res.grammarScore,
        wpm: res.wordsPerMinute,
        hesitationCount: res.hesitationCount,
        strengths: res.detailedFeedback.strengths,
        weaknesses: res.detailedFeedback.weaknesses,
      };

      setEvaluationData(evaluated);

      // Sync overall score and practice minutes to user profile and roadmap
      const newCefr = convertBandToCEFR(evaluated.overallScore);
      const sessionMinutes = Math.max(1, Math.round(totalSpeechSeconds / 60));
      if (user) {
        const updatedUser = {
          ...user,
          currentLevel: newCefr,
          totalPracticeMinutes: (user.totalPracticeMinutes || 0) + sessionMinutes,
        };
        setUser(updatedUser);
        try {
          UserStorageService.setUserProfile(updatedUser, user.id);
        } catch {
          // ignore
        }
      }

      if (activeSession) {
        setActiveSession({
          ...activeSession,
          overallScore: res.overallScore,
          pronunciationScore: res.pronunciationScore,
          fluencyScore: res.fluencyScore,
          lexicalScore: res.lexicalScore,
          grammarScore: res.grammarScore,
          wordsPerMinute: res.wordsPerMinute,
          hesitationCount: res.hesitationCount,
          detailedFeedback: res.detailedFeedback,
        });
      }
    } catch (error) {
      setEvaluationError((error as Error).message || 'AI scoring failed. Please try again.');
    } finally {
      setEvaluating(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 8.0) return 'text-emerald-600 bg-emerald-50 border-emerald-200';
    if (score >= 6.5) return 'text-teal-600 bg-teal-50 border-teal-200';
    if (score >= 5.5) return 'text-amber-600 bg-amber-50 border-amber-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto pr-1 select-none text-xs">
      {/* If No Score Yet */}
      {!evaluationData ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-600">
            <Award className="w-7 h-7 stroke-1.5" />
          </div>
          <div>
            <h4 className="font-bold text-sm text-slate-800">IELTS Official 4-Criterion Scoring</h4>
            <p className="text-[11px] text-slate-500 mt-1 max-w-xs leading-relaxed">
              Hệ thống đánh giá độ chuẩn xác phát âm, tốc độ nói (WPM), số lần ngập ngừng, vốn từ vựng và ngữ pháp.
            </p>
          </div>

          {/* Data Requirement Status Banner */}
          {!hasEnoughData ? (
            <div className="w-full max-w-xs p-3 rounded-2xl bg-amber-50/90 border border-amber-200 text-left space-y-2">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-amber-900 text-[11px]">Chưa đủ dữ liệu chấm điểm</p>
                  <p className="text-amber-700 text-[10px] mt-0.5 leading-tight">
                    Cần tối thiểu 3 lượt trả lời hoặc 15 từ để AI chấm điểm chuẩn xác theo chuẩn IELTS.
                  </p>
                </div>
              </div>

              {/* Progress Counters */}
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-amber-200/60 font-mono text-[11px]">
                <div className="bg-white/80 p-1.5 rounded-lg border border-amber-200/80">
                  <span className="text-[10px] text-slate-500 block">Lượt nói:</span>
                  <span className={`font-bold ${userTurns.length >= 3 ? 'text-emerald-700' : 'text-slate-800'}`}>
                    {userTurns.length} / 3 lượt
                  </span>
                </div>
                <div className="bg-white/80 p-1.5 rounded-lg border border-amber-200/80">
                  <span className="text-[10px] text-slate-500 block">Số từ:</span>
                  <span className={`font-bold ${totalUserWords >= 15 ? 'text-emerald-700' : 'text-slate-800'}`}>
                    {totalUserWords} / 15 từ
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="w-full max-w-xs p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-left flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <div className="text-[11px] text-emerald-800 font-medium">
                Đủ dữ liệu ({userTurns.length} lượt, {totalUserWords} từ, ~{realWpm} WPM). Sẵn sàng chấm điểm.
              </div>
            </div>
          )}

          {evaluationError && (
            <p className="text-[11px] text-rose-600 font-semibold">{evaluationError}</p>
          )}

          <button
            onClick={handleEvaluate}
            disabled={!hasEnoughData || evaluating}
            className={`py-2.5 px-6 rounded-xl font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-2 ${
              hasEnoughData && !evaluating
                ? 'bg-teal-600 hover:bg-teal-700 text-white hover:shadow cursor-pointer'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300'
            }`}
          >
            {evaluating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Đang phân tích chấm điểm...</span>
              </>
            ) : (
              <span>Chấm điểm bài nói</span>
            )}
          </button>
        </div>
      ) : (
        <div className="space-y-4 animate-in fade-in pb-4">
          {/* Overall Band Card */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-teal-500 via-teal-600 to-cyan-600 text-white shadow-sm flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold text-teal-100 uppercase tracking-wider block">
                Official IELTS Composite Band
              </span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-3xl font-black">{evaluationData.overallScore.toFixed(1)}</span>
                <span className="text-teal-200 text-xs font-medium">/ 9.0</span>
              </div>
              <span className="text-[10px] text-teal-100 mt-1 block">
                CEFR Equivalent: {evaluationData.overallScore >= 8 ? 'C1/C2 Advanced' : evaluationData.overallScore >= 6.5 ? 'B2 Upper-Intermediate' : 'B1 Intermediate'}
              </span>
            </div>

            <button
              onClick={handleEvaluate}
              disabled={evaluating}
              title="Re-evaluate"
              className="p-2 rounded-xl bg-white/20 hover:bg-white/30 text-white transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${evaluating ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* 4 Criteria Breakdown */}
          <div className="grid grid-cols-2 gap-2.5">
            {/* Pronunciation */}
            <div className="p-3 rounded-xl border border-slate-200 bg-white shadow-2xs">
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-slate-700 text-[11px]">Pronunciation</span>
                <span className={`px-2 py-0.2 rounded-full font-bold text-xs border ${getScoreColor(evaluationData.pronunciationScore)}`}>
                  {evaluationData.pronunciationScore.toFixed(1)}
                </span>
              </div>
              <p className="text-[10px] text-slate-500">Phonemic clarity & ending sounds</p>
            </div>

            {/* Fluency */}
            <div className="p-3 rounded-xl border border-slate-200 bg-white shadow-2xs">
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-slate-700 text-[11px]">Fluency & Pace</span>
                <span className={`px-2 py-0.2 rounded-full font-bold text-xs border ${getScoreColor(evaluationData.fluencyScore)}`}>
                  {evaluationData.fluencyScore.toFixed(1)}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
                <span>{evaluationData.wpm} WPM</span>
                <span>•</span>
                <span>{evaluationData.hesitationCount} pauses</span>
              </div>
            </div>

            {/* Lexical Resource */}
            <div className="p-3 rounded-xl border border-slate-200 bg-white shadow-2xs">
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-slate-700 text-[11px]">Lexical Resource</span>
                <span className={`px-2 py-0.2 rounded-full font-bold text-xs border ${getScoreColor(evaluationData.lexicalScore)}`}>
                  {evaluationData.lexicalScore.toFixed(1)}
                </span>
              </div>
              <p className="text-[10px] text-slate-500">Idiomatic range & collocations</p>
            </div>

            {/* Grammar */}
            <div className="p-3 rounded-xl border border-slate-200 bg-white shadow-2xs">
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-slate-700 text-[11px]">Grammar Range</span>
                <span className={`px-2 py-0.2 rounded-full font-bold text-xs border ${getScoreColor(evaluationData.grammarScore)}`}>
                  {evaluationData.grammarScore.toFixed(1)}
                </span>
              </div>
              <p className="text-[10px] text-slate-500">Complex sentence accuracy</p>
            </div>
          </div>

          {/* Color-Coded Word Analysis Legend */}
          <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/70">
            <span className="font-bold text-slate-700 block mb-1.5 text-[11px]">
              Word-by-Word Phonetic Analysis:
            </span>
            <div className="flex items-center gap-3 text-[10px]">
              <span className="flex items-center gap-1 font-medium text-emerald-700">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Accurate
              </span>
              <span className="flex items-center gap-1 font-medium text-amber-700">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                Stress Shift
              </span>
              <span className="flex items-center gap-1 font-medium text-red-700">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                Dropped Ending
              </span>
            </div>
          </div>

          {/* Strengths & Weaknesses */}
          <div className="space-y-2">
            <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 text-emerald-950">
              <span className="font-bold flex items-center gap-1.5 text-[11px] mb-1 text-emerald-800">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Key Strengths:
              </span>
              <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-emerald-900">
                {evaluationData.strengths.map((s, idx) => (
                  <li key={idx}>{s}</li>
                ))}
              </ul>
            </div>

            <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200 text-amber-950">
              <span className="font-bold flex items-center gap-1.5 text-[11px] mb-1 text-amber-800">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                Areas for Focus:
              </span>
              <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-amber-900">
                {evaluationData.weaknesses.map((w, idx) => (
                  <li key={idx}>{w}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
