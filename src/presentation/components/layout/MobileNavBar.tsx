import React from 'react';
import { Sparkles, MessageSquare, Target, BarChart3, Menu } from 'lucide-react';
import { useTamSpeakStore, NavigationView } from '../../store';

export const MobileNavBar: React.FC = () => {
  const {
    currentView,
    setCurrentView,
    user,
    setAuthModalOpen,
    toggleSidebar,
    hasCompletedOnboarding,
  } = useTamSpeakStore();

  const handleNav = (view: NavigationView) => {
    if (view === 'profile' && !user) {
      setAuthModalOpen(true);
      return;
    }
    if (view === 'conversation' || hasCompletedOnboarding) {
      setCurrentView(view);
    }
  };

  const isConversationActive =
    currentView === 'conversation' ||
    currentView === 'ielts' ||
    currentView === 'scratchpad' ||
    currentView === 'vocab_bank';

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200/90 px-2 pt-1.5 pb-safe flex items-center justify-around shadow-lg select-none">
      {/* 1. Speaking AI (Alex) */}
      <button
        type="button"
        onClick={() => handleNav('speaking_ai')}
        disabled={!hasCompletedOnboarding}
        className={`flex-1 flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all active-press ${
          !hasCompletedOnboarding ? 'opacity-40 cursor-not-allowed' : ''
        } ${
          currentView === 'speaking_ai'
            ? 'text-teal-700 font-bold'
            : 'text-slate-500 hover:text-slate-800'
        }`}
      >
        <div className={`p-1 rounded-xl transition-colors ${currentView === 'speaking_ai' ? 'bg-teal-50 text-teal-600' : ''}`}>
          <Sparkles className="w-4 h-4" />
        </div>
        <span className="text-[10px] mt-0.5 tracking-tight truncate">Alex</span>
      </button>

      {/* 2. Conversation Practice */}
      <button
        type="button"
        onClick={() => handleNav('conversation')}
        className={`flex-1 flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all active-press ${
          isConversationActive
            ? 'text-teal-700 font-bold'
            : 'text-slate-500 hover:text-slate-800'
        }`}
      >
        <div className={`p-1 rounded-xl transition-colors ${isConversationActive ? 'bg-teal-50 text-teal-600' : ''}`}>
          <MessageSquare className="w-4 h-4" />
        </div>
        <span className="text-[10px] mt-0.5 tracking-tight truncate">Practice</span>
      </button>

      {/* 3. Pronunciation & IPA Lab */}
      <button
        type="button"
        onClick={() => handleNav('pronunciation')}
        disabled={!hasCompletedOnboarding}
        className={`flex-1 flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all active-press ${
          !hasCompletedOnboarding ? 'opacity-40 cursor-not-allowed' : ''
        } ${
          currentView === 'pronunciation'
            ? 'text-teal-700 font-bold'
            : 'text-slate-500 hover:text-slate-800'
        }`}
      >
        <div className={`p-1 rounded-xl transition-colors ${currentView === 'pronunciation' ? 'bg-teal-50 text-teal-600' : ''}`}>
          <Target className="w-4 h-4" />
        </div>
        <span className="text-[10px] mt-0.5 tracking-tight truncate">IPA Lab</span>
      </button>

      {/* 4. Progress Dashboard */}
      <button
        type="button"
        onClick={() => handleNav('progress')}
        disabled={!hasCompletedOnboarding}
        className={`flex-1 flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all active-press ${
          !hasCompletedOnboarding ? 'opacity-40 cursor-not-allowed' : ''
        } ${
          currentView === 'progress'
            ? 'text-teal-700 font-bold'
            : 'text-slate-500 hover:text-slate-800'
        }`}
      >
        <div className={`p-1 rounded-xl transition-colors ${currentView === 'progress' ? 'bg-teal-50 text-teal-600' : ''}`}>
          <BarChart3 className="w-4 h-4" />
        </div>
        <span className="text-[10px] mt-0.5 tracking-tight truncate">Progress</span>
      </button>

      {/* 5. Profile & More Drawer */}
      <button
        type="button"
        onClick={toggleSidebar}
        className={`flex-1 flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all active-press ${
          currentView === 'profile' || currentView === 'settings'
            ? 'text-teal-700 font-bold'
            : 'text-slate-500 hover:text-slate-800'
        }`}
      >
        <div className="p-1 rounded-xl text-slate-500">
          <Menu className="w-4 h-4" />
        </div>
        <span className="text-[10px] mt-0.5 tracking-tight truncate">Menu</span>
      </button>
    </nav>
  );
};
