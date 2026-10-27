import React from 'react';
import { Layers, MessageSquare, Award, BookOpen, Maximize2, Minimize2, X, ChevronRight } from 'lucide-react';
import { useTamSpeakStore, RightPanelTab } from '../../store';
import { QuickStartTab } from './QuickStartTab';
import { QnATab } from './QnATab';
import { ScoringTab } from './ScoringTab';
import { VocabHintsTab } from './VocabHintsTab';

export const RightControlPanel: React.FC = () => {
  const {
    rightPanelTab,
    setRightPanelTab,
    rightPanelExpanded,
    setRightPanelExpanded,
    setRightPanelCollapsed,
    rightPanelOpenMobile,
    setRightPanelOpenMobile,
  } = useTamSpeakStore();

  const tabs: Array<{ id: RightPanelTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'quick_start', label: 'Quick Start', icon: Layers },
    { id: 'qna', label: 'Q&A', icon: MessageSquare },
    { id: 'scoring', label: 'Scoring', icon: Award },
    { id: 'vocab_hints', label: 'Vocab Hints', icon: BookOpen },
  ];

  return (
    <>
      {/* Backdrop for mobile drawer */}
      {rightPanelOpenMobile && (
        <div
          onClick={() => setRightPanelOpenMobile(false)}
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs lg:hidden"
        />
      )}

      <aside
        className={`h-[calc(100vh-5rem)] rounded-3xl border border-slate-200/90 bg-white shadow-xl p-4 flex flex-col transition-all duration-300 z-40 ${
          rightPanelExpanded ? 'w-[520px]' : 'w-[420px] xl:w-[460px]'
        } ${
          rightPanelOpenMobile
            ? 'fixed inset-x-2 bottom-2 top-16 h-auto z-50 flex'
            : 'hidden lg:flex'
        } select-none`}
      >
        {/* Top Tab Switcher & Window Controls */}
        <div className="flex items-center gap-1.5 mb-3.5 shrink-0">
          <div className="flex-1 flex items-center gap-1 p-1 bg-slate-100/90 rounded-2xl">
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

          {/* Desktop Expand / Contract Button */}
          <button
            onClick={() => setRightPanelExpanded(!rightPanelExpanded)}
            title={rightPanelExpanded ? 'Contract Width' : 'Expand Width'}
            className="hidden lg:flex p-2 rounded-xl border border-slate-200 text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors shrink-0"
          >
            {rightPanelExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>

          {/* Desktop Collapse Panel Button */}
          <button
            onClick={() => setRightPanelCollapsed(true)}
            title="Thu gọn bảng điều khiển"
            className="hidden lg:flex p-2 rounded-xl border border-slate-200 text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors shrink-0"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>

          {/* Mobile Close Button */}
          <button
            onClick={() => setRightPanelOpenMobile(false)}
            className="lg:hidden p-2 rounded-xl border border-slate-200 text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Content Display */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {rightPanelTab === 'quick_start' && <QuickStartTab />}
          {rightPanelTab === 'qna' && <QnATab />}
          {rightPanelTab === 'scoring' && <ScoringTab />}
          {rightPanelTab === 'vocab_hints' && <VocabHintsTab />}
        </div>
      </aside>
    </>
  );
};
