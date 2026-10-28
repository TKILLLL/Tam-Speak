/**
 * SharedAudioContext
 * Singleton manager for browser AudioContext instances.
 * Chrome and Safari strictly limit tabs to at most 6 AudioContext instances.
 * This singleton guarantees exactly one AudioContext instance is reused across the entire app lifecycle.
 */

export class SharedAudioContext {
  private static instance: AudioContext | null = null;
  private static activeListeners: Set<(level: number) => void> = new Set();
  private static currentAudioLevel = 0;

  /**
   * Retrieves or initializes the shared browser AudioContext.
   */
  public static getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;

    if (!SharedAudioContext.instance || SharedAudioContext.instance.state === 'closed') {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

      if (AudioCtx) {
        SharedAudioContext.instance = new AudioCtx();
      }
    }

    if (SharedAudioContext.instance && SharedAudioContext.instance.state === 'suspended') {
      SharedAudioContext.instance.resume().catch(() => {});
    }

    return SharedAudioContext.instance;
  }

  /**
   * Broadcasts real-time audio amplitude to registered 60fps listeners
   * without triggering React state updates or virtual DOM re-renders.
   */
  public static broadcastLevel(level: number): void {
    SharedAudioContext.currentAudioLevel = level;
    SharedAudioContext.activeListeners.forEach((listener) => {
      try {
        listener(level);
      } catch {
        // Safe ignore
      }
    });
  }

  public static getCurrentLevel(): number {
    return SharedAudioContext.currentAudioLevel;
  }

  public static subscribeLevel(listener: (level: number) => void): () => void {
    SharedAudioContext.activeListeners.add(listener);
    return () => {
      SharedAudioContext.activeListeners.delete(listener);
    };
  }
}
