import React, { useEffect, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { container } from '../../../di/DIContainer';

export const SpeechRateControl: React.FC = () => {
  const [rate, setRate] = useState(() => container.speechTTSEngine.getSpeechRate());
  useEffect(() => setRate(container.speechTTSEngine.getSpeechRate()), []);
  const change = (delta: number) => {
    const next = container.speechTTSEngine.setSpeechRate(rate + delta);
    setRate(next);
  };
  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-1 py-1 shadow-xs" aria-label="AI speech speed">
      <button type="button" onClick={() => change(-0.1)} disabled={rate <= 0.5} className="rounded-full p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30" title="Slower">
        <Minus className="h-3 w-3" />
      </button>
      <span className="min-w-[2.8rem] text-center text-[10px] font-bold text-teal-700">{rate.toFixed(1)}x</span>
      <button type="button" onClick={() => change(0.1)} disabled={rate >= 1.5} className="rounded-full p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30" title="Faster">
        <Plus className="h-3 w-3" />
      </button>
    </div>
  );
};
