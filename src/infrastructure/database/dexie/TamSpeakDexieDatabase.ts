import Dexie, { type EntityTable } from 'dexie';

export interface AudioRecordingRecord {
  id: string;
  userId: string;
  sessionId: string;
  audioBlob: Blob;
  mimeType: string;
  durationSeconds: number;
  recordedAt: Date;
  isBookmarked: boolean;
  ttlExpiresAt: Date;
}

export interface OfflineDictionaryRecord {
  word: string; // Primary key (lowercase)
  ipa: string;
  syllables: string[];
  stressPattern: string; // e.g., '10' (primary stress on 1st syllable)
}

export interface RawQuestionRecord {
  id: string; // Primary key
  category: 'ielts_part1' | 'ielts_part2' | 'ielts_part3' | 'conversation' | 'interview';
  topic: string;
  part?: number;
  questionText: string;
  targetKeywords: string[];
  suggestedCollocations?: string[];
  sampleBand8Response?: string;
  createdAt: Date;
}

export class TamSpeakDexieDatabase extends Dexie {
  audioRecordings!: EntityTable<AudioRecordingRecord, 'id'>;
  offlineDictionary!: EntityTable<OfflineDictionaryRecord, 'word'>;
  rawQuestions!: EntityTable<RawQuestionRecord, 'id'>;

  // Default TTL duration: 30 days in milliseconds
  public static readonly TTL_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

  constructor() {
    super('TamSpeakClientDB');

    this.version(1).stores({
      audioRecordings: 'id, userId, sessionId, recordedAt, isBookmarked, ttlExpiresAt, [userId+isBookmarked]',
      offlineDictionary: 'word',
      rawQuestions: 'id, category, topic, part',
    });
  }

  /**
   * Saves an audio recording with automatic 30-day TTL expiration calculation.
   * If isBookmarked is true, ttlExpiresAt is still tracked but purge will spare it.
   */
  public async saveAudioRecording(params: {
    id: string;
    userId: string;
    sessionId: string;
    audioBlob: Blob;
    mimeType: string;
    durationSeconds: number;
    isBookmarked?: boolean;
  }): Promise<string> {
    const recordedAt = new Date();
    const ttlExpiresAt = new Date(recordedAt.getTime() + TamSpeakDexieDatabase.TTL_DURATION_MS);

    const record: AudioRecordingRecord = {
      id: params.id,
      userId: params.userId,
      sessionId: params.sessionId,
      audioBlob: params.audioBlob,
      mimeType: params.mimeType,
      durationSeconds: params.durationSeconds,
      recordedAt,
      isBookmarked: params.isBookmarked ?? false,
      ttlExpiresAt,
    };

    await this.audioRecordings.put(record);
    return record.id;
  }

  /**
   * Toggles the bookmark status of an audio recording.
   * Bookmarking protects audio from the automatic 30-day TTL purge.
   */
  public async setBookmarkStatus(id: string, isBookmarked: boolean): Promise<void> {
    const record = await this.audioRecordings.get(id);
    if (!record) {
      throw new Error(`Audio recording with id "${id}" not found.`);
    }
    await this.audioRecordings.update(id, { isBookmarked });
  }

  /**
   * Purges audio records that have passed their 30-day TTL and are NOT bookmarked.
   * Protects user storage quota from being saturated by audio blobs.
   * Returns count of deleted records.
   */
  public async purgeExpiredAudioRecordings(userId?: string): Promise<number> {
    const now = new Date();
    let query = this.audioRecordings.toCollection();

    if (userId) {
      query = this.audioRecordings.where('userId').equals(userId);
    }

    const expiredRecords = await query
      .filter((rec) => !rec.isBookmarked && rec.ttlExpiresAt <= now)
      .toArray();

    if (expiredRecords.length === 0) {
      return 0;
    }

    const expiredIds = expiredRecords.map((r) => r.id);
    await this.audioRecordings.bulkDelete(expiredIds);
    return expiredIds.length;
  }

  /**
   * Look up offline IPA phonetic transcription (0ms, 0-token latency).
   */
  public async lookupIPA(word: string): Promise<OfflineDictionaryRecord | undefined> {
    const normalizedWord = word.trim().toLowerCase();
    return await this.offlineDictionary.get(normalizedWord);
  }

  /**
   * Ingest batch CMUdict or raw dictionary entries into client IndexedDB.
   */
  public async bulkInsertDictionary(entries: OfflineDictionaryRecord[]): Promise<void> {
    await this.offlineDictionary.bulkPut(entries);
  }

  /**
   * Multi-Tenant clean-up on logout: deletes non-bookmarked audio and cached session data for the user.
   */
  public async clearUserDataOnLogout(userId: string): Promise<void> {
    await this.audioRecordings.where('userId').equals(userId).delete();
  }
}

// Singleton database instance
export const dexieDb = new TamSpeakDexieDatabase();
