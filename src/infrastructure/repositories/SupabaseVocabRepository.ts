import { SupabaseClient } from '@supabase/supabase-js';
import { IVocabRepository } from '../../domain/interfaces/IVocabRepository';
import { VocabularyItem } from '../../domain/entities/VocabularyItem';
import { IPAPhonetic } from '../../domain/value-objects/IPAPhonetic';

interface VocabularyRow {
  id: string;
  user_id: string;
  word: string;
  ipa: string | null;
  definition_en: string;
  definition_vi: string | null;
  example_sentence: string | null;
  collocations: string[];
  synonyms: string[];
  mastery_level: number;
  next_review_date: string;
  last_reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export class SupabaseVocabRepository implements IVocabRepository {
  constructor(private readonly client: SupabaseClient) {}

  public async findById(id: string): Promise<VocabularyItem | null> {
    const { data, error } = await this.client
      .from('vocabulary_bank')
      .select('*')
      .eq('id', id)
      .maybeSingle<VocabularyRow>();

    if (error || !data) return null;
    return this.mapToDomain(data);
  }

  public async findByWord(userId: string, word: string): Promise<VocabularyItem | null> {
    const { data, error } = await this.client
      .from('vocabulary_bank')
      .select('*')
      .eq('user_id', userId)
      .eq('word', word.trim().toLowerCase())
      .maybeSingle<VocabularyRow>();

    if (error || !data) return null;
    return this.mapToDomain(data);
  }

  public async findDueForReview(userId: string, limit = 20): Promise<VocabularyItem[]> {
    const today = new Date().toISOString().split('T')[0]!;

    const { data, error } = await this.client
      .from('vocabulary_bank')
      .select('*')
      .eq('user_id', userId)
      .lte('next_review_date', today)
      .order('next_review_date', { ascending: true })
      .limit(limit)
      .returns<VocabularyRow[]>();

    if (error || !data) return [];
    return data.map((row) => this.mapToDomain(row));
  }

  public async findAllByUserId(userId: string): Promise<VocabularyItem[]> {
    const { data, error } = await this.client
      .from('vocabulary_bank')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .returns<VocabularyRow[]>();

    if (error || !data) return [];
    return data.map((row) => this.mapToDomain(row));
  }

  public async save(item: VocabularyItem): Promise<void> {
    const row = this.mapToRow(item);
    const { error } = await this.client.from('vocabulary_bank').insert(row);
    if (error) {
      throw new Error(`Failed to save vocabulary: ${error.message}`);
    }
  }

  public async update(item: VocabularyItem): Promise<void> {
    const row = this.mapToRow(item);
    const { error } = await this.client
      .from('vocabulary_bank')
      .update(row)
      .eq('id', item.id);

    if (error) {
      throw new Error(`Failed to update vocabulary: ${error.message}`);
    }
  }

  public async delete(id: string, userId: string): Promise<void> {
    const { error } = await this.client
      .from('vocabulary_bank')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to delete vocabulary: ${error.message}`);
    }
  }

  private mapToDomain(row: VocabularyRow): VocabularyItem {
    let ipaVo: IPAPhonetic | null = null;
    if (row.ipa) {
      try {
        ipaVo = IPAPhonetic.create(row.ipa);
      } catch {
        ipaVo = null;
      }
    }

    return VocabularyItem.reconstitute({
      id: row.id,
      userId: row.user_id,
      word: row.word,
      ipa: ipaVo,
      definitionEn: row.definition_en,
      definitionVi: row.definition_vi,
      exampleSentence: row.example_sentence,
      collocations: row.collocations || [],
      synonyms: row.synonyms || [],
      masteryLevel: row.mastery_level,
      nextReviewDate: row.next_review_date,
      lastReviewedAt: row.last_reviewed_at ? new Date(row.last_reviewed_at) : null,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    });
  }

  private mapToRow(item: VocabularyItem): VocabularyRow {
    return {
      id: item.id,
      user_id: item.userId,
      word: item.word,
      ipa: item.ipa ? item.ipa.getRawIPA() : null,
      definition_en: item.definitionEn,
      definition_vi: item.definitionVi,
      example_sentence: item.exampleSentence,
      collocations: [...item.collocations],
      synonyms: [...item.synonyms],
      mastery_level: item.masteryLevel,
      next_review_date: item.nextReviewDate,
      last_reviewed_at: item.lastReviewedAt ? item.lastReviewedAt.toISOString() : null,
      created_at: item.createdAt.toISOString(),
      updated_at: item.updatedAt.toISOString(),
    };
  }
}
