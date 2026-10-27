import React, { useEffect } from 'react';
import { MainLayout } from './presentation/components/layout/MainLayout';
import { supabase, isSupabaseConfigured } from './infrastructure/database/supabase/supabaseClient';
import { useTamSpeakStore } from './presentation/store';
import { container } from './di/DIContainer';

export const App: React.FC = () => {
  const { setUser } = useTamSpeakStore();

  // Startup: Hydrate personal BYOK API keys from localStorage into AI Gateway
  useEffect(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      const savedGemini = window.localStorage.getItem('tamspeak_byok_gemini');
      if (savedGemini && savedGemini.trim().length > 0) {
        container.aiGateway.setPersonalKey?.('gemini', savedGemini.trim());
      }
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      return;
    }

    const loadUserProfile = async (userId: string, email: string, metadata: Record<string, any>) => {
      const isAdmin =
        email.toLowerCase().includes('tamphan') ||
        metadata?.role === 'admin' ||
        (typeof window !== 'undefined' && localStorage.getItem('tamspeak_admin') === 'true');

      try {
        const dbUser = await container.userRepository.findById(userId);
        if (dbUser) {
          setUser({
            id: dbUser.id,
            email: dbUser.email.getValue(),
            displayName: dbUser.displayName,
            avatarUrl: dbUser.avatarUrl,
            targetBand: dbUser.targetBand.getValue(),
            currentLevel: dbUser.currentLevel,
            streakDays: dbUser.streakDays,
            lastPracticeDate: dbUser.lastPracticeDate,
            totalPracticeMinutes: dbUser.totalPracticeMinutes,
            role: isAdmin || dbUser.role === 'admin' ? 'admin' : 'user',
          });
          return;
        }
      } catch (err) {
        console.warn('Could not fetch user profile from Supabase DB, falling back to metadata:', err);
      }

      // Fallback to auth metadata if DB query fails or profile is still provisioning
      setUser({
        id: userId,
        email,
        displayName: metadata?.display_name || metadata?.full_name || email.split('@')[0] || 'Learner',
        avatarUrl: metadata?.avatar_url || null,
        targetBand: 7.5,
        currentLevel: 'b2',
        streakDays: 1,
        lastPracticeDate: new Date().toISOString().split('T')[0] ?? null,
        totalPracticeMinutes: 0,
        role: isAdmin ? 'admin' : 'user',
      });
    };

    // 1. Initial check for existing session in localStorage
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        loadUserProfile(
          session.user.id,
          session.user.email || '',
          session.user.user_metadata || {}
        );
      } else {
        setUser(null);
      }
    });

    // 2. Subscribe to auth changes (Sign In, Sign Out, Token Refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        loadUserProfile(
          session.user.id,
          session.user.email || '',
          session.user.user_metadata || {}
        );
      } else {
        setUser(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [setUser]);

  return <MainLayout />;
};

export default App;
