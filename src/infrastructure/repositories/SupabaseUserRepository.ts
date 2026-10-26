import { SupabaseClient } from '@supabase/supabase-js';
import { IUserRepository } from '../../domain/interfaces/IUserRepository';
import { User, SkillLevel } from '../../domain/entities/User';
import { EmailAddress } from '../../domain/value-objects/EmailAddress';
import { BandScore } from '../../domain/value-objects/BandScore';

interface ProfileRow {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  target_band: number | null;
  current_level: string | null;
  streak_days: number | null;
  last_practice_date: string | null;
  total_practice_minutes: number | null;
  created_at: string;
  updated_at: string;
}

export class SupabaseUserRepository implements IUserRepository {
  constructor(private readonly client: SupabaseClient) {}

  public async findById(id: string): Promise<User | null> {
    const { data, error } = await this.client
      .from('profiles')
      .select('*')
      .eq('id', id)
      .maybeSingle<ProfileRow>();

    if (error || !data) return null;
    return this.mapToDomain(data);
  }

  public async findByEmail(email: EmailAddress): Promise<User | null> {
    const { data, error } = await this.client
      .from('profiles')
      .select('*')
      .eq('email', email.getValue())
      .maybeSingle<ProfileRow>();

    if (error || !data) return null;
    return this.mapToDomain(data);
  }

  public async save(user: User): Promise<void> {
    const row = this.mapToRow(user);
    const { error } = await this.client.from('profiles').insert(row);
    if (error) {
      throw new Error(`Failed to save user: ${error.message}`);
    }
  }

  public async update(user: User): Promise<void> {
    const row = this.mapToRow(user);
    const { error } = await this.client
      .from('profiles')
      .update(row)
      .eq('id', user.id);

    if (error) {
      throw new Error(`Failed to update user: ${error.message}`);
    }
  }

  private mapToDomain(row: ProfileRow): User {
    return User.reconstitute({
      id: row.id,
      email: EmailAddress.create(row.email),
      displayName: row.display_name || 'Speaking Learner',
      avatarUrl: row.avatar_url,
      targetBand: row.target_band ? BandScore.fromRawAverage(row.target_band) : BandScore.create(7.5),
      currentLevel: (row.current_level as SkillLevel) || 'b2',
      streakDays: row.streak_days ?? 0,
      lastPracticeDate: row.last_practice_date,
      totalPracticeMinutes: row.total_practice_minutes ?? 0,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    });
  }

  private mapToRow(user: User): ProfileRow {
    return {
      id: user.id,
      email: user.email.getValue(),
      display_name: user.displayName,
      avatar_url: user.avatarUrl,
      target_band: user.targetBand.getValue(),
      current_level: user.currentLevel,
      streak_days: user.streakDays,
      last_practice_date: user.lastPracticeDate,
      total_practice_minutes: user.totalPracticeMinutes,
      created_at: user.createdAt.toISOString(),
      updated_at: user.updatedAt.toISOString(),
    };
  }
}
