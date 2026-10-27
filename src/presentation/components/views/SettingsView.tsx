import React, { useState, useEffect } from 'react';
import {
  Volume2,
  Trash2,
  CheckCircle2,
  Cpu,
  Key,
  Eye,
  EyeOff,
  Zap,
  Save,
  Sparkles,
  Sliders,
} from 'lucide-react';
import { useTamSpeakStore } from '../../store';
import { container } from '../../../di/DIContainer';
import { GEMINI_MODELS_FALLBACK_CHAIN } from '../../../infrastructure/ai/AIService';

export const SettingsView: React.FC = () => {
  const {
    activeAIVoice,
    setActiveAIVoice,
    activeAIProvider,
    setActiveAIProvider,
    feedbackLanguage,
    setFeedbackLanguage,
    practiceMode,
    setPracticeMode,
    targetLevel,
    setTargetLevel,
  } = useTamSpeakStore();

  // 1. Google Gemini BYOK State
  const [geminiKey, setGeminiKey] = useState('');
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [geminiTestStatus, setGeminiTestStatus] = useState<{
    state: 'idle' | 'testing' | 'valid' | 'invalid';
    message?: string;
  }>({ state: 'idle' });

  // 2. TTS Voice List & Mapping State
  const [availableSystemVoices, setAvailableSystemVoices] = useState<
    Array<{ id: string; name: string; lang: string }>
  >([]);

  // 3. Vault & General Settings State
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Load existing settings from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      // Load unified settings bundle
      const savedBundle = window.localStorage.getItem('tamspeak_settings');
      if (savedBundle) {
        try {
          const parsed = JSON.parse(savedBundle);
          if (parsed.activeVoice) setActiveAIVoice(parsed.activeVoice);
          if (parsed.activeAIProvider) setActiveAIProvider(parsed.activeAIProvider);
          if (parsed.feedbackLanguage) setFeedbackLanguage(parsed.feedbackLanguage);
          if (parsed.practiceMode) setPracticeMode(parsed.practiceMode);
          if (parsed.targetLevel) setTargetLevel(parsed.targetLevel);
        } catch {
          // ignore
        }
      }

      // Load Gemini API Key
      const savedGemini = window.localStorage.getItem('tamspeak_byok_gemini');
      if (savedGemini) {
        setGeminiKey(savedGemini);
        container.aiGateway.setPersonalKey?.('gemini', savedGemini);
      }
    }
  }, [setActiveAIProvider, setActiveAIVoice, setFeedbackLanguage, setPracticeMode, setTargetLevel]);

  // Subscribe to system voices loaded event
  useEffect(() => {
    const updateVoices = () => {
      const voices = container.speechTTSEngine.getVoices();
      setAvailableSystemVoices(
        voices.map((v) => ({ id: v.id, name: v.name, lang: v.lang }))
      );
    };

    updateVoices();
    const unsubscribe = container.speechTTSEngine.subscribeVoicesLoaded(updateVoices);
    return () => unsubscribe();
  }, []);

  // --- Gemini API Key Handlers ---
  const handleTestGemini = async () => {
    if (!geminiKey.trim()) {
      setGeminiTestStatus({ state: 'invalid', message: 'Vui lòng nhập API Key trước khi kiểm tra.' });
      return;
    }

    setGeminiTestStatus({ state: 'testing', message: 'Đang gửi ping kiểm tra đến Google Gemini API qua Header X-goog-api-key...' });
    try {
      // Test using Google REST standard with X-goog-api-key Header
      const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models', {
        headers: {
          'X-goog-api-key': geminiKey.trim(),
        },
      });

      if (response.ok) {
        const trimmedKey = geminiKey.trim();
        window.localStorage.setItem('tamspeak_byok_gemini', trimmedKey);
        container.aiGateway.setPersonalKey?.('gemini', trimmedKey);

        setGeminiTestStatus({
          state: 'valid',
          message: 'Valid API Key! Đã xác thực thành công và lưu vào Local Vault.',
        });
        setStatusMessage('Đã tự động lưu Google Gemini API Key cá nhân vào Local Vault của bạn!');
        setTimeout(() => setStatusMessage(null), 3500);
      } else {
        const errorData = await response.json().catch(() => ({}));
        setGeminiTestStatus({
          state: 'invalid',
          message: `Lỗi (${response.status}): ${
            errorData?.error?.message || 'API Key không hợp lệ hoặc chưa được kích hoạt Generative Language API.'
          }`,
        });
      }
    } catch (err: any) {
      setGeminiTestStatus({
        state: 'invalid',
        message: `Lỗi kết nối mạng: ${err?.message || 'Không thể ping đến Gemini API.'}`,
      });
    }
  };

  const handleSaveAllSettings = () => {
    const trimmedKey = geminiKey.trim();
    if (trimmedKey) {
      window.localStorage.setItem('tamspeak_byok_gemini', trimmedKey);
      container.aiGateway.setPersonalKey?.('gemini', trimmedKey);
    }

    const settingsBundle = {
      geminiKey: trimmedKey,
      activeVoice: activeAIVoice,
      activeAIProvider,
      feedbackLanguage,
      practiceMode,
      targetLevel,
      updatedAt: new Date().toISOString(),
    };

    window.localStorage.setItem('tamspeak_settings', JSON.stringify(settingsBundle));
    setStatusMessage('Đã lưu toàn bộ cấu hình cài đặt vào bộ nhớ thiết bị thành công!');
    setTimeout(() => setStatusMessage(null), 3500);
  };

  const handleClearGemini = () => {
    window.localStorage.removeItem('tamspeak_byok_gemini');
    container.aiGateway.setPersonalKey?.('gemini', null);
    setGeminiKey('');
    setGeminiTestStatus({ state: 'idle' });
    setStatusMessage('Đã xóa Gemini Key cá nhân. Hệ thống quay về hạn mức mặc định.');
    setTimeout(() => setStatusMessage(null), 3500);
  };

  // --- Voice Handlers ---
  const handlePreviewVoice = (persona: string) => {
    container.speechTTSEngine.previewVoice(persona);
  };

  const handleSelectVoicePersona = (persona: string) => {
    setActiveAIVoice(persona);
    container.speechTTSEngine.setActivePersona(persona);
    container.speechTTSEngine.previewVoice(persona);
  };

  const handleVoiceOverrideChange = (persona: string, voiceName: string) => {
    container.speechTTSEngine.setManualVoiceOverride(persona, voiceName);
    setStatusMessage(`Đã gắn giọng "${voiceName}" cho persona ${persona}`);
    setTimeout(() => setStatusMessage(null), 3000);
  };

  return (
    <div className="flex-1 p-6 md:p-8 overflow-y-auto bg-slate-50 select-none">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <span>Cài Đặt Hệ Thống & Giọng Nói</span>
              <span className="text-[11px] bg-teal-100 text-teal-800 font-bold px-2 py-0.5 rounded-full">
                Google Gemini Native
              </span>
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Quản lý API Key cá nhân, tinh chỉnh giọng đọc phản xạ và chế độ học tập.
            </p>
          </div>

          <button
            type="button"
            onClick={handleSaveAllSettings}
            className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-md transition-all active:scale-95"
          >
            <Save className="w-4 h-4" />
            <span>Lưu Toàn Bộ Cài Đặt</span>
          </button>
        </div>

        {statusMessage && (
          <div className="p-3.5 rounded-2xl bg-teal-50 border border-teal-200 text-teal-900 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}

        {/* ======================================================== */}
        {/* 1. PERSONAL API KEY CONFIGURATION (BYOK) - GOOGLE GEMINI */}
        {/* ======================================================== */}
        <div className="p-6 rounded-3xl border-2 border-teal-200/90 bg-white shadow-md space-y-5">
          <div className="flex items-start justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-xs">
                <Key className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span>Google Gemini API Key (Bring Your Own Key)</span>
                  <span className="text-[10px] bg-amber-100 text-amber-800 font-extrabold px-2 py-0.5 rounded-full">
                    Khuyên Dùng
                  </span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Hệ thống kết nối trực tiếp đến Google Generative Language API qua Header X-goog-api-key (Hỗ trợ mọi định dạng Key).
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3 p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-teal-600" />
                <label className="text-xs font-bold text-slate-800">
                  Gemini API Key cá nhân
                </label>
              </div>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-teal-700 font-bold hover:underline"
              >
                Lấy Key miễn phí tại Google AI Studio ↗
              </a>
            </div>

            <div className="relative">
              <input
                type={showGeminiKey ? 'text' : 'password'}
                value={geminiKey}
                onChange={(e) => {
                  const val = e.target.value;
                  setGeminiKey(val);
                  setGeminiTestStatus({ state: 'idle' });
                }}
                placeholder="Nhập API Key Gemini của bạn..."
                className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-slate-300 font-mono text-xs focus:outline-hidden focus:ring-2 focus:ring-teal-500 bg-white"
              />
              <button
                type="button"
                onClick={() => setShowGeminiKey(!showGeminiKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showGeminiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Test Status Feedback */}
            {geminiTestStatus.state !== 'idle' && (
              <div
                className={`text-[11px] font-semibold p-2.5 rounded-xl flex items-center gap-1.5 ${
                  geminiTestStatus.state === 'valid'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : geminiTestStatus.state === 'invalid'
                    ? 'bg-rose-50 text-rose-800 border border-rose-200'
                    : 'bg-teal-50 text-teal-800 border border-teal-200'
                }`}
              >
                {geminiTestStatus.state === 'testing' && <Zap className="w-3.5 h-3.5 animate-spin text-amber-500" />}
                <span>{geminiTestStatus.message}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleTestGemini}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700 transition-colors shadow-2xs"
              >
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                <span>Kiểm tra & Xác thực Key</span>
              </button>

              <button
                type="button"
                onClick={handleSaveAllSettings}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition-colors shadow-2xs"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Lưu vào Local Vault</span>
              </button>

              {geminiKey && (
                <button
                  type="button"
                  onClick={handleClearGemini}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold transition-colors ml-auto"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Xóa Key</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* 2. PRACTICE CONFIGURATION (MODE, CEFR, FEEDBACK LANGUAGE) */}
        {/* ======================================================== */}
        <div className="p-6 rounded-3xl border border-slate-200 bg-white shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
                <Sliders className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Chế Độ Luyện Tập & Trình Độ</h3>
                <p className="text-[11px] text-slate-500">
                  Cấu hình phương pháp luyện thi và mục tiêu CEFR.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Practice Mode */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Chế độ luyện thi
              </label>
              <select
                value={practiceMode}
                onChange={(e) => setPracticeMode(e.target.value as any)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:ring-1 focus:ring-teal-500"
              >
                <option value="mock_test">Thi thử nghiêm ngặt (Mock Test)</option>
                <option value="coaching">Kèm cặp & Sửa lỗi chi tiết (Coaching)</option>
                <option value="free_roleplay">Trò chuyện tự do (Free Roleplay)</option>
              </select>
            </div>

            {/* Target Level */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Trình độ CEFR
              </label>
              <select
                value={targetLevel}
                onChange={(e) => setTargetLevel(e.target.value as any)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:ring-1 focus:ring-teal-500"
              >
                <option value="a2">A2 (Elementary)</option>
                <option value="b1">B1 (Intermediate)</option>
                <option value="b2">B2 (Upper-Intermediate)</option>
                <option value="c1">C1 (Advanced)</option>
                <option value="c2">C2 (Proficient / Mastery)</option>
              </select>
            </div>

            {/* Feedback Language */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Ngôn ngữ giải thích
              </label>
              <select
                value={feedbackLanguage}
                onChange={(e) => setFeedbackLanguage(e.target.value as any)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:ring-1 focus:ring-teal-500"
              >
                <option value="en_vn">Song ngữ Anh - Việt (Khuyên Dùng)</option>
                <option value="en_en">100% Tiếng Anh (Full Immersion)</option>
              </select>
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* 3. MULTI-VOICE & ACCENT SYNTHESIS WITH SMART MAPPER      */}
        {/* ======================================================== */}
        <div className="p-6 rounded-3xl border border-slate-200 bg-white shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
                <Volume2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Giọng Đọc Phản Xạ (Multi-Voice Synthesis)</h3>
                <p className="text-[11px] text-slate-500">
                  Tự động ánh xạ thông minh (Smart Voice Mapper) sang giọng đọc chuẩn trên hệ điều hành.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            {[
              {
                persona: 'Aoede (US)',
                displayName: 'Aoede (US)',
                accent: 'American English Accent',
                badge: 'Standard',
                pitchDesc: 'Pitch: 1.05 • Rate: 1.0',
              },
              {
                persona: 'Charon (UK)',
                displayName: 'Charon (UK)',
                accent: 'British Received Pronunciation',
                badge: 'BBC / IELTS',
                pitchDesc: 'Pitch: 0.90 • Rate: 0.98',
              },
              {
                persona: 'Kore (AU)',
                displayName: 'Kore (AU)',
                accent: 'Australian English Accent',
                badge: 'Natural AU',
                pitchDesc: 'Pitch: 1.10 • Rate: 1.02',
              },
            ].map((v) => {
              const personaConfig = container.speechTTSEngine.getPersonaConfig(v.persona);
              const isActive = activeAIVoice === v.persona;

              return (
                <div
                  key={v.persona}
                  onClick={() => handleSelectVoicePersona(v.persona)}
                  className={`p-4 rounded-2xl border transition-all flex flex-col justify-between cursor-pointer space-y-3 ${
                    isActive
                      ? 'border-teal-500 bg-teal-50/60 shadow-xs ring-2 ring-teal-500/20'
                      : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-slate-900">{v.displayName}</span>
                      <span className="text-[9px] bg-white border text-teal-800 font-bold px-2 py-0.5 rounded-full">
                        {v.badge}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">{v.accent}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5 font-mono">{v.pitchDesc}</p>

                    {/* Mapped System Voice Tag */}
                    <div className="mt-2.5 p-2 rounded-xl bg-white border border-slate-200 text-[10px]">
                      <span className="font-bold text-slate-500 block mb-0.5">Ánh xạ giọng OS:</span>
                      <span className="font-semibold text-teal-800 truncate block">
                        {personaConfig.mappedVoiceName}
                      </span>
                    </div>

                    {/* Manual OS Voice Dropdown Override */}
                    <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                      <label className="text-[10px] font-bold text-slate-500 block mb-1">
                        Ghi đè bằng giọng OS:
                      </label>
                      <select
                        value={personaConfig.mappedVoiceName}
                        onChange={(e) => handleVoiceOverrideChange(v.persona, e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg p-1 text-[10px] text-slate-700 focus:ring-1 focus:ring-teal-500"
                      >
                        {availableSystemVoices.map((voice) => (
                          <option key={voice.id} value={voice.name}>
                            {voice.name} ({voice.lang})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Preview Voice Button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePreviewVoice(v.persona);
                    }}
                    className="w-full py-2 px-3 rounded-xl bg-white border border-teal-200 hover:bg-teal-100/50 text-teal-800 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
                  >
                    <Volume2 className="w-3.5 h-3.5 text-teal-600" />
                    <span>Nghe Thử Giọng</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* ======================================================== */}
        {/* 4. GEMINI FAILOVER CHAIN MONITOR                         */}
        {/* ======================================================== */}
        <div className="p-5 rounded-3xl border border-slate-200 bg-white shadow-xs space-y-3">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Chuỗi Dự Phòng Tự Động (Gemini Failover Chain)</h3>
              <p className="text-[11px] text-slate-500">
                Hệ thống tự động xoay tua model Gemini tiếp theo khi gặp HTTP 429 (Rate Limit), 503 hoặc 404.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {GEMINI_MODELS_FALLBACK_CHAIN.map((model) => {
              const isSelected = activeAIProvider === model;
              return (
                <button
                  key={model}
                  type="button"
                  onClick={() => setActiveAIProvider(model)}
                  className={`py-2 px-3 rounded-xl border text-xs font-mono font-medium transition-all ${
                    isSelected
                      ? 'bg-teal-600 text-white border-teal-600 shadow-xs font-bold'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {model}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

// Export alias for backwards compatibility
export { SettingsView as VoiceSettingsView };
