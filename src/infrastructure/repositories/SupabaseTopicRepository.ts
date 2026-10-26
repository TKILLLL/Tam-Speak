import { SupabaseClient } from '@supabase/supabase-js';
import { ITopicRepository } from '../../domain/interfaces/ITopicRepository';
import { CustomTopic } from '../../domain/entities/CustomTopic';
import { SkillLevel } from '../../domain/entities/User';

interface CustomTopicRow {
  id: string;
  user_id: string;
  title: string;
  description: string;
  context_prompt: string;
  ai_role: string;
  user_role: string;
  target_keywords: string[];
  target_level: string;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export class SupabaseTopicRepository implements ITopicRepository {
  private readonly inMemoryTopics = new Map<string, CustomTopic>();

  constructor(private readonly client: SupabaseClient) {}

  private isValidUUID(str: string): boolean {
    if (!str || typeof str !== 'string') return false;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str.trim());
  }

  public async findById(id: string): Promise<CustomTopic | null> {
    if (this.inMemoryTopics.has(id)) {
      return this.inMemoryTopics.get(id)!;
    }

    if (!this.isValidUUID(id)) {
      return null;
    }

    try {
      const { data, error } = await this.client
        .from('custom_topics')
        .select('*')
        .eq('id', id)
        .maybeSingle<CustomTopicRow>();

      if (error || !data) return null;
      const topic = this.mapToDomain(data);
      this.inMemoryTopics.set(topic.id, topic);
      return topic;
    } catch {
      return null;
    }
  }

  public async findByUserId(userId: string): Promise<CustomTopic[]> {
    const memoryMatches = Array.from(this.inMemoryTopics.values()).filter(
      (t) => t.userId === userId
    );

    if (!this.isValidUUID(userId)) {
      return memoryMatches;
    }

    try {
      const { data, error } = await this.client
        .from('custom_topics')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .returns<CustomTopicRow[]>();

      if (error || !data) return memoryMatches;
      const dbTopics = data.map((row) => this.mapToDomain(row));
      return [...memoryMatches, ...dbTopics];
    } catch {
      return memoryMatches;
    }
  }

  public async findPublicTopics(level?: SkillLevel): Promise<CustomTopic[]> {
    try {
      let query = this.client
        .from('custom_topics')
        .select('*')
        .eq('is_public', true)
        .order('created_at', { ascending: false });

      if (level) {
        query = query.eq('target_level', level);
      }

      const { data, error } = await query.returns<CustomTopicRow[]>();
      if (error || !data) return [];
      return data.map((row) => this.mapToDomain(row));
    } catch {
      return [];
    }
  }

  public async save(topic: CustomTopic): Promise<void> {
    this.inMemoryTopics.set(topic.id, topic);

    if (this.isValidUUID(topic.id) && this.isValidUUID(topic.userId)) {
      try {
        const row = this.mapToRow(topic);
        await this.client.from('custom_topics').insert(row);
      } catch (err) {
        console.warn('Supabase custom_topics sync skipped/failed:', err);
      }
    }
  }

  public async update(topic: CustomTopic): Promise<void> {
    this.inMemoryTopics.set(topic.id, topic);

    if (this.isValidUUID(topic.id) && this.isValidUUID(topic.userId)) {
      try {
        const row = this.mapToRow(topic);
        await this.client
          .from('custom_topics')
          .update(row)
          .eq('id', topic.id);
      } catch (err) {
        console.warn('Supabase custom_topics update skipped/failed:', err);
      }
    }
  }

  public async delete(id: string, userId: string): Promise<void> {
    this.inMemoryTopics.delete(id);

    if (this.isValidUUID(id) && this.isValidUUID(userId)) {
      try {
        await this.client
          .from('custom_topics')
          .delete()
          .eq('id', id)
          .eq('user_id', userId);
      } catch (err) {
        console.warn('Supabase custom_topics delete skipped/failed:', err);
      }
    }
  }

  private mapToDomain(row: CustomTopicRow): CustomTopic {
    return CustomTopic.reconstitute({
      id: row.id,
      userId: row.user_id,
      title: row.title,
      description: row.description,
      contextPrompt: row.context_prompt,
      aiRole: row.ai_role,
      userRole: row.user_role,
      targetKeywords: row.target_keywords || [],
      targetLevel: (row.target_level as SkillLevel) || 'b2',
      isPublic: row.is_public,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    });
  }

  private mapToRow(topic: CustomTopic): CustomTopicRow {
    return {
      id: topic.id,
      user_id: topic.userId,
      title: topic.title,
      description: topic.description,
      context_prompt: topic.contextPrompt,
      ai_role: topic.aiRole,
      user_role: topic.userRole,
      target_keywords: [...topic.targetKeywords],
      target_level: topic.targetLevel,
      is_public: topic.isPublic,
      created_at: topic.createdAt.toISOString(),
      updated_at: topic.updatedAt.toISOString(),
    };
  }
}
