import React from 'react';
import { Sparkles, Award, MessageSquare, BookOpen, Layers, Maximize2, Minimize2 } from 'lucide-react';
import { useTamSpeakStore, RightPanelTab } from '../../store';

export const RightPanelPlaceholder: React.FC = () => {
  const {
    rightPanelTab,
    setRightPanelTab,
    rightPanelExpanded,
    setRightPanelExpanded,
  } = useTamSpeakStore();

  const tabs: Array<{ id: RightPanelTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'quick_start', label: 'Quick Start', icon: Layers },
    { id: 'qna', label: 'Q&A', icon: MessageSquare },
    { id: 'scoring', label: 'Scoring', icon: Award },
    { id: 'vocab_hints', label: 'Vocab Hints', icon: BookOpen },
  ];

  return (
    <aside
      className={`h-[calc(100vh-5rem)] rounded-3xl border border-slate-200/90 bg-white/95 backdrop-blur-xs shadow-xl p-5 flex flex-col transition-all duration-300 ${
        rightPanelExpanded ? 'w-[520px]' : 'w-[420px] xl:w-[460px]'
      } hidden lg:flex select-none`}
    >
      {/* 4 Segmented Tabs + Expand Button */}
      <div className="flex items-center gap-1.5 mb-4">
        <div className="flex-1 flex items-center gap-1 p-1 bg-slate-100 rounded-2xl">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = rightPanelTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setRightPanelTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-teal-600' : 'text-slate-400'}`} />
                <span className="truncate">{tab.label}</span>
              </button>
            );
          })}
        </div>

        <button
          onClick={() => setRightPanelExpanded(!rightPanelExpanded)}
          title={rightPanelExpanded ? 'Contract Panel' : 'Expand Panel'}
          className="p-2 rounded-xl border border-slate-200 text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors shrink-0"
        >
          {rightPanelExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Tab Content Preview */}
      <div className="flex-1 flex flex-col items-center justify-center text-center p-6 border border-dashed border-slate-200 rounded-2xl">
        <Sparkles className="w-8 h-8 text-teal-600 mb-2 animate-bounce" />
        <h3 className="font-bold text-slate-800 text-sm capitalize">
          {rightPanelTab.replace('_', ' ')} Tab Ready
        </h3>
        <p className="text-xs text-slate-500 mt-1 max-w-xs">
          Interactive Controls & Full Implementation will be active in Phase 5 (WaveSurfer markers, Custom Topic Builder, Scoring Breakdown & Datamuse Hints).
        </p>
      </div>
    </aside>
  );
};
