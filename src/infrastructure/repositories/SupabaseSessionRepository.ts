import { SupabaseClient } from '@supabase/supabase-js';
import { ISessionRepository, AggregatedUserStats } from '../../domain/interfaces/ISessionRepository';
import {
  PracticeSession,
  PracticeMode,
  SessionStatus,
  DialogueTurn,
  DetailedFeedbackPayload,
} from '../../domain/entities/PracticeSession';
import { BandScore } from '../../domain/value-objects/BandScore';
import { SpeechMetrics } from '../../domain/value-objects/SpeechMetrics';

interface PracticeSessionRow {
  id: string;
  user_id: string;
  topic_id: string | null;
  mode: string;
  duration_seconds: number;
  overall_score: number | null;
  pronunciation_score: number | null;
  fluency_score: number | null;
  lexical_score: number | null;
  grammar_score: number | null;
  words_per_minute: number | null;
  hesitation_count: number | null;
  transcript_dialogue: DialogueTurn[];
  detailed_feedback: DetailedFeedbackPayload;
  ai_provider_used: string | null;
  created_at: string;
}

export class SupabaseSessionRepository implements ISessionRepository {
  private readonly inMemorySessions = new Map<string, PracticeSession>();

  constructor(private readonly client: SupabaseClient) {
    this.loadFromLocalStorage();
  }

