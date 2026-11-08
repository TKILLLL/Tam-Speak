import { UserStorageService, UserSettingsBundle } from './UserStorageService';

/** User-scoped settings facade used by AI and UI integrations. */
export class SettingsStore {
  public static readonly DEFAULT_SPEECH_RATE = 1;
  public static readonly MIN_SPEECH_RATE = 0.5;
  public static readonly MAX_SPEECH_RATE = 1.5;

  public static clampSpeechRate(rate: number): number {
    return Math.round(Math.min(this.MAX_SPEECH_RATE, Math.max(this.MIN_SPEECH_RATE, rate)) * 10) / 10;
  }

  public static getSpeechRate(userId?: string | null): number {
    return this.clampSpeechRate(this.getSettings(userId)?.speechRate ?? this.DEFAULT_SPEECH_RATE);
  }

  public static setSpeechRate(rate: number, userId?: string | null): void {
    const current = this.getSettings(userId) || {};
    this.setSettings({ ...current, speechRate: this.clampSpeechRate(rate) }, userId);
  }
  public static getSettings(userId?: string | null): UserSettingsBundle | null {
    return UserStorageService.getUserSettings(userId);
  }

  public static setSettings(settings: UserSettingsBundle, userId?: string | null): void {
    UserStorageService.setUserSettings(settings, userId);
  }

  public static getGeminiApiKey(userId?: string | null): string | null {
    return UserStorageService.getUserPersonalApiKey(userId);
  }

  public static setGeminiApiKey(key: string | null, userId?: string | null): void {
    UserStorageService.setUserPersonalApiKey(key, userId);
  }
}
