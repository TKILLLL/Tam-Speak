export interface StoredAudioPayload {
  id: string;
  userId: string;
  sessionId: string;
  blob: Blob;
  mimeType: string;
  durationSeconds: number;
  recordedAt: Date;
  isBookmarked: boolean;
  ttlExpiresAt: Date;
}

export interface ILocalAudioRepository {
  saveAudio(params: {
    id: string;
    userId: string;
    sessionId: string;
    blob: Blob;
    mimeType: string;
    durationSeconds: number;
    isBookmarked?: boolean;
  }): Promise<string>;

  getAudio(id: string): Promise<StoredAudioPayload | null>;
  setBookmark(id: string, isBookmarked: boolean): Promise<void>;
  purgeExpiredAudio(userId?: string): Promise<number>;
  clearUserData(userId: string): Promise<void>;
}
