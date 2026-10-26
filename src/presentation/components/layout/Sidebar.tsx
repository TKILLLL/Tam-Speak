import React from 'react';
import {
  Mic,
  MessageSquare,
  Target,
  FileEdit,
  BookOpen,
  BarChart3,
  Download,
  Settings,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useTamSpeakStore, NavigationView } from '../../store';

interface NavItemConfig {
  id: NavigationView;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItemConfig[] = [
  { id: 'ielts', label: 'IELTS Speaking AI', shortLabel: 'IELTS', icon: Mic },
  { id: 'conversation', label: 'Conversation Practice', shortLabel: 'Chat', icon: MessageSquare },
  { id: 'pronunciation', label: 'Pronunciation & IPA Lab', shortLabel: 'IPA', icon: Target },
  { id: 'scratchpad', label: 'Scratchpad & Translator', shortLabel: 'Notes', icon: FileEdit },
  { id: 'vocab_bank', label: 'Question & Vocab Bank', shortLabel: 'Bank', icon: BookOpen },
  { id: 'progress', label: 'Progress & Roadmap', shortLabel: 'Stats', icon: BarChart3 },
  { id: 'raw_data', label: 'Raw Data Studio', shortLabel: 'Import', icon: Download },
  { id: 'settings', label: 'AI & Voice Settings', shortLabel: 'Config', icon: Settings },
];

export const Sidebar: React.FC = () => {
  const {
    currentView,
    setCurrentView,
    sidebarCollapsed,
    toggleSidebar,
    user,
    setAuthModalOpen,
  } = useTamSpeakStore();

  return (
    <aside
      className={`h-[calc(100vh-4rem)] bg-white border-r border-slate-200 transition-all duration-300 flex flex-col select-none ${
        sidebarCollapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* User Header Profile */}
      <div className="p-3 border-b border-slate-100 flex items-center justify-between">
        <div
          onClick={() => {
            if (!user) setAuthModalOpen(true);
            else setCurrentView('progress');
          }}
          className="flex items-center gap-2.5 overflow-hidden cursor-pointer group"
          title={!user ? 'Click to Sign in' : 'View Progress'}
        >
          <div className="w-9 h-9 rounded-xl bg-teal-700 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-xs group-hover:bg-teal-600 transition-colors">
            {user?.displayName ? user.displayName.charAt(0).toUpperCase() : 'G'}
          </div>
          {!sidebarCollapsed && (
            <div className="flex flex-col truncate">
              <span className="text-xs font-bold text-slate-900 truncate group-hover:text-teal-700 transition-colors">
                {user?.displayName || 'Guest Learner'}
              </span>
              <span className="text-[10px] text-teal-600 font-medium">
                {user ? `Band Target: ${user.targetBand}` : 'Click to Sign In'}
              </span>
            </div>
          )}
        </div>

        <button
          onClick={toggleSidebar}
          title={sidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
        >
          {sidebarCollapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* 8 Navigation Menu Items */}
      <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;

          return (
            <button
              key={item.id}
              onClick={() => setCurrentView(item.id)}
              title={item.label}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all group ${
                isActive
                  ? 'bg-gradient-to-r from-teal-50/90 to-cyan-50/80 text-teal-900 font-semibold shadow-xs border border-teal-200/60'
                  : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
              }`}
            >
              <Icon
                className={`w-4 h-4 shrink-0 transition-colors ${
                  isActive ? 'text-teal-600' : 'text-slate-400 group-hover:text-slate-600'
                }`}
              />
              {!sidebarCollapsed && (
                <span className="truncate text-left">{item.label}</span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer Tagline */}
      {!sidebarCollapsed && (
        <div className="p-3 border-t border-slate-100 text-center">
          <p className="text-[11px] font-medium text-slate-400">
            TamSpeak v1.0.0
          </p>
          <p className="text-[10px] text-teal-600 font-semibold tracking-wide">
            Zero-Token First Architecture
          </p>
        </div>
      )}
    </aside>
  );
};
