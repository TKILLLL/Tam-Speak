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
  const {
    setUser,
    loadUserDataForUser,
    setAuthReady,
    openAuthModal,
    setAuthRequired,
    closeAuthModal,
    setGuestTrialTurns,
  } = useTamSpeakStore();
  const previousUserIdRef = useRef<string | null>(null);

  // Startup: Purge legacy global un-isolated storage keys
  useEffect(() => {
    UserStorageService.runStorageMigrationCleanup();
  }, []);

  useEffect(() => {
    const registerVisit = () => {
      try {
        const returning = window.localStorage.getItem('tamspeak_visited_before') === 'true';
        window.localStorage.setItem('tamspeak_visited_before', 'true');
        return returning;
      } catch {
        return false;
      }
    };

    const loadUserProfile = async (userId: string, email: string, metadata: Record<string, any>) => {
      const lowerEmail = (email || '').toLowerCase();
      const isAdmin =
        ADMIN_EMAILS.includes(lowerEmail) ||
        lowerEmail.endsWith('@tamspeak.com') ||
        lowerEmail.includes('tamphan') ||
        metadata?.role === 'admin';

      // 1. Hydrate user-scoped preferences and custom topics
      loadUserDataForUser(userId);
      setAuthRequired(false);
      closeAuthModal();

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

    // Initialize visitor access and resume any existing authenticated session.
    const isReturningVisitor = registerVisit();
    try {
      const storedTrialTurns = Number(window.localStorage.getItem('tamspeak_guest_trial_turns') || 0);
      setGuestTrialTurns(Number.isFinite(storedTrialTurns) ? storedTrialTurns : 0);
    } catch {
      setGuestTrialTurns(0);
    }
    if (!isSupabaseConfigured()) {
      if (isReturningVisitor) {
        setAuthRequired(true);
        openAuthModal('signin', true);
      }
      setAuthReady(true);
      return;
    }

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        previousUserIdRef.current = session.user.id;
        await loadUserProfile(
          session.user.id,
          session.user.email || '',
          session.user.user_metadata || {}
        );
      } else if (isReturningVisitor) {
        setAuthRequired(true);
        openAuthModal('signin', true);
      } else {
        previousUserIdRef.current = null;
      }
      setAuthReady(true);
    }).catch(() => {
      if (isReturningVisitor) {
        setAuthRequired(true);
        openAuthModal('signin', true);
      }
      setAuthReady(true);
    });

    // 2. Subscribe to auth state transitions
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session?.user) {
        if (event === 'SIGNED_OUT') {
          AuthBoundaryGuard.resetAllStoresOnAuthChange(previousUserIdRef.current);
          setAuthRequired(true);
          openAuthModal('signin', true);
          setAuthReady(true);
          previousUserIdRef.current = null;
        }
      } else if (session.user) {
        if (previousUserIdRef.current && previousUserIdRef.current !== session.user.id) {
          AuthBoundaryGuard.resetAllStoresOnAuthChange(previousUserIdRef.current);
        }
        previousUserIdRef.current = session.user.id;
        void loadUserProfile(
          session.user.id,
          session.user.email || '',
          session.user.user_metadata || {}
        ).finally(() => setAuthReady(true));
        setAuthRequired(false);
        closeAuthModal();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [setUser, loadUserDataForUser, setAuthReady, openAuthModal, setAuthRequired, closeAuthModal, setGuestTrialTurns]);

  return <MainLayout />;
};

export default App;
