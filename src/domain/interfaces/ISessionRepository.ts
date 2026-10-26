import { PracticeSession } from '../entities/PracticeSession';
import { BandScore } from '../value-objects/BandScore';

export interface AggregatedUserStats {
  totalSessions: number;
  totalDurationMinutes: number;
  averageOverallBand: BandScore | null;
  averagePronunciation: BandScore | null;
  averageFluency: BandScore | null;
  averageLexical: BandScore | null;
  averageGrammar: BandScore | null;
}

export interface ISessionRepository {
  findById(id: string): Promise<PracticeSession | null>;
  findRecentByUserId(userId: string, limit?: number): Promise<PracticeSession[]>;
  save(session: PracticeSession): Promise<void>;
  update(session: PracticeSession): Promise<void>;
  delete(id: string, userId: string): Promise<void>;
  getAggregatedStats(userId: string): Promise<AggregatedUserStats>;
}
