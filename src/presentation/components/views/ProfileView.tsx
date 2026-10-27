import React, { useState } from 'react';
import {
  User,
  Mail,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Clock,
  Flame,
} from 'lucide-react';
import { useTamSpeakStore } from '../../store';
import { supabase } from '../../../infrastructure/database/supabase/supabaseClient';
import { SkillLevel } from '../../../domain/entities/User';

export const ProfileView: React.FC = () => {
  const { user, setUser } = useTamSpeakStore();

  const [displayName, setDisplayName] = useState(user?.displayName || 'Learner');
  const [targetGoal, setTargetGoal] = useState<'ielts' | 'toeic' | 'business' | 'daily'>('ielts');
  const [targetBand, setTargetBand] = useState<number>(user?.targetBand || 7.5);
  const [currentLevel, setCurrentLevel] = useState<SkillLevel>(user?.currentLevel || 'b2');

  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Password Change
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMessage(null);

    try {
      if (user) {
        const updatedUser = {
          ...user,
          displayName: displayName.trim(),
          targetBand,
          currentLevel,
        };
        setUser(updatedUser);

        // Update in Supabase profiles table if authenticated
        if (user.id && user.id !== 'guest-user') {
          await supabase
            .from('profiles')
            .update({
              display_name: displayName.trim(),
              target_band: targetBand,
              current_level: currentLevel,
            })
            .eq('id', user.id);
        }
      }

      setProfileMessage({ type: 'success', text: 'Thông tin hồ sơ đã được cập nhật thành công.' });
      setTimeout(() => setProfileMessage(null), 3000);
    } catch (err) {
      setProfileMessage({ type: 'error', text: 'Không thể cập nhật hồ sơ, vui lòng thử lại.' });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMessage(null);

    if (newPassword.length < 8) {
      setPasswordMessage({ type: 'error', text: 'Mật khẩu mới phải có tối thiểu 8 ký tự.' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'Mật khẩu xác nhận không khớp với mật khẩu mới.' });
      return;
    }

    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        setPasswordMessage({ type: 'error', text: error.message });
      } else {
        setPasswordMessage({ type: 'success', text: 'Đổi mật khẩu thành công.' });
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => setPasswordMessage(null), 3000);
      }
    } catch {
      setPasswordMessage({ type: 'error', text: 'Có lỗi xảy ra khi đổi mật khẩu.' });
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <div className="flex-1 p-6 md:p-8 overflow-y-auto bg-slate-50 select-none">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
            User Profile & Learning Target
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage your personal credentials, examination goals, and target fluency band.
          </p>
        </div>

        {/* User Card Overview */}
        <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-2xs flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-slate-900 text-white font-extrabold text-xl flex items-center justify-center shadow-xs">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">{displayName}</h3>
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200">
                  {user?.role === 'admin' ? 'Admin' : 'Member'}
                </span>
              </div>
              <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                <span>{user?.email || 'learner@tamspeak.app'}</span>
              </p>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-4 text-xs font-mono">
            <div className="text-right">
              <span className="text-[10px] text-slate-400 block font-sans">Practice Streak</span>
              <span className="font-bold text-orange-600 flex items-center gap-1 justify-end">
                <Flame className="w-3.5 h-3.5 fill-orange-500 text-orange-500" />
                {user?.streakDays || 1} Days
              </span>
            </div>
            <div className="text-right border-l border-slate-200 pl-4">
              <span className="text-[10px] text-slate-400 block font-sans">Active Time</span>
              <span className="font-bold text-teal-700 flex items-center gap-1 justify-end">
                <Clock className="w-3.5 h-3.5 text-teal-600" />
                {user?.totalPracticeMinutes || 0} mins
              </span>
            </div>
          </div>
        </div>

        {/* Profile Settings Form */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs p-6 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <User className="w-4 h-4 text-teal-600" />
            <h4 className="font-bold text-sm text-slate-800">Thông tin cá nhân & Mục tiêu học tập</h4>
          </div>

          {profileMessage && (
            <div
              className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                profileMessage.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}
            >
              {profileMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{profileMessage.text}</span>
            </div>
          )}

          <form onSubmit={handleSaveProfile} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Display Name */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">Tên hiển thị</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
                />
              </div>

              {/* Email (Read-Only) */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">Email đăng nhập</label>
                <input
                  type="email"
                  value={user?.email || 'learner@tamspeak.app'}
                  disabled
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-400 font-medium cursor-not-allowed"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Target Exam Goal */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">Mục tiêu luyện tập</label>
                <select
                  value={targetGoal}
                  onChange={(e) => setTargetGoal(e.target.value as 'ielts' | 'toeic' | 'business' | 'daily')}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white font-medium focus:ring-2 focus:ring-teal-500"
                >
                  <option value="ielts">IELTS Speaking (Academic/General)</option>
                  <option value="toeic">TOEIC Speaking</option>
                  <option value="business">Phỏng vấn & Giao tiếp công sở</option>
                  <option value="daily">Giao tiếp hàng ngày (Free Chat)</option>
                </select>
              </div>

              {/* Target Band */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">Target Band mong muốn</label>
                <select
                  value={targetBand}
                  onChange={(e) => setTargetBand(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white font-medium focus:ring-2 focus:ring-teal-500"
                >
                  <option value={5.5}>Band 5.5 (Modest)</option>
                  <option value={6.0}>Band 6.0 (Competent)</option>
                  <option value={6.5}>Band 6.5 (Competent +)</option>
                  <option value={7.0}>Band 7.0 (Good)</option>
                  <option value={7.5}>Band 7.5 (Good +)</option>
                  <option value={8.0}>Band 8.0 (Very Good)</option>
                  <option value={8.5}>Band 8.5 (Expert)</option>
                  <option value={9.0}>Band 9.0 (Native-like)</option>
                </select>
              </div>

              {/* Current Level */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">Trình độ hiện tại (CEFR)</label>
                <select
                  value={currentLevel}
                  onChange={(e) => setCurrentLevel(e.target.value as SkillLevel)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white font-medium focus:ring-2 focus:ring-teal-500 uppercase"
                >
                  <option value="a2">A2 - Sơ cấp</option>
                  <option value="b1">B1 - Trung cấp</option>
                  <option value="b2">B2 - Trung cao cấp</option>
                  <option value="c1">C1 - Cao cấp</option>
                  <option value="c2">C2 - Thành thạo</option>
                </select>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={savingProfile}
                className="py-2.5 px-6 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-xs transition-all flex items-center gap-1.5"
              >
                {savingProfile ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Đang lưu...</span>
                  </>
                ) : (
                  <span>Lưu thay đổi</span>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Change Password Card */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs p-6 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <KeyRound className="w-4 h-4 text-slate-700" />
            <h4 className="font-bold text-sm text-slate-800">Đổi mật khẩu</h4>
          </div>

          {passwordMessage && (
            <div
              className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                passwordMessage.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}
            >
              {passwordMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{passwordMessage.text}</span>
            </div>
          )}

          <form onSubmit={handleChangePassword} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Mật khẩu mới</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Tối thiểu 8 ký tự"
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Xác nhận mật khẩu mới</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Nhập lại mật khẩu mới"
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={changingPassword}
                className="py-2.5 px-6 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs transition-all flex items-center gap-1.5"
              >
                {changingPassword ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Đang cập nhật...</span>
                  </>
                ) : (
                  <span>Cập nhật mật khẩu</span>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};