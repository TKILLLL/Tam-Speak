import {
  ILocalAudioRepository,
  StoredAudioPayload,
} from '../../domain/interfaces/ILocalAudioRepository';
import { dexieDb } from '../database/dexie/TamSpeakDexieDatabase';

export class DexieLocalAudioRepository implements ILocalAudioRepository {
  public async saveAudio(params: {
    id: string;
    userId: string;
    sessionId: string;
    blob: Blob;
    mimeType: string;
    durationSeconds: number;
    isBookmarked?: boolean;
  }): Promise<string> {
    return await dexieDb.saveAudioRecording({
      id: params.id,
      userId: params.userId,
      sessionId: params.sessionId,
      audioBlob: params.blob,
      mimeType: params.mimeType,
      durationSeconds: params.durationSeconds,
      isBookmarked: params.isBookmarked,
    });
  }

  public async getAudio(id: string, userId?: string): Promise<StoredAudioPayload | null> {
    const record = await dexieDb.audioRecordings.get(id);
    if (!record) return null;
    if (userId && record.userId !== userId) {
      return null;
    }

    return {
      id: record.id,
      userId: record.userId,
      sessionId: record.sessionId,
      blob: record.audioBlob,
      mimeType: record.mimeType,
      durationSeconds: record.durationSeconds,
      recordedAt: record.recordedAt,
      isBookmarked: record.isBookmarked,
      ttlExpiresAt: record.ttlExpiresAt,
    };
  }

  public async setBookmark(id: string, isBookmarked: boolean): Promise<void> {
    await dexieDb.setBookmarkStatus(id, isBookmarked);
  }

  public async purgeExpiredAudio(userId?: string): Promise<number> {
    return await dexieDb.purgeExpiredAudioRecordings(userId);
  }

  public async clearUserData(userId: string): Promise<void> {
    await dexieDb.clearUserDataOnLogout(userId);
  }
}