  private loadFromLocalStorage(): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const saved = window.localStorage.getItem('tamspeak_practice_sessions');
      if (saved) {
        const rows: PracticeSessionRow[] = JSON.parse(saved);
        if (Array.isArray(rows)) {
          for (const row of rows) {
            const domainSession = this.mapToDomain(row);
            this.inMemorySessions.set(domainSession.id, domainSession);
          }
        }
      }
    } catch (err) {
      console.warn('Failed to load local sessions:', err);
    }
  }

  private persistToLocalStorage(): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const rows = Array.from(this.inMemorySessions.values()).map((s) => this.mapToRow(s));
      window.localStorage.setItem('tamspeak_practice_sessions', JSON.stringify(rows));
    } catch (err) {
      console.warn('Failed to persist local sessions:', err);
    }
  }

  private isValidUUID(str: string): boolean {
    if (!str || typeof str !== 'string') return false;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str.trim());
  }

  public async findById(id: string): Promise<PracticeSession | null> {
    if (this.inMemorySessions.has(id)) {
      return this.inMemorySessions.get(id)!;
    }

    if (!this.isValidUUID(id)) {
      return null;
    }

    try {
      const { data, error } = await this.client
        .from('practice_sessions')
        .select('*')
        .eq('id', id)
        .maybeSingle<PracticeSessionRow>();

      if (error || !data) return null;
      const session = this.mapToDomain(data);
      this.inMemorySessions.set(session.id, session);
      return session;
    } catch {
      return null;
    }
  }

  public async findRecentByUserId(userId: string, limit = 20): Promise<PracticeSession[]> {
    const memoryMatches = Array.from(this.inMemorySessions.values())
      .filter((s) => s.userId === userId || userId === 'guest-user' || !s.userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    if (!this.isValidUUID(userId)) {
      return memoryMatches.slice(0, limit);
    }

    try {
      const { data, error } = await this.client
        .from('practice_sessions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit)
        .returns<PracticeSessionRow[]>();

      if (error || !data || data.length === 0) return memoryMatches.slice(0, limit);
      const dbSessions = data.map((row) => this.mapToDomain(row));
      return dbSessions;
    } catch {
      return memoryMatches.slice(0, limit);
    }
  }

  public async save(session: PracticeSession): Promise<void> {
    // 1. Always cache in-memory and persist locally for zero-latency local operation
    this.inMemorySessions.set(session.id, session);
    this.persistToLocalStorage();

    // 2. Sync to Supabase if valid UUID
    if (this.isValidUUID(session.id) && this.isValidUUID(session.userId)) {
      try {
        const row = this.mapToRow(session);
        await this.client.from('practice_sessions').insert(row);
      } catch (err) {
        console.warn('Supabase practice_sessions sync skipped/failed:', err);
      }
    }
  }

  public async update(session: PracticeSession): Promise<void> {
    // 1. Always update in-memory and persist locally
    this.inMemorySessions.set(session.id, session);
    this.persistToLocalStorage();

    // 2. Sync to Supabase if valid UUID
    if (this.isValidUUID(session.id) && this.isValidUUID(session.userId)) {
      try {
        const row = this.mapToRow(session);
        await this.client
          .from('practice_sessions')
          .update(row)
          .eq('id', session.id);
      } catch (err) {
        console.warn('Supabase practice_sessions update skipped/failed:', err);
      }
    }
  }

  public async delete(id: string, userId: string): Promise<void> {
    this.inMemorySessions.delete(id);
    this.persistToLocalStorage();

    if (this.isValidUUID(id) && this.isValidUUID(userId)) {
      try {
        await this.client
          .from('practice_sessions')
          .delete()
          .eq('id', id)
          .eq('user_id', userId);
      } catch (err) {
        console.warn('Supabase delete skipped/failed:', err);
      }
    }
  }

  public async getAggregatedStats(userId: string): Promise<AggregatedUserStats> {
    // 1. If valid UUID, attempt to read from Supabase
    if (this.isValidUUID(userId)) {
      try {
        const { data, error } = await this.client
          .from('practice_sessions')
          .select('overall_score, pronunciation_score, fluency_score, lexical_score, grammar_score, duration_seconds')
          .eq('user_id', userId)
          .not('overall_score', 'is', null)
          .returns<Array<{
            overall_score: number;
            pronunciation_score: number;
            fluency_score: number;
            lexical_score: number;
            grammar_score: number;
            duration_seconds: number;
          }>>();

        if (!error && data && data.length > 0) {
          const totalSessions = data.length;
          let sumOverall = 0;
          let sumP = 0;
          let sumF = 0;
          let sumL = 0;
          let sumG = 0;
          let totalSeconds = 0;

          for (const s of data) {
            sumOverall += s.overall_score;
            sumP += s.pronunciation_score;
            sumF += s.fluency_score;
            sumL += s.lexical_score;
            sumG += s.grammar_score;
            totalSeconds += s.duration_seconds;
          }

          return {
            totalSessions,
            totalDurationMinutes: Math.round(totalSeconds / 60),
            averageOverallBand: BandScore.fromRawAverage(sumOverall / totalSessions),
            averagePronunciation: BandScore.fromRawAverage(sumP / totalSessions),
            averageFluency: BandScore.fromRawAverage(sumF / totalSessions),
            averageLexical: BandScore.fromRawAverage(sumL / totalSessions),
            averageGrammar: BandScore.fromRawAverage(sumG / totalSessions),
          };
        }
      } catch {
        // Fall back to local calculation
      }
    }

    // 2. Reliable Local Calculation from in-memory / local storage
    const localMatches = Array.from(this.inMemorySessions.values()).filter(
      (s) =>
        (s.userId === userId || userId === 'guest-user' || !s.userId) &&
        s.overallScore !== null
    );

    if (localMatches.length === 0) {
      return {
        totalSessions: 0,
        totalDurationMinutes: 0,
        averageOverallBand: null,
        averagePronunciation: null,
        averageFluency: null,
        averageLexical: null,
        averageGrammar: null,
      };
    }

    const totalSessions = localMatches.length;
    let sumOverall = 0;
    let sumP = 0;
    let sumF = 0;
    let sumL = 0;
    let sumG = 0;
    let totalSeconds = 0;

    for (const s of localMatches) {
      sumOverall += s.overallScore ? s.overallScore.getValue() : 6.0;
      sumP += s.pronunciationScore ? s.pronunciationScore.getValue() : 6.0;
      sumF += s.fluencyScore ? s.fluencyScore.getValue() : 6.0;
      sumL += s.lexicalScore ? s.lexicalScore.getValue() : 6.0;
      sumG += s.grammarScore ? s.grammarScore.getValue() : 6.0;
      totalSeconds += s.durationSeconds || 60;
    }

    return {
      totalSessions,
      totalDurationMinutes: Math.round(totalSeconds / 60),
      averageOverallBand: BandScore.fromRawAverage(sumOverall / totalSessions),
      averagePronunciation: BandScore.fromRawAverage(sumP / totalSessions),
      averageFluency: BandScore.fromRawAverage(sumF / totalSessions),
      averageLexical: BandScore.fromRawAverage(sumL / totalSessions),
      averageGrammar: BandScore.fromRawAverage(sumG / totalSessions),
    };
  }

  private mapToDomain(row: PracticeSessionRow): PracticeSession {
    let metrics: SpeechMetrics | null = null;
    if (row.words_per_minute !== null && row.hesitation_count !== null) {
      metrics = SpeechMetrics.create({
        wpm: row.words_per_minute,
        hesitationCount: row.hesitation_count,
        silenceDurations: new Array(row.hesitation_count).fill(0.8), // Minimum standard
        totalDurationSeconds: row.duration_seconds,
      });
    }

    const status: SessionStatus = row.overall_score !== null ? 'completed' : 'recording';

    return PracticeSession.reconstitute({
      id: row.id,
      userId: row.user_id,
      topicId: row.topic_id,
      mode: row.mode as PracticeMode,
      status,
      durationSeconds: row.duration_seconds,
      speechMetrics: metrics,
      overallScore: row.overall_score !== null ? BandScore.fromRawAverage(row.overall_score) : null,
      pronunciationScore: row.pronunciation_score !== null ? BandScore.fromRawAverage(row.pronunciation_score) : null,
      fluencyScore: row.fluency_score !== null ? BandScore.fromRawAverage(row.fluency_score) : null,
      lexicalScore: row.lexical_score !== null ? BandScore.fromRawAverage(row.lexical_score) : null,
      grammarScore: row.grammar_score !== null ? BandScore.fromRawAverage(row.grammar_score) : null,
      transcriptDialogue: row.transcript_dialogue || [],
      detailedFeedback: row.detailed_feedback || null,
      aiProviderUsed: row.ai_provider_used,
      createdAt: new Date(row.created_at),
    });
  }

  private mapToRow(session: PracticeSession): PracticeSessionRow {
    return {
      id: session.id,
      user_id: session.userId,
      topic_id: session.topicId,
      mode: session.mode,
      duration_seconds: session.durationSeconds,
      overall_score: session.overallScore ? session.overallScore.getValue() : null,
      pronunciation_score: session.pronunciationScore ? session.pronunciationScore.getValue() : null,
      fluency_score: session.fluencyScore ? session.fluencyScore.getValue() : null,
      lexical_score: session.lexicalScore ? session.lexicalScore.getValue() : null,
      grammar_score: session.grammarScore ? session.grammarScore.getValue() : null,
      words_per_minute: session.speechMetrics ? session.speechMetrics.getWpm() : null,
      hesitation_count: session.speechMetrics ? session.speechMetrics.getHesitationCount() : null,
      transcript_dialogue: [...session.transcriptDialogue],
      detailed_feedback: session.detailedFeedback || {
        summary: '',
        strengths: [],
        weaknesses: [],
        suggestedPhrases: [],
        grammarCorrections: [],
        vocabularyEnhancements: [],
      },
      ai_provider_used: session.aiProviderUsed,
      created_at: session.createdAt.toISOString(),
    };
  }
}
