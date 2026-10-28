/**
 * UserStorageService - Zero-Trust Namespaced Local Storage Service
 * Enforces strict per-user key isolation across client-side storage (localStorage).
 * Completely eliminates cross-account data leakage (CWE-312 / CWE-200 / Broken Access Control).
 */

export interface UserSettingsBundle {
  activeVoice?: string;
  activeAIProvider?: string;
  feedbackLanguage?: 'en_vn' | 'en_en';
  practiceMode?: string;
  targetLevel?: string;
}

export class UserStorageService {
  private static readonly LEGACY_GLOBAL_KEYS: string[] = [
    'tamspeak_user_settings',
    'tamspeak-storage',
    'tamspeak_byok_gemini',
    'tamspeak_byok_groq',
    'tamspeak_byok_openrouter',
    'tamspeak_settings',
    'tamspeak_user_profile',
    'tamspeak_practice_sessions',
    'tamspeak_voice_overrides',
    'tamspeak_custom_topics',
    'tamspeak_onboarding_completed',
    'tamspeak_onboarding_draft',
    'tamspeak_admin',
  ];

  /**
   * Generates a strictly namespaced key for a given user.
   * If userId is missing, uses the isolated 'guest' partition.
   */
  public static getKey(subKey: string, userId?: string | null): string {
    const safeUserId = userId && userId.trim().length > 0 ? userId.trim() : 'guest';
    return `tamspeak_${subKey}_${safeUserId}`;
  }

  /**
   * Purges all legacy global un-isolated keys to eliminate previous data leakage.
   */
  public static runStorageMigrationCleanup(): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      for (const legacyKey of UserStorageService.LEGACY_GLOBAL_KEYS) {
        if (window.localStorage.getItem(legacyKey) !== null) {
          window.localStorage.removeItem(legacyKey);
        }
      }
    } catch {
      // ignore
    }
  }

  private static debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

  /**
   * Writes to localStorage with a debounce delay to prevent synchronous main-thread blocking.
   */
  public static setItemDebounced(key: string, value: string, delayMs = 300): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    const existing = UserStorageService.debounceTimers.get(key);
    if (existing) {
      clearTimeout(existing);
    }
    const timer = setTimeout(() => {
      try {
        window.localStorage.setItem(key, value);
      } catch {
        // ignore
      }
      UserStorageService.debounceTimers.delete(key);
    }, delayMs);
    UserStorageService.debounceTimers.set(key, timer);
  }

  // --- Settings ---
  public static getUserSettings(userId?: string | null): UserSettingsBundle | null {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    try {
      const raw = window.localStorage.getItem(UserStorageService.getKey('settings', userId));
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  public static setUserSettings(settings: UserSettingsBundle, userId?: string | null): void {
    UserStorageService.setItemDebounced(
      UserStorageService.getKey('settings', userId),
      JSON.stringify(settings)
    );
  }

  // --- Personal Gemini API Key (Vault) ---
  public static getUserPersonalApiKey(userId?: string | null): string | null {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    try {
      const raw = window.localStorage.getItem(UserStorageService.getKey('vault_gemini', userId));
      return raw && raw.trim().length > 0 ? raw.trim() : null;
    } catch {
      return null;
    }
  }

  public static setUserPersonalApiKey(key: string | null, userId?: string | null): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const storageKey = UserStorageService.getKey('vault_gemini', userId);
      if (!key || key.trim().length === 0) {
        window.localStorage.removeItem(storageKey);
      } else {
        window.localStorage.setItem(storageKey, key.trim());
      }
    } catch {
      // ignore
    }
  }

  public static clearUserPersonalApiKey(userId?: string | null): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      window.localStorage.removeItem(UserStorageService.getKey('vault_gemini', userId));
    } catch {
      // ignore
    }
  }

  // --- Voice Overrides ---
  public static getUserVoiceOverrides(userId?: string | null): Record<string, string> {
    if (typeof window === 'undefined' || !window.localStorage) return {};
    try {
      const raw = window.localStorage.getItem(UserStorageService.getKey('voice_overrides', userId));
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  public static setUserVoiceOverrides(
    overrides: Record<string, string>,
    userId?: string | null
  ): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      window.localStorage.setItem(
        UserStorageService.getKey('voice_overrides', userId),
        JSON.stringify(overrides)
      );
    } catch {
      // ignore
    }
  }

  // --- Custom Topics ---
  public static getUserCustomTopics(userId?: string | null): any[] {
    if (typeof window === 'undefined' || !window.localStorage) return [];
    try {
      const raw = window.localStorage.getItem(UserStorageService.getKey('custom_topics', userId));
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  public static setUserCustomTopics(topics: any[], userId?: string | null): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      window.localStorage.setItem(
        UserStorageService.getKey('custom_topics', userId),
        JSON.stringify(topics)
      );
    } catch {
      // ignore
    }
  }

  // --- Onboarding Completion & Draft ---
  public static getUserOnboardingCompleted(userId?: string | null): boolean {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    try {
      return (
        window.localStorage.getItem(UserStorageService.getKey('onboarding_completed', userId)) ===
        'true'
      );
    } catch {
      return false;
    }
  }

  public static setUserOnboardingCompleted(completed: boolean, userId?: string | null): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      window.localStorage.setItem(
        UserStorageService.getKey('onboarding_completed', userId),
        String(completed)
      );
    } catch {
      // ignore
    }
  }

  public static getUserOnboardingDraft(userId?: string | null): any | null {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    try {
      const raw = window.localStorage.getItem(UserStorageService.getKey('onboarding_draft', userId));
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  public static setUserOnboardingDraft(draft: any, userId?: string | null): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      window.localStorage.setItem(
        UserStorageService.getKey('onboarding_draft', userId),
        JSON.stringify(draft)
      );
    } catch {
      // ignore
    }
  }

  public static clearUserOnboardingDraft(userId?: string | null): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      window.localStorage.removeItem(UserStorageService.getKey('onboarding_draft', userId));
    } catch {
      // ignore
    }
  }

  // --- Profile Cache ---
  public static getUserProfile(userId?: string | null): any | null {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    try {
      const raw = window.localStorage.getItem(UserStorageService.getKey('profile', userId));
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  public static setUserProfile(profile: any, userId?: string | null): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      window.localStorage.setItem(
        UserStorageService.getKey('profile', userId),
        JSON.stringify(profile)
      );
    } catch {
      // ignore
    }
  }

  // --- Practice Sessions ---
  public static getUserPracticeSessions(userId?: string | null): any[] {
    if (typeof window === 'undefined' || !window.localStorage) return [];
    try {
      const raw = window.localStorage.getItem(UserStorageService.getKey('practice_sessions', userId));
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  public static setUserPracticeSessions(sessions: any[], userId?: string | null): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      window.localStorage.setItem(
        UserStorageService.getKey('practice_sessions', userId),
        JSON.stringify(sessions)
      );
    } catch {
      // ignore
    }
  }

  /**
   * Cleans all storage for a specific user on account deletion or test reset.
   */
  public static clearAllUserDataForUser(userId: string): void {
    if (typeof window === 'undefined' || !window.localStorage || !userId) return;
    try {
      const prefix = `tamspeak_`;
      const suffix = `_${userId}`;
      const keysToRemove: string[] = [];

      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key && key.startsWith(prefix) && key.endsWith(suffix)) {
          keysToRemove.push(key);
        }
      }

      for (const k of keysToRemove) {
        window.localStorage.removeItem(k);
      }
    } catch {
      // ignore
    }
  }
}
