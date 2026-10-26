import React from 'react';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { useTamSpeakStore } from '../../store';

interface AdminRouteGuardProps {
  children: React.ReactNode;
}

export const AdminRouteGuard: React.FC<AdminRouteGuardProps> = ({ children }) => {
  const { user, setCurrentView } = useTamSpeakStore();

  if (user?.role !== 'admin') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-50 text-center select-none">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4 border border-amber-200">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-slate-800 mb-1">Admin Access Required</h3>
        <p className="text-xs text-slate-500 max-w-sm mb-6 leading-relaxed">
          Raw Data Studio contains bulk ingestion pipelines and database modification tools. This area is restricted to administrator accounts.
        </p>
        <button
          onClick={() => setCurrentView('conversation')}
          className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Conversation Practice</span>
        </button>
      </div>
    );
  }

  return <>{children}</>;
};
