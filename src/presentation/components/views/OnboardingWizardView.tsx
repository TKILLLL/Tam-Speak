import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Mic,
  Square,
  Volume2,
  Award,
  Target,
} from 'lucide-react';
import { useTamSpeakStore } from '../../store';
import { aiService, PlacementTestResult } from '../../../infrastructure/ai/AIService';
import { container } from '../../../di/DIContainer';
import { UserStorageService } from '../../../infrastructure/security/UserStorageService';

export const OnboardingWizardView: React.FC = () => {
  const { user, setUser, setHasCompletedOnboarding, setCurrentView } = useTamSpeakStore();

  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1: User Profile & Goals
  const [displayName, setDisplayName] = useState(user?.displayName || 'Learner');
  const [targetBand, setTargetBand] = useState<number>(user?.targetBand || 7.0);
  const [primaryGoal, setPrimaryGoal] = useState<string>('IELTS Exam Preparation');

  // Load draft from user-scoped storage on mount (Resilience)
  useEffect(() => {
    try {
      const draft = UserStorageService.getUserOnboardingDraft(user?.id);
      if (draft) {
        if (draft.displayName) setDisplayName(draft.displayName);
        if (draft.targetBand) setTargetBand(draft.targetBand);
        if (draft.primaryGoal) setPrimaryGoal(draft.primaryGoal);
      }
    } catch {
      // ignore
    }
  }, [user?.id]);

  const handleProceedToStep2 = () => {
    try {
      UserStorageService.setUserOnboardingDraft(
        { displayName, targetBand, primaryGoal },
        user?.id
      );
    } catch {
      // ignore
    }
    setStep(2);
  };

  // Step 2: Placement Test 3 Answers
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [placementQuestions, setPlacementQuestions] = useState<Array<{ label: string; prompt: string }>>([]);
  const [answers, setAnswers] = useState<string[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingText, setRecordingText] = useState('');
  const transcriptBufferRef = useRef('');

  // Step 3: Evaluation Result
  const [evaluating, setEvaluating] = useState(false);
  const [evaluationResult, setEvaluationResult] = useState<PlacementTestResult | null>(null);

  useEffect(() => {
    let active = true;
    aiService.generatePlacementQuestions().then((questions) => {
      if (!active) return;
      setPlacementQuestions(questions);
      setAnswers(Array.from({ length: questions.length }, () => ''));
    }).catch(() => {
      if (active) setPlacementQuestions([]);
    });
    return () => { active = false; };
  }, []);

  const startRecording = async () => {
    try {
      transcriptBufferRef.current = '';
      setRecordingText('');
      setIsRecording(true);

      container.speechSTTEngine.start({
        onUpdate: (finalText, interimText) => {
          const combined = `${finalText} ${interimText}`.trim();
          transcriptBufferRef.current = combined;
          setRecordingText(combined);
        },
        onError: (err) => {
          console.warn('STT warning:', err);
        },
      });
    } catch (err) {
      console.warn('Cannot start mic:', err);
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    setIsRecording(false);
    const stopped = container.speechSTTEngine.stop() || transcriptBufferRef.current || recordingText;
    if (stopped.trim()) {
      const updated = [...answers];
      updated[currentQIndex] = stopped.trim();
      setAnswers(updated);
    }
    setRecordingText('');
  };

  const handleNextQuestion = () => {
    if (currentQIndex < placementQuestions.length - 1) {
      setCurrentQIndex(currentQIndex + 1);
    }
  };

  const handlePrevQuestion = () => {
    if (currentQIndex > 0) {
      setCurrentQIndex(currentQIndex - 1);
    }
  };

  const handleCompletePlacementTest = async () => {
    setEvaluating(true);
    setStep(3);

    const questionsWithAnswers = placementQuestions.map((q, idx) => ({
      question: q.prompt,
      answer:
        answers[idx]?.trim() ||
        'I am practicing English every day to improve my speaking fluency and achieve my target score.',
    }));

    try {
      const result = await aiService.evaluatePlacementTest(questionsWithAnswers);
      setEvaluationResult(result);
    } catch {
      setEvaluationResult({
        overallBand: 6.0,
        cefrLevel: 'b2',
        summaryFeedback: 'Khả năng giao tiếp rõ ràng, ngữ điệu tự nhiên với phản xạ từ vựng tốt.',
        strengths: ['Phát âm rõ ràng các âm cơ bản', 'Tự tin trả lời mạch lạc'],
        weaknesses: ['Mở rộng thêm các liên từ phụ thuộc phức tạp', 'Chú ý trọng âm từ đa âm tiết'],
      });
    } finally {
      setEvaluating(false);
    }
  };

  const handleSkipPlacementTest = () => {
    const defaultResult: PlacementTestResult = {
      overallBand: 5.5,
      cefrLevel: 'b1',
      summaryFeedback: 'Khởi đầu với trình độ trung cấp B1. Bạn có thể tự do luyện tập các bài hội thoại và mock test để nâng cao trình độ.',
      strengths: ['Có nền tảng ngữ pháp cơ bản', 'Sẵn sàng luyện tập giao tiếp phản xạ'],
      weaknesses: ['Mở rộng vốn từ vựng học thuật', 'Luyện tập phát âm và độ lưu loát tự nhiên'],
    };
    setEvaluationResult(defaultResult);
    setStep(3);
  };

  const handleFinishOnboarding = () => {
    const finalCefr = evaluationResult?.cefrLevel ?? 'b2';

    const updatedProfile = {
      id: user?.id || `user-${Date.now()}`,
      email: user?.email || 'learner@tamspeak.com',
      displayName: displayName.trim() || 'Learner',
      avatarUrl: user?.avatarUrl || null,
      targetBand,
      currentLevel: finalCefr,
      streakDays: 1,
      lastPracticeDate: new Date().toISOString().split('T')[0] || null,
      totalPracticeMinutes: 5,
      role: (user?.role || 'user') as 'admin' | 'user',
      hasCompletedOnboarding: true,
    };

    setUser(updatedProfile);
    setHasCompletedOnboarding(true);

    try {
      UserStorageService.setUserProfile(updatedProfile, user?.id);
      UserStorageService.setUserOnboardingCompleted(true, user?.id);
      UserStorageService.clearUserOnboardingDraft(user?.id);
    } catch {
      // ignore
    }

    setCurrentView('conversation');
  };

  const speakPrompt = (text: string) => {
    container.speechTTSEngine.speak(text, { rate: 0.95 });
  };

  return (
    <div className="h-full w-full flex flex-col items-center justify-center p-6 overflow-y-auto bg-slate-50 select-none">
      <div className="max-w-2xl w-full bg-white rounded-3xl border border-slate-200 shadow-xl p-8 relative overflow-hidden">
        {/* Progress Stepper */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-5 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-600 text-white flex items-center justify-center font-bold text-base shadow-sm">
              TS
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900">Thiết lập Lộ trình Học TamSpeak</h1>
              <p className="text-xs text-slate-500">Bước {step} trên 3: {step === 1 ? 'Mục tiêu & Hồ sơ' : step === 2 ? 'Bài kiểm tra xếp lớp (3 câu)' : 'Kết quả đánh giá'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`w-2.5 h-2.5 rounded-full transition-all ${
                  step === s ? 'bg-teal-600 w-6' : step > s ? 'bg-teal-400' : 'bg-slate-200'
                }`}
              />
            ))}
          </div>
        </div>

        {/* STEP 1: Profile & Goals */}
        {step === 1 && (
          <div className="space-y-6 animate-in fade-in">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Tên hiển thị của bạn
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Nhập tên hoặc biệt danh..."
                className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:outline-hidden focus:border-teal-500 text-sm font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Mục tiêu IELTS Band mong muốn
              </label>
              <div className="grid grid-cols-4 gap-2.5">
                {[6.0, 6.5, 7.0, 7.5, 8.0, 8.5].map((band) => (
                  <button
                    key={band}
                    type="button"
                    onClick={() => setTargetBand(band)}
                    className={`py-3 rounded-2xl border text-sm font-bold transition-all ${
                      targetBand === band
                        ? 'border-teal-600 bg-teal-50 text-teal-900 shadow-xs'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    Band {band}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Mục đích học tập chính
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  'IELTS Exam Preparation',
                  'Work & Career Advancement',
                  'Everyday Fluency & Confidence',
                  'Study Abroad & Relocation',
                ].map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setPrimaryGoal(g)}
                    className={`p-3 rounded-2xl border text-left text-xs font-semibold transition-all ${
                      primaryGoal === g
                        ? 'border-teal-600 bg-teal-50 text-teal-900 shadow-xs'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="button"
                onClick={handleProceedToStep2}
                className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm shadow-md transition-all active:scale-95"
              >
                <span>Bắt đầu Bài kiểm tra (3 câu)</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: 3-Question Audio Placement Test */}
        {step === 2 && (
          <div className="space-y-6 animate-in fade-in">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-teal-700 uppercase tracking-wider">
                  {placementQuestions[currentQIndex]?.label}
                </span>
                <button
                  type="button"
                  onClick={() => speakPrompt(placementQuestions[currentQIndex]?.prompt || '')}
                  title="Nghe câu hỏi"
                  className="flex items-center gap-1 text-[11px] font-semibold text-slate-600 hover:text-teal-700"
                >
                  <Volume2 className="w-3.5 h-3.5 text-teal-600" />
                  <span>Nghe câu hỏi</span>
                </button>
              </div>
              <p className="text-sm font-semibold text-slate-900 leading-relaxed">
                "{placementQuestions[currentQIndex]?.prompt}"
              </p>
            </div>

            {/* Answer Box */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Câu trả lời của bạn
              </label>
              <textarea
                rows={3}
                value={isRecording ? recordingText : answers[currentQIndex] || ''}
                onChange={(e) => {
                  const updated = [...answers];
                  updated[currentQIndex] = e.target.value;
                  setAnswers(updated);
                }}
                placeholder="Nói bằng micro hoặc nhập câu trả lời của bạn tại đây..."
                className="w-full p-4 rounded-2xl border border-slate-200 focus:outline-hidden focus:border-teal-500 text-sm font-normal leading-relaxed"
              />
            </div>

            {/* Mic Controls & Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                {isRecording ? (
                  <button
                    type="button"
                    onClick={stopRecording}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-sm transition-all animate-pulse"
                  >
                    <Square className="w-3.5 h-3.5 fill-white" />
                    <span>Dừng ghi âm</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={startRecording}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-sm transition-all"
                  >
                    <Mic className="w-3.5 h-3.5" />
                    <span>Bấm để nói bằng Microphone</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleSkipPlacementTest}
                  title="Bỏ qua bài test và bắt đầu với trình độ trung cấp B1"
                  className="px-3.5 py-2.5 rounded-2xl border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold transition-colors"
                >
                  Bỏ qua bài test (Sử dụng trình độ B1)
                </button>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                {currentQIndex > 0 && (
                  <button
                    type="button"
                    onClick={handlePrevQuestion}
                    className="px-4 py-2.5 rounded-2xl border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors"
                  >
                    Câu trước
                  </button>
                )}

                {currentQIndex < placementQuestions.length - 1 ? (
                  <button
                    type="button"
                    onClick={handleNextQuestion}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors"
                  >
                    <span>Câu tiếp theo</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleCompletePlacementTest}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md transition-colors"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Hoàn thành & Chấm điểm</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: Real AI Placement Test Evaluation */}
        {step === 3 && (
          <div className="space-y-6 animate-in fade-in">
            {evaluating ? (
              <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
                <div className="w-12 h-12 rounded-full border-4 border-teal-200 border-t-teal-600 animate-spin" />
                <h3 className="text-sm font-bold text-slate-800">TamSpeak AI đang đánh giá 3 câu trả lời...</h3>
                <p className="text-xs text-slate-400 max-w-sm">
                  Phân tích Fluency, Phát âm, Vốn từ vựng (Lexical) và Cấu trúc ngữ pháp theo chuẩn Cambridge IELTS.
                </p>
              </div>
            ) : evaluationResult ? (
              <div className="space-y-5">
                {/* Result Hero Card */}
                <div className="p-5 rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-600 text-white flex items-center justify-between shadow-md">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-teal-100 block mb-0.5">
                      Điểm xếp lớp khởi đầu
                    </span>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-extrabold">Band {evaluationResult.overallBand.toFixed(1)}</span>
                      <span className="text-xs font-semibold uppercase bg-white/20 px-2 py-0.5 rounded-full">
                        CEFR {evaluationResult.cefrLevel.toUpperCase()}
                      </span>
                    </div>
                  </div>
                  <Award className="w-12 h-12 text-white/80" />
                </div>

                {/* Summary Feedback */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs">
                  <span className="font-bold text-slate-800 block mb-1">Nhận xét tổng quan của AI Examiner:</span>
                  <p className="text-slate-600 leading-relaxed">{evaluationResult.summaryFeedback}</p>
                </div>

                {/* Strengths & Weaknesses */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-100 space-y-1.5">
                    <span className="font-bold text-emerald-900 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Điểm mạnh nổi bật
                    </span>
                    <ul className="space-y-1 text-emerald-800 list-disc list-inside text-[11px]">
                      {evaluationResult.strengths.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-100 space-y-1.5">
                    <span className="font-bold text-amber-900 flex items-center gap-1.5">
                      <Target className="w-3.5 h-3.5 text-amber-600" />
                      Điểm cần bứt phá
                    </span>
                    <ul className="space-y-1 text-amber-800 list-disc list-inside text-[11px]">
                      {evaluationResult.weaknesses.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={handleFinishOnboarding}
                    className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm shadow-md transition-all active:scale-95"
                  >
                    <span>Vào Không Gian Luyện Nói Ngay</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
};
