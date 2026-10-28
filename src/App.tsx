import React, { useEffect, useRef } from 'react';
import { MainLayout } from './presentation/components/layout/MainLayout';
import { supabase, isSupabaseConfigured } from './infrastructure/database/supabase/supabaseClient';
import { useTamSpeakStore } from './presentation/store';
import { container } from './di/DIContainer';
import { UserStorageService } from './infrastructure/security/UserStorageService';
import { AuthBoundaryGuard } from './infrastructure/security/AuthBoundaryGuard';
import { setPersonalApiKey } from './infrastructure/ai/AIService';

const ADMIN_EMAILS = ['tamphan@tamspeak.com', 'admin@tamspeak.com'];

export const App: React.FC = () => {
  const { setUser, loadUserDataForUser } = useTamSpeakStore();
  const previousUserIdRef = useRef<string | null>(null);

  // Startup: Purge legacy global un-isolated storage keys
  useEffect(() => {
    UserStorageService.runStorageMigrationCleanup();
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      return;
    }

    const loadUserProfile = async (userId: string, email: string, metadata: Record<string, any>) => {
      const lowerEmail = (email || '').toLowerCase();
      const isAdmin =
        ADMIN_EMAILS.includes(lowerEmail) ||
        lowerEmail.endsWith('@tamspeak.com') ||
        lowerEmail.includes('tamphan') ||
        metadata?.role === 'admin';

      // 1. Hydrate user-scoped preferences and custom topics
      loadUserDataForUser(userId);

      // 2. Hydrate user-scoped personal Gemini API key if present in user vault
      const userPersonalKey = UserStorageService.getUserPersonalApiKey(userId);
      if (userPersonalKey && userPersonalKey.trim().length > 0) {
        container.aiGateway.setPersonalKey?.('gemini', userPersonalKey.trim(), userId);
        setPersonalApiKey(userPersonalKey.trim());
      } else {
        container.aiGateway.setPersonalKey?.('gemini', null, userId);
        setPersonalApiKey(null);
      }

      // 3. Hydrate user-scoped voice overrides
      container.speechTTSEngine.loadSavedVoiceOverrides(userId);

      // 4. Hydrate user-scoped practice sessions
      container.sessionRepository.loadFromLocalStorage?.(userId);

      try {
        const dbUser = await container.userRepository.findById(userId);
        if (dbUser) {
          const isCompleted = UserStorageService.getUserOnboardingCompleted(userId);
          setUser({
            id: dbUser.id,
            email: dbUser.email.getValue(),
            displayName: dbUser.displayName,
            avatarUrl: dbUser.avatarUrl,
            targetBand: dbUser.targetBand.getValue(),
            currentLevel: dbUser.currentLevel || 'unrated',
            streakDays: dbUser.streakDays,
            lastPracticeDate: dbUser.lastPracticeDate,
            totalPracticeMinutes: dbUser.totalPracticeMinutes,
            role: isAdmin || dbUser.role === 'admin' ? 'admin' : 'user',
            hasCompletedOnboarding: isCompleted,
          });
          return;
        }
      } catch (err) {
        console.warn('Could not fetch user profile from Supabase DB, falling back to clean initialization:', err);
      }

      // Clean New User Initialization (Zero-Trust Clean Slate)
      const cleanDisplayName =
        metadata?.display_name || metadata?.full_name || email.split('@')[0] || 'Learner';

      setUser({
        id: userId,
        email,
        displayName: cleanDisplayName,
        avatarUrl: metadata?.avatar_url || null,
        targetBand: 7.5,
        currentLevel: 'unrated',
        streakDays: 0,
        lastPracticeDate: null,
        totalPracticeMinutes: 0,
        role: isAdmin ? 'admin' : 'user',
        hasCompletedOnboarding: false,
      });
    };

    // 1. Initial check for existing session in localStorage
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        previousUserIdRef.current = session.user.id;
        loadUserProfile(
          session.user.id,
          session.user.email || '',
          session.user.user_metadata || {}
        );
      } else {
        AuthBoundaryGuard.resetAllStoresOnAuthChange(previousUserIdRef.current);
        previousUserIdRef.current = null;
      }
    });

    // 2. Subscribe to auth state transitions
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session?.user) {
        AuthBoundaryGuard.resetAllStoresOnAuthChange(previousUserIdRef.current);
        previousUserIdRef.current = null;
      } else if (session.user) {
        if (previousUserIdRef.current && previousUserIdRef.current !== session.user.id) {
          AuthBoundaryGuard.resetAllStoresOnAuthChange(previousUserIdRef.current);
        }
        previousUserIdRef.current = session.user.id;
        loadUserProfile(
          session.user.id,
          session.user.email || '',
          session.user.user_metadata || {}
        );
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [setUser, loadUserDataForUser]);

  return <MainLayout />;
};

export default App;
