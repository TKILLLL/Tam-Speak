import React from 'react';
import {
  MessageSquare,
  Target,
  BarChart3,
  Download,
  Settings,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';
import { useTamSpeakStore, NavigationView } from '../../store';

interface NavItemConfig {
  id: NavigationView;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItemConfig[] = [
  { id: 'conversation', label: 'Conversation Practice', shortLabel: 'Chat', icon: MessageSquare },
  { id: 'pronunciation', label: 'Pronunciation & IPA Lab', shortLabel: 'IPA', icon: Target },
  { id: 'progress', label: 'Progress & Roadmap', shortLabel: 'Stats', icon: BarChart3 },
  { id: 'raw_data', label: 'Raw Data Studio', shortLabel: 'Import', icon: Download, adminOnly: true },
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

  const isAdmin = user?.role === 'admin';
  const visibleNavItems = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);

  return (
    <aside
      className={`h-[calc(100vh-4rem)] bg-white border-r border-slate-200 transition-all duration-300 flex flex-col select-none shrink-0 ${
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
          className="flex items-center gap-2.5 overflow-hidden cursor-pointer group flex-1"
          title={!user ? 'Click to Sign in' : 'View Progress'}
        >
          <div className="w-9 h-9 rounded-xl bg-teal-700 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-xs group-hover:bg-teal-600 transition-colors relative">
            {user?.displayName ? user.displayName.charAt(0).toUpperCase() : 'G'}
            {isAdmin && (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-amber-500 rounded-full flex items-center justify-center text-[8px] text-white font-bold ring-2 ring-white">
                ★
              </span>
            )}
          </div>
          {!sidebarCollapsed && (
            <div className="flex flex-col truncate">
              <div className="flex items-center gap-1">
                <span className="text-xs font-bold text-slate-900 truncate group-hover:text-teal-700 transition-colors">
                  {user?.displayName || 'Guest Learner'}
                </span>
                {isAdmin && (
                  <span className="px-1 py-0.2 bg-amber-100 text-amber-800 text-[9px] font-bold rounded">
                    Admin
                  </span>
                )}
              </div>
              <span className="text-[10px] text-teal-600 font-medium">
                {user ? `Band Target: ${user.targetBand}` : 'Click to Sign In'}
              </span>
            </div>
          )}
        </div>

        <button
          onClick={toggleSidebar}
          title={sidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors shrink-0"
        >
          {sidebarCollapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Streamlined 5 Navigation Menu Items */}
      <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
        {visibleNavItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            currentView === item.id ||
            (item.id === 'conversation' && (currentView === 'ielts' || currentView === 'scratchpad' || currentView === 'vocab_bank'));

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
                <div className="flex-1 flex items-center justify-between text-left">
                  <span className="truncate">{item.label}</span>
                  {item.adminOnly && (
                    <span className="text-[9px] bg-slate-100 text-slate-500 px-1 rounded flex items-center gap-0.5">
                      <ShieldCheck className="w-2.5 h-2.5" />
                    </span>
                  )}
                </div>
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
            Speak Like a Native
          </p>
        </div>
      )}
    </aside>
  );
};
