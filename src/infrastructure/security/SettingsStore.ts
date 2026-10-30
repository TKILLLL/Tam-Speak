import { UserStorageService, UserSettingsBundle } from './UserStorageService';

/** User-scoped settings facade used by AI and UI integrations. */
export class SettingsStore {
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
