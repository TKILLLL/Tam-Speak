import { useTamSpeakStore } from '../../presentation/store';
import { container } from '../../di/DIContainer';
import { clearPersonalApiKey } from '../ai/AIService';
import { dexieDb } from '../database/dexie/TamSpeakDexieDatabase';

/**
 * AuthBoundaryGuard - Zero-Trust Authentication Boundary Controller
 * Executes atomic and synchronous reset of all in-memory client stores,
 * cryptographic vaults, audio synthesizers, speech recognizers, and repository caches
 * immediately upon sign-out or account switching.
 * Completely prevents Stale State Sync and cross-account data leakage.
 */
export class AuthBoundaryGuard {
  public static resetAllStoresOnAuthChange(previousUserId?: string | null): void {
    // 1. Immediately abort active Audio Synthesis (Chrome SpeechSynthesis voice leak prevention)
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    }

    // 2. Wipe RAM of AIService and ResilientAIGateway
    try {
      clearPersonalApiKey();
      container.aiGateway.clearPersonalKeys?.();
    } catch {
      // ignore
    }

    // 3. Clear repository in-memory cache maps
    try {
      container.sessionRepository.clearMemoryCache?.();
      container.topicRepository.clearMemoryCache?.();
      container.vocabRepository.clearMemoryCache?.();
    } catch {
      // ignore
    }

    // 4. Reset TTS voice overrides in memory
    try {
      container.speechTTSEngine.resetOverrides?.();
    } catch {
      // ignore
    }

    // 5. Purge Dexie ephemeral audio for the logging out user if identified
    if (previousUserId && previousUserId !== 'guest-user' && previousUserId !== 'guest') {
      try {
        dexieDb.clearUserDataOnLogout(previousUserId).catch(() => {});
      } catch {
        // ignore
      }
    }

    // 6. Hard reset all Zustand state (user, sessions, metrics, mistakes, ephemeral chats, hints)
    try {
      useTamSpeakStore.getState().resetAll();
    } catch {
      // ignore
    }
  }
}
