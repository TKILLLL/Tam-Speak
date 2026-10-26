import React from 'react';
import { Flame, User as UserIcon } from 'lucide-react';
import { useTamSpeakStore } from '../../store';

export const Header: React.FC = () => {
  const {
    user,
    setAuthModalOpen,
    activeAIProvider,
    activeAIVoice,
    isFallbackActive,
  } = useTamSpeakStore();

  return (
    <header className="h-16 border-b border-slate-200 bg-white/95 backdrop-blur-sm px-6 flex items-center justify-between sticky top-0 z-30 select-none">
      {/* Left: TamSpeak Branding */}
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-teal-600 to-cyan-500 flex items-center justify-center text-white font-black text-lg shadow-sm shadow-teal-500/20">
          T
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-xl font-extrabold tracking-tight text-slate-900">
            TamSpeak
          </span>
          <span className="text-slate-300 font-light hidden sm:inline">/</span>
          <span className="text-xs font-semibold text-teal-600 tracking-wide uppercase hidden sm:inline">
            Speak Like a Native
          </span>
        </div>
      </div>

      {/* Center: Dynamic AI Status Badge */}
      <div className="flex items-center">
        <div
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium border shadow-xs transition-all ${
            isFallbackActive
              ? 'bg-amber-50 border-amber-200 text-amber-800'
              : 'bg-teal-50/80 border-teal-200/80 text-teal-800'
          }`}
        >
          <span className="relative flex h-2 w-2">
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                isFallbackActive ? 'bg-amber-400' : 'bg-teal-400'
              }`}
            />
            <span
              className={`relative inline-flex rounded-full h-2 w-2 ${
                isFallbackActive ? 'bg-amber-500' : 'bg-teal-600'
              }`}
            />
          </span>
          <span className="font-semibold">{activeAIProvider}</span>
          <span className="text-slate-400">•</span>
          <span className="text-slate-600 font-normal">Voice: {activeAIVoice}</span>
          {isFallbackActive && (
            <span className="text-[10px] bg-amber-200/60 text-amber-900 px-1.5 py-0.2 rounded font-bold">
              FALLBACK
            </span>
          )}
        </div>
      </div>

      {/* Right: User Profile & Streak / Auth */}
      <div className="flex items-center gap-3">
        {user ? (
          <div className="flex items-center gap-2.5">
            {/* Streak Badge */}
            <div
              title={`${user.streakDays} Day Practice Streak!`}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-orange-50 border border-orange-200 text-orange-700 text-xs font-bold"
            >
              <Flame className="w-3.5 h-3.5 fill-orange-500 text-orange-500" />
              <span>{user.streakDays}d Streak</span>
            </div>

            {/* User Avatar */}
            <button
              onClick={() => setAuthModalOpen(true)}
              className="flex items-center gap-2 p-1 pl-2 pr-3 rounded-full hover:bg-slate-100 transition-colors border border-slate-200"
            >
              <div className="w-7 h-7 rounded-full bg-teal-700 text-white flex items-center justify-center font-bold text-xs">
                {user.displayName.charAt(0).toUpperCase()}
              </div>
              <span className="text-xs font-semibold text-slate-800 max-w-[100px] truncate hidden md:inline">
                {user.displayName}
              </span>
            </button>
          </div>
        ) : (
          <button
            onClick={() => setAuthModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-sm hover:shadow"
          >
            <UserIcon className="w-3.5 h-3.5" />
            <span>Sign up / Log in</span>
          </button>
        )}
      </div>
    </header>
  );
};
