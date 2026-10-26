import React from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { VoiceStage } from '../voice-stage/VoiceStage';
import { RightControlPanel } from '../right-panel/RightControlPanel';
import { AuthModal } from '../auth/AuthModal';
import { AdminRouteGuard } from '../auth/AdminRouteGuard';
import { useTamSpeakStore } from '../../store';
import { SettingsView } from '../views/SettingsView';
import { RawDataStudioView } from '../views/RawDataStudioView';
import { ProgressDashboardView } from '../views/ProgressDashboardView';
import { PronunciationLabView } from '../views/PronunciationLabView';
import { SlidersHorizontal, AlertTriangle, AlertCircle, RefreshCw } from 'lucide-react';

export const MainLayout: React.FC = () => {
  const {
    currentView,
    setRightPanelOpenMobile,
    penaltyToastMessage,
    revealWarningModalOpen,
    pendingRevealTurnId,
    closeRevealWarningModal,
    revealTurn,
    setHasShownRevealWarningInSession,
    showPenaltyToast,
    topicChangeWarningModalOpen,
    closeTopicChangeWarningModal,
    pendingTopicSwitch,
  } = useTamSpeakStore();

  const handleConfirmReveal = () => {
    if (pendingRevealTurnId) {
      setHasShownRevealWarningInSession(true);
      revealTurn(pendingRevealTurnId);
      showPenaltyToast('-0.5 điểm phản xạ do mở xem transcript');
    }
    closeRevealWarningModal();
  };

  const handleConfirmTopicChange = () => {
    if (pendingTopicSwitch) {
      pendingTopicSwitch();
    }
    closeTopicChangeWarningModal();
  };

  const renderCurrentView = () => {
    switch (currentView) {
      case 'conversation':
      case 'ielts':
      case 'scratchpad':
      case 'vocab_bank':
        return <VoiceStage />;
      case 'pronunciation':
        return <PronunciationLabView />;
      case 'settings':
        return <SettingsView />;
      case 'raw_data':
        return (
          <AdminRouteGuard>
            <RawDataStudioView />
          </AdminRouteGuard>
        );
      case 'progress':
        return <ProgressDashboardView />;
      default:
        return <VoiceStage />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900 antialiased overflow-hidden">
      {/* Top Application Header */}
      <Header />

      {/* Main 3-Column Workspace Layout */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Column: Collapsible 5-Item Navigation Sidebar */}
        <Sidebar />

        {/* Center Column: Main Voice Stage / Secondary View */}
        <main className="flex-1 flex overflow-hidden relative">
          {renderCurrentView()}

          {/* Floating Mobile Panel Toggle Button */}
          <button
            onClick={() => setRightPanelOpenMobile(true)}
            className="lg:hidden absolute bottom-5 right-5 z-30 p-3 bg-teal-600 text-white rounded-full shadow-lg hover:bg-teal-700 transition-transform active:scale-95"
            title="Open Controls & Q&A"
          >
            <SlidersHorizontal className="w-5 h-5" />
          </button>
        </main>

        {/* Right Column: Contextual Floating Panel (4 Tabs) */}
        <div className="p-4 pl-0 hidden lg:block">
          <RightControlPanel />
        </div>
      </div>

      {/* Global Auth Modal */}
      <AuthModal />

      {/* Global Penalty Toast Notification */}
      {penaltyToastMessage && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-2xl bg-slate-900/90 text-white text-xs font-semibold shadow-xl flex items-center gap-2 border border-slate-700 backdrop-blur-md animate-in slide-in-from-bottom-3">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{penaltyToastMessage}</span>
        </div>
      )}

      {/* 1-Time Session Reveal Warning Modal */}
      {revealWarningModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-sm font-bold text-slate-900">
                ⚠️ Cảnh báo giảm điểm phản xạ
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Việc mở xem văn bản của AI sẽ làm giảm điểm kỹ năng Nghe & Phản xạ <span className="font-bold text-rose-600">(-0.5 điểm)</span> trong phiên luyện tập này. Bạn có chắc chắn muốn xem?
              </p>
              <p className="text-[10px] text-slate-400 pt-1 italic">
                (Thông báo này sẽ không nhắc lại trong phiên hiện tại)
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={closeRevealWarningModal}
                className="flex-1 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={handleConfirmReveal}
                className="flex-1 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-xs transition-colors"
              >
                Đồng ý xem
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Topic Switch Confirmation Modal */}
      {topicChangeWarningModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mx-auto border border-teal-200">
              <RefreshCw className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1.5">
              <h3 className="text-sm font-bold text-slate-900">
                🔄 Chuyển chủ đề / IELTS Part mới?
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Toàn bộ lịch sử trò chuyện và điểm số của phiên hiện tại sẽ được làm mới để bắt đầu phiên mới.
              </p>
              <div className="p-2.5 bg-emerald-50 text-emerald-800 text-[11px] rounded-xl border border-emerald-100 font-medium text-left">
                💡 <span className="font-bold">Yên tâm:</span> Toàn bộ các từ và câu bạn phát âm sai trong chủ đề này đã được lưu an toàn vào mục <span className="font-bold underline">Pronunciation & IPA Lab</span>.
              </div>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={closeTopicChangeWarningModal}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleConfirmTopicChange}
                className="flex-1 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-xs transition-colors"
              >
                Xác nhận chuyển
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
