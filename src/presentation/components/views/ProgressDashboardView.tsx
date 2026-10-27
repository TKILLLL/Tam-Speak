import React, { useState, useEffect } from 'react';
import {
  Flame,
  Clock,
  Target,
  Award,
  Play,
  Info,
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
import { container } from '../../../di/DIContainer';
import { PracticeSession } from '../../../domain/entities/PracticeSession';
import { AggregatedUserStats } from '../../../domain/interfaces/ISessionRepository';

export const ProgressDashboardView: React.FC = () => {
  const { user, activeSession, setCurrentView } = useTamSpeakStore();
  const userId = user?.id || 'guest-user';

  const [sessions, setSessions] = useState<PracticeSession[]>([]);
  const [stats, setStats] = useState<AggregatedUserStats | null>(null);

  useEffect(() => {
    let isMounted = true;
    const loadStats = async () => {
      try {
        const [recentSessions, userStats] = await Promise.all([
          container.sessionRepository.findRecentByUserId(userId, 30),
          container.sessionRepository.getAggregatedStats(userId),
        ]);
        if (isMounted) {
          setSessions(recentSessions);
          setStats(userStats);
        }
      } catch (err) {
        console.warn('Failed to load session progress:', err);
      }
    };

    loadStats();
    return () => {
      isMounted = false;
    };
  }, [userId, activeSession]);

  // Compute 100% Real Weekly Data (Mon - Sun)
  const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const weeklyData = daysOfWeek.map((day) => ({ day, minutes: 0 }));

  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  sessions.forEach((s) => {
    const sessionDate = new Date(s.createdAt);
    if (sessionDate >= oneWeekAgo) {
      const jsDay = sessionDate.getDay();
      const dayIndex = jsDay === 0 ? 6 : jsDay - 1;
      const mins = Math.max(1, Math.round(s.durationSeconds / 60));
      weeklyData[dayIndex]!.minutes += mins;
    }
  });

  // Compute 100% Real Band Progression
  const scoredSessions = sessions
    .filter((s) => s.overallScore !== null)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const progressionData = scoredSessions.slice(-8).map((s, idx) => ({
    session: `S${idx + 1}`,
    overall: s.overallScore ? Number(s.overallScore.getValue().toFixed(1)) : 0,
    pronunciation: s.pronunciationScore ? Number(s.pronunciationScore.getValue().toFixed(1)) : 0,
    fluency: s.fluencyScore ? Number(s.fluencyScore.getValue().toFixed(1)) : 0,
  }));

  const totalMinutes =
    user?.totalPracticeMinutes ??
    stats?.totalDurationMinutes ??
    sessions.reduce((acc, s) => acc + Math.max(1, Math.round(s.durationSeconds / 60)), 0);

  const averageBandDisplay = stats?.averageOverallBand
    ? stats.averageOverallBand.getValue().toFixed(1)
    : scoredSessions.length > 0
    ? (
        scoredSessions.reduce((sum, s) => sum + s.overallScore!.getValue(), 0) / scoredSessions.length
      ).toFixed(1)
    : 'Chưa đánh giá';

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
            <div className="text-2xl font-black text-slate-900">
              {user?.streakDays || (sessions.length > 0 ? 1 : 0)} Days
            </div>
            <span className="text-[10px] text-slate-400">Keep practicing daily</span>
          </div>

          <div className="p-4 rounded-3xl border border-slate-200 bg-white shadow-2xs">
            <div className="flex items-center gap-2 text-teal-600 mb-1">
              <Clock className="w-4 h-4" />
              <span className="font-bold">Total Time</span>
            </div>
            <div className="text-2xl font-black text-slate-900">
              {totalMinutes} <span className="text-xs font-normal text-slate-500">mins</span>
            </div>
            <span className="text-[10px] text-slate-400">Recorded active speech</span>
          </div>

          <div className="p-4 rounded-3xl border border-slate-200 bg-white shadow-2xs">
            <div className="flex items-center gap-2 text-cyan-600 mb-1">
              <Award className="w-4 h-4" />
              <span className="font-bold">Average Band</span>
            </div>
            <div className="text-2xl font-black text-slate-900">
              {averageBandDisplay}
            </div>
            <span className="text-[10px] text-slate-400">IELTS Composite</span>
          </div>

          <div className="p-4 rounded-3xl border border-slate-200 bg-white shadow-2xs">
            <div className="flex items-center gap-2 text-purple-600 mb-1">
              <Target className="w-4 h-4" />
              <span className="font-bold">Target Band</span>
            </div>
            <div className="text-2xl font-black text-slate-900">
              {user?.targetBand || 7.5} <span className="text-xs font-normal text-slate-500">IELTS</span>
            </div>
            <span className="text-[10px] text-teal-600 font-semibold">Target Goal</span>
          </div>
        </div>

        {/* Diagnostic Placement Test Card */}
        <div className="p-5 rounded-3xl bg-gradient-to-r from-teal-600 to-cyan-600 text-white shadow-md flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-teal-100">
              Diagnostic Placement Test
            </span>
            <h3 className="text-base font-bold">Assess Your True Speaking Band in 3 Minutes</h3>
            <p className="text-xs text-teal-100 max-w-lg leading-relaxed">
              Read 3 phonetically balanced sentences and speak on 2 quick prompts to generate your benchmark CEFR level.
            </p>
          </div>

          <button
            onClick={() => setCurrentView('conversation')}
            className="py-2.5 px-5 rounded-2xl bg-white hover:bg-teal-50 text-teal-900 font-bold text-xs shadow-xs transition-all flex items-center gap-1.5 shrink-0"
          >
            <Play className="w-3.5 h-3.5 fill-teal-900" />
            <span>Start Practice</span>
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
              {progressionData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={progressionData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="session" stroke="#94a3b8" fontSize={10} />
                    <YAxis domain={[4.0, 9.0]} stroke="#94a3b8" fontSize={10} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', fontSize: '11px', border: '1px solid #e2e8f0' }}
                    />
                    <Line type="monotone" dataKey="overall" stroke="#0D9488" strokeWidth={2.5} name="Overall Band" />
                    <Line type="monotone" dataKey="pronunciation" stroke="#0ea5e9" strokeWidth={1.5} name="Pronunciation" />
                    <Line type="monotone" dataKey="fluency" stroke="#8b5cf6" strokeWidth={1.5} name="Fluency" />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-4 text-slate-400">
                  <Info className="w-8 h-8 mb-2 text-slate-300 stroke-1" />
                  <p className="font-semibold text-xs text-slate-600">Chưa có bài thi nào được chấm điểm</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Hãy hoàn thành và chấm điểm phiên nói trong Conversation Practice để ghi nhận tiến độ.
                  </p>
                </div>
              )}
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
                <BarChart data={weeklyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
