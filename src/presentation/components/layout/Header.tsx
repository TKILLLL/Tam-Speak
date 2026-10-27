import React, { useState, useRef, useEffect } from 'react';
import {
  Flame,
  User as UserIcon,
  Settings,
  LogOut,
  ChevronDown,
  Award,
} from 'lucide-react';
import { useTamSpeakStore } from '../../store';
import { supabase } from '../../../infrastructure/database/supabase/supabaseClient';

export const Header: React.FC = () => {
  const {
    user,
    setUser,
    setAuthModalOpen,
    setCurrentView,
    activeAIProvider,
    activeAIVoice,
    isFallbackActive,
  } = useTamSpeakStore();

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dropdownOpen]);

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('Sign out error:', err);
    }
    setUser(null);
    setDropdownOpen(false);
  };

  return (
    <header className="h-16 shrink-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur-sm px-6 flex items-center justify-between select-none">
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
          <div className="flex items-center gap-2.5 relative" ref={dropdownRef}>
            {/* Streak Badge */}
            <div
              title={`${user.streakDays} Day Practice Streak!`}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-orange-50 border border-orange-200 text-orange-700 text-xs font-bold"
            >
              <Flame className="w-3.5 h-3.5 fill-orange-500 text-orange-500" />
              <span>{user.streakDays}d Streak</span>
            </div>

            {/* User Avatar Button (Toggles Dropdown) */}
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 p-1 pl-2 pr-2.5 rounded-full hover:bg-slate-100 transition-colors border border-slate-200 cursor-pointer"
            >
              <div className="w-7 h-7 rounded-full bg-teal-700 text-white flex items-center justify-center font-bold text-xs">
                {user.displayName ? user.displayName.charAt(0).toUpperCase() : 'U'}
              </div>
              <span className="text-xs font-semibold text-slate-800 max-w-[100px] truncate hidden md:inline">
                {user.displayName}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {/* Profile Dropdown Menu */}
            {dropdownOpen && (
              <div className="absolute right-0 top-11 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 p-2 z-50 animate-in fade-in slide-in-from-top-2">
                {/* User Info Header */}
                <div className="p-3 border-b border-slate-100">
                  <div className="font-bold text-slate-900 text-sm truncate">
                    {user.displayName}
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono truncate">
                    {user.email}
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-[10px] bg-teal-50 text-teal-700 font-bold px-2 py-0.5 rounded-full border border-teal-200 flex items-center gap-1">
                      <Award className="w-3 h-3" />
                      Target Band {user.targetBand}
                    </span>
                    <span className="text-[10px] bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded-full uppercase">
                      Level {user.currentLevel}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="py-1">
                  <button
                    onClick={() => {
                      setCurrentView('profile');
                      setDropdownOpen(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <UserIcon className="w-4 h-4 text-slate-400" />
                    <span>Profile & Targets</span>
                  </button>
                  <button
                    onClick={() => {
                      setCurrentView('settings');
                      setDropdownOpen(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <Settings className="w-4 h-4 text-slate-400" />
                    <span>AI & Voice Settings</span>
                  </button>
                  <button
                    onClick={() => {
                      setCurrentView('progress');
                      setDropdownOpen(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <Award className="w-4 h-4 text-slate-400" />
                    <span>Progress & Roadmap</span>
                  </button>
                </div>

                <div className="border-t border-slate-100 pt-1">
                  <button
                    onClick={handleSignOut}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                  >
                    <LogOut className="w-4 h-4 text-red-500" />
                    <span>Log Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={() => setAuthModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-sm hover:shadow cursor-pointer"
          >
            <UserIcon className="w-3.5 h-3.5" />
            <span>Sign up / Log in</span>
          </button>
        )}
      </div>
    </header>
  );
};
