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
} from 'lucide-react';
import { useTamSpeakStore } from '../../store';
import { container } from '../../../di/DIContainer';

export const SettingsView: React.FC = () => {
  const {
    activeAIVoice,
    setActiveAIVoice,
    activeAIProvider,
    setActiveAIProvider,
  } = useTamSpeakStore();

  // 1. BYOK (Personal API Keys) State
  const [geminiKey, setGeminiKey] = useState('');
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [geminiTestStatus, setGeminiTestStatus] = useState<{
    state: 'idle' | 'testing' | 'valid' | 'invalid';
    message?: string;
  }>({ state: 'idle' });

  const [groqKey, setGroqKey] = useState('');
  const [showGroqKey, setShowGroqKey] = useState(false);
  const [groqTestStatus, setGroqTestStatus] = useState<{
    state: 'idle' | 'testing' | 'valid' | 'invalid';
    message?: string;
  }>({ state: 'idle' });

  // 2. TTS Voice List & Mapping State
  const [availableSystemVoices, setAvailableSystemVoices] = useState<
    Array<{ id: string; name: string; lang: string }>
  >([]);

  // 3. Vault & General Settings State
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Load existing BYOK keys from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      const savedGemini = window.localStorage.getItem('tamspeak_byok_gemini');
      if (savedGemini) {
        setGeminiKey(savedGemini);
        container.aiGateway.setPersonalKey?.('gemini', savedGemini);
      }

      const savedGroq = window.localStorage.getItem('tamspeak_byok_groq');
      if (savedGroq) {
        setGroqKey(savedGroq);
        container.aiGateway.setPersonalKey?.('groq', savedGroq);
      }
    }
  }, []);

  // Subscribe to voices loaded event
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

  // --- BYOK Handlers ---
  const handleTestGemini = async () => {
    if (!geminiKey.trim()) {
      setGeminiTestStatus({ state: 'invalid', message: 'Vui lòng nhập API Key trước khi kiểm tra.' });
      return;
    }

    setGeminiTestStatus({ state: 'testing', message: 'Đang gửi ping kiểm tra đến Google Gemini API...' });
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKey.trim()}`
      );
      if (response.ok) {
        // Auto-save immediately upon successful verification so user doesn't have to click a second button
        const trimmedKey = geminiKey.trim();
        window.localStorage.setItem('tamspeak_byok_gemini', trimmedKey);
        container.aiGateway.setPersonalKey?.('gemini', trimmedKey);

        setGeminiTestStatus({
          state: 'valid',
          message: 'Valid API Key! Đã tự động kích hoạt và lưu vào Local Vault của bạn.',
        });
        setStatusMessage('Đã tự động lưu Google Gemini API Key cá nhân vào Local Vault của bạn!');
        setTimeout(() => setStatusMessage(null), 3500);
      } else {
        const errorData = await response.json().catch(() => ({}));
        setGeminiTestStatus({
          state: 'invalid',
          message: `Invalid Key (${response.status}): ${
            errorData?.error?.message || 'API Key không hợp lệ hoặc chưa kích hoạt Generative Language API.'
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

  const handleSaveGemini = () => {
    if (!geminiKey.trim()) return;
    const trimmedKey = geminiKey.trim();
    window.localStorage.setItem('tamspeak_byok_gemini', trimmedKey);
    container.aiGateway.setPersonalKey?.('gemini', trimmedKey);
    setStatusMessage('Đã lưu Google Gemini API Key cá nhân vào Local Vault của bạn!');
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

  const handleTestGroq = async () => {
    if (!groqKey.trim()) {
      setGroqTestStatus({ state: 'invalid', message: 'Vui lòng nhập Groq API Key trước khi kiểm tra.' });
      return;
    }

    setGroqTestStatus({ state: 'testing', message: 'Đang gửi ping kiểm tra đến Groq Cloud API...' });
    try {
      const response = await fetch('https://api.groq.com/openai/v1/models', {
        headers: { Authorization: `Bearer ${groqKey.trim()}` },
      });
      if (response.ok) {
        // Auto-save immediately upon successful verification
        const trimmedKey = groqKey.trim();
        window.localStorage.setItem('tamspeak_byok_groq', trimmedKey);
        container.aiGateway.setPersonalKey?.('groq', trimmedKey);

        setGroqTestStatus({
          state: 'valid',
          message: 'Valid API Key! Đã tự động kích hoạt và lưu vào Local Vault của bạn.',
        });
        setStatusMessage('Đã tự động lưu Groq API Key cá nhân vào Local Vault của bạn!');
        setTimeout(() => setStatusMessage(null), 3500);
      } else {
        setGroqTestStatus({
          state: 'invalid',
          message: `Invalid Key (${response.status}): Key Groq không chính xác hoặc đã hết hạn.`,
        });
      }
    } catch (err: any) {
      setGroqTestStatus({
        state: 'invalid',
        message: `Lỗi kết nối: ${err?.message || 'Không thể ping đến Groq API.'}`,
      });
    }
  };

  const handleSaveGroq = () => {
    if (!groqKey.trim()) return;
    const trimmedKey = groqKey.trim();
    window.localStorage.setItem('tamspeak_byok_groq', trimmedKey);
    container.aiGateway.setPersonalKey?.('groq', trimmedKey);
    setStatusMessage('Đã lưu Groq API Key cá nhân vào Local Vault của bạn!');
    setTimeout(() => setStatusMessage(null), 3500);
  };

  const handleClearGroq = () => {
    window.localStorage.removeItem('tamspeak_byok_groq');
    container.aiGateway.setPersonalKey?.('groq', null);
    setGroqKey('');
    setGroqTestStatus({ state: 'idle' });
    setStatusMessage('Đã xóa Groq Key cá nhân. Hệ thống quay về hạn mức mặc định.');
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
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <span>AI & Voice Configuration</span>
            <span className="text-[11px] bg-teal-100 text-teal-800 font-bold px-2 py-0.5 rounded-full">
              BYOK & Smart TTS
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Cấu hình API Key cá nhân (Bring Your Own Key) và tinh chỉnh giọng đọc đa ngữ điệu.
          </p>
        </div>

        {statusMessage && (
          <div className="p-3.5 rounded-2xl bg-teal-50 border border-teal-200 text-teal-900 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}

        {/* ======================================================== */}
        {/* 1. PERSONAL API KEY CONFIGURATION (BYOK) - TOP PRIORITY  */}
        {/* ======================================================== */}
        <div className="p-6 rounded-3xl border-2 border-teal-200/90 bg-white shadow-md space-y-5">
          <div className="flex items-start justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-xs">
                <Key className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span>Personal API Key Configuration (BYOK)</span>
                  <span className="text-[10px] bg-amber-100 text-amber-800 font-extrabold px-2 py-0.5 rounded-full">
                    Khuyên Dùng
                  </span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Nhập API Key cá nhân của bạn để sử dụng không giới hạn mà không phụ thuộc vào hạn mức (Quota) chung của hệ thống.
                </p>
              </div>
            </div>
          </div>

          {/* A. Google Gemini API Key */}
          <div className="space-y-2 p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-teal-600" />
                <label className="text-xs font-bold text-slate-800">
                  Google Gemini API Key <span className="text-[10px] text-teal-600 font-semibold">(Gemini 2.5 Flash • Khuyên Dùng)</span>
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
                  if (val.trim()) {
                    window.localStorage.setItem('tamspeak_byok_gemini', val.trim());
                    container.aiGateway.setPersonalKey?.('gemini', val.trim());
                  }
                }}
                onBlur={() => {
                  if (geminiKey.trim()) {
                    window.localStorage.setItem('tamspeak_byok_gemini', geminiKey.trim());
                    container.aiGateway.setPersonalKey?.('gemini', geminiKey.trim());
                  }
                }}
                placeholder="AIzaSy..."
                className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-slate-300 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
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
                className={`text-[11px] font-semibold p-2 rounded-lg flex items-center gap-1.5 ${
                  geminiTestStatus.state === 'valid'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : geminiTestStatus.state === 'invalid'
                    ? 'bg-rose-50 text-rose-800 border border-rose-200'
                    : 'bg-teal-50 text-teal-800 border border-teal-200'
                }`}
              >
                {geminiTestStatus.state === 'testing' && <Zap className="w-3.5 h-3.5 animate-spin" />}
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
                <span>Test & Verify Key</span>
              </button>

              <button
                type="button"
                onClick={handleSaveGemini}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition-colors shadow-2xs"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save to Local Vault</span>
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

          {/* B. Groq API Key */}
          <div className="space-y-2 p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-purple-600" />
                <label className="text-xs font-bold text-slate-800">
                  Groq Cloud API Key <span className="text-[10px] text-purple-600 font-semibold">(Llama 3.3 70B • Tốc độ siêu tốc & Fallback)</span>
                </label>
              </div>
              <a
                href="https://console.groq.com/keys"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-purple-700 font-bold hover:underline"
              >
                Lấy Key tại Groq Console ↗
              </a>
            </div>

            <div className="relative">
              <input
                type={showGroqKey ? 'text' : 'password'}
                value={groqKey}
                onChange={(e) => {
                  const val = e.target.value;
                  setGroqKey(val);
                  setGroqTestStatus({ state: 'idle' });
                  if (val.trim()) {
                    window.localStorage.setItem('tamspeak_byok_groq', val.trim());
                    container.aiGateway.setPersonalKey?.('groq', val.trim());
                  }
                }}
                onBlur={() => {
                  if (groqKey.trim()) {
                    window.localStorage.setItem('tamspeak_byok_groq', groqKey.trim());
                    container.aiGateway.setPersonalKey?.('groq', groqKey.trim());
                  }
                }}
                placeholder="gsk_..."
                className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-slate-300 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
              />
              <button
                type="button"
                onClick={() => setShowGroqKey(!showGroqKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showGroqKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Test Status Feedback */}
            {groqTestStatus.state !== 'idle' && (
              <div
                className={`text-[11px] font-semibold p-2 rounded-lg flex items-center gap-1.5 ${
                  groqTestStatus.state === 'valid'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : groqTestStatus.state === 'invalid'
                    ? 'bg-rose-50 text-rose-800 border border-rose-200'
                    : 'bg-purple-50 text-purple-800 border border-purple-200'
                }`}
              >
                {groqTestStatus.state === 'testing' && <Zap className="w-3.5 h-3.5 animate-spin" />}
                <span>{groqTestStatus.message}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleTestGroq}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700 transition-colors shadow-2xs"
              >
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                <span>Test & Verify Key</span>
              </button>

              <button
                type="button"
                onClick={handleSaveGroq}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-colors shadow-2xs"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save to Local Vault</span>
              </button>

              {groqKey && (
                <button
                  type="button"
                  onClick={handleClearGroq}
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
        {/* 2. MULTI-VOICE & ACCENT SYNTHESIS WITH SMART MAPPER      */}
        {/* ======================================================== */}
        <div className="p-6 rounded-3xl border border-slate-200 bg-white shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
                <Volume2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Multi-Voice & Accent Synthesis</h3>
                <p className="text-[11px] text-slate-500">
                  Tự động ánh xạ thông minh (Smart Voice Mapper) sang giọng đọc thực tế trên hệ điều hành của bạn.
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
                      <span className="font-bold text-slate-500 block mb-0.5">Mapped to System Voice:</span>
                      <span className="font-semibold text-teal-800 truncate block">
                        {personaConfig.mappedVoiceName}
                      </span>
                    </div>

                    {/* Manual OS Voice Dropdown Override */}
                    <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                      <label className="text-[10px] font-bold text-slate-500 block mb-1">
                        Override with OS Voice:
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
                    <span>Preview Voice</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* ======================================================== */}
        {/* 3. ACTIVE PROVIDER STRATEGY                             */}
        {/* ======================================================== */}
        <div className="p-5 rounded-3xl border border-slate-200 bg-white shadow-xs space-y-3">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Active AI Provider Strategy</h3>
              <p className="text-[11px] text-slate-500">
                Resilient Gateway ưu tiên Key cá nhân của bạn, sau đó tự động fallback khi gặp sự cố mạng hoặc quota.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {(['gemini', 'groq', 'openrouter'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setActiveAIProvider(p)}
                className={`py-2 px-3 rounded-xl border text-xs font-bold capitalize transition-all ${
                  activeAIProvider === p
                    ? 'bg-teal-600 text-white border-teal-600 shadow-xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
