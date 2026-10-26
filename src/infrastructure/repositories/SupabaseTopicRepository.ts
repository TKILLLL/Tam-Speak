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
  constructor(private readonly client: SupabaseClient) {}

  public async findById(id: string): Promise<CustomTopic | null> {
    const { data, error } = await this.client
      .from('custom_topics')
      .select('*')
      .eq('id', id)
      .maybeSingle<CustomTopicRow>();

    if (error || !data) return null;
    return this.mapToDomain(data);
  }

  public async findByUserId(userId: string): Promise<CustomTopic[]> {
    const { data, error } = await this.client
      .from('custom_topics')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .returns<CustomTopicRow[]>();

    if (error || !data) return [];
    return data.map((row) => this.mapToDomain(row));
  }

  public async findPublicTopics(level?: SkillLevel): Promise<CustomTopic[]> {
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
  }

  public async save(topic: CustomTopic): Promise<void> {
    const row = this.mapToRow(topic);
    const { error } = await this.client.from('custom_topics').insert(row);
    if (error) {
      throw new Error(`Failed to save topic: ${error.message}`);
    }
  }

  public async update(topic: CustomTopic): Promise<void> {
    const row = this.mapToRow(topic);
    const { error } = await this.client
      .from('custom_topics')
      .update(row)
      .eq('id', topic.id);

    if (error) {
      throw new Error(`Failed to update topic: ${error.message}`);
    }
  }

  public async delete(id: string, userId: string): Promise<void> {
    const { error } = await this.client
      .from('custom_topics')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to delete topic: ${error.message}`);
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
