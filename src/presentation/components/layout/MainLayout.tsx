import React from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { VoiceStage } from '../voice-stage/VoiceStage';
import { RightControlPanel } from '../right-panel/RightControlPanel';
import { AuthModal } from '../auth/AuthModal';
import { useTamSpeakStore } from '../../store';
import { SettingsView } from '../views/SettingsView';
import { RawDataStudioView } from '../views/RawDataStudioView';
import { ProgressDashboardView } from '../views/ProgressDashboardView';
import { SlidersHorizontal } from 'lucide-react';

export const MainLayout: React.FC = () => {
  const { currentView, setRightPanelOpenMobile } = useTamSpeakStore();

  const renderCurrentView = () => {
    switch (currentView) {
      case 'ielts':
      case 'conversation':
      case 'pronunciation':
      case 'scratchpad':
      case 'vocab_bank':
        return <VoiceStage />;
      case 'settings':
        return <SettingsView />;
      case 'raw_data':
        return <RawDataStudioView />;
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
        {/* Left Column: Collapsible 8-Item Navigation Sidebar */}
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
    </div>
  );
};
