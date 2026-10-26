import React from 'react';
import {
  Flame,
  Clock,
  Target,
  Award,
  Sparkles,
  Play,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  LineChart,
  Line,
  CartesianGrid,
} from 'recharts';
import { useTamSpeakStore } from '../../store';

const WEEKLY_PRACTICE_DATA = [
  { day: 'Mon', minutes: 15 },
  { day: 'Tue', minutes: 25 },
  { day: 'Wed', minutes: 20 },
  { day: 'Thu', minutes: 35 },
  { day: 'Fri', minutes: 10 },
  { day: 'Sat', minutes: 40 },
  { day: 'Sun', minutes: 30 },
];

const BAND_PROGRESSION_DATA = [
  { session: 'S1', pronunciation: 6.0, fluency: 6.0, lexical: 6.5, overall: 6.0 },
  { session: 'S2', pronunciation: 6.5, fluency: 6.0, lexical: 6.5, overall: 6.5 },
  { session: 'S3', pronunciation: 6.5, fluency: 6.5, lexical: 7.0, overall: 6.5 },
  { session: 'S4', pronunciation: 7.0, fluency: 7.0, lexical: 7.5, overall: 7.0 },
  { session: 'S5', pronunciation: 7.0, fluency: 7.5, lexical: 7.5, overall: 7.5 },
  { session: 'S6', pronunciation: 7.5, fluency: 7.5, lexical: 8.0, overall: 7.5 },
];

export const ProgressDashboardView: React.FC = () => {
  const { user } = useTamSpeakStore();

  return (
    <div className="flex-1 p-6 md:p-8 overflow-y-auto bg-slate-50 select-none">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
            Speaking Progress & Roadmap
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Track your IELTS band evolution, acoustic speech fluency trajectory, and daily practice streak.
          </p>
        </div>

        {/* 4 Stat Metric Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div className="p-4 rounded-3xl border border-slate-200 bg-white shadow-2xs">
            <div className="flex items-center gap-2 text-orange-600 mb-1">
              <Flame className="w-4 h-4 fill-orange-500" />
              <span className="font-bold">Practice Streak</span>
            </div>
            <div className="text-2xl font-black text-slate-900">{user?.streakDays || 3} Days</div>
            <span className="text-[10px] text-slate-400">Keep practicing daily!</span>
          </div>

          <div className="p-4 rounded-3xl border border-slate-200 bg-white shadow-2xs">
            <div className="flex items-center gap-2 text-teal-600 mb-1">
              <Clock className="w-4 h-4" />
              <span className="font-bold">Total Time</span>
            </div>
            <div className="text-2xl font-black text-slate-900">
              {user?.totalPracticeMinutes || 45} <span className="text-xs font-normal text-slate-500">mins</span>
            </div>
            <span className="text-[10px] text-slate-400">Recorded active speech</span>
          </div>

          <div className="p-4 rounded-3xl border border-slate-200 bg-white shadow-2xs">
            <div className="flex items-center gap-2 text-cyan-600 mb-1">
              <Award className="w-4 h-4" />
              <span className="font-bold">Current Level</span>
            </div>
            <div className="text-2xl font-black text-slate-900 uppercase">
              {user?.currentLevel || 'B2'}
            </div>
            <span className="text-[10px] text-slate-400">Upper-Intermediate</span>
          </div>

          <div className="p-4 rounded-3xl border border-slate-200 bg-white shadow-2xs">
            <div className="flex items-center gap-2 text-purple-600 mb-1">
              <Target className="w-4 h-4" />
              <span className="font-bold">Target Band</span>
            </div>
            <div className="text-2xl font-black text-slate-900">
              {user?.targetBand || 7.5} <span className="text-xs font-normal text-slate-500">IELTS</span>
            </div>
            <span className="text-[10px] text-teal-600 font-semibold">On Track (+0.5 needed)</span>
          </div>
        </div>

        {/* Diagnostic Placement Test Card */}
        <div className="p-5 rounded-3xl bg-gradient-to-r from-teal-600 to-cyan-600 text-white shadow-md flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-teal-200" />
              <span className="text-xs font-bold uppercase tracking-wider text-teal-100">
                AI Diagnostic Placement Test
              </span>
            </div>
            <h3 className="text-base font-bold">Assess Your True Speaking Band in 3 Minutes</h3>
            <p className="text-xs text-teal-100 max-w-lg leading-relaxed">
              Read 3 phonetically balanced sentences and speak on 2 quick prompts to generate your benchmark CEFR level.
            </p>
          </div>

          <button
            onClick={() => alert('Starting Placement Test Session...')}
            className="py-2.5 px-5 rounded-2xl bg-white hover:bg-teal-50 text-teal-900 font-bold text-xs shadow-sm transition-all flex items-center gap-1.5 shrink-0"
          >
            <Play className="w-3.5 h-3.5 fill-teal-900" />
            <span>Start Test</span>
          </button>
        </div>

        {/* Charts Row: Recharts Line + Bar */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Progression Line Chart */}
          <div className="p-4 rounded-3xl border border-slate-200 bg-white shadow-2xs space-y-3">
            <div>
              <h4 className="font-bold text-xs text-slate-900">IELTS Band Progression Trajectory</h4>
              <p className="text-[10px] text-slate-400">Score evolution across consecutive practice sessions</p>
            </div>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={BAND_PROGRESSION_DATA} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="session" stroke="#94a3b8" fontSize={10} />
                  <YAxis domain={[5.0, 9.0]} stroke="#94a3b8" fontSize={10} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', fontSize: '11px', border: '1px solid #e2e8f0' }}
                  />
                  <Line type="monotone" dataKey="overall" stroke="#0D9488" strokeWidth={2.5} name="Overall Band" />
                  <Line type="monotone" dataKey="pronunciation" stroke="#0ea5e9" strokeWidth={1.5} name="Pronunciation" />
                  <Line type="monotone" dataKey="fluency" stroke="#8b5cf6" strokeWidth={1.5} name="Fluency" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Weekly Practice Bar Chart */}
          <div className="p-4 rounded-3xl border border-slate-200 bg-white shadow-2xs space-y-3">
            <div>
              <h4 className="font-bold text-xs text-slate-900">Weekly Practice Minutes</h4>
              <p className="text-[10px] text-slate-400">Daily time spent speaking this week</p>
            </div>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={WEEKLY_PRACTICE_DATA} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="day" stroke="#94a3b8" fontSize={10} />
                  <YAxis stroke="#94a3b8" fontSize={10} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', fontSize: '11px', border: '1px solid #e2e8f0' }}
                  />
                  <Bar dataKey="minutes" fill="#14B8A6" radius={[6, 6, 0, 0]} name="Minutes" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
