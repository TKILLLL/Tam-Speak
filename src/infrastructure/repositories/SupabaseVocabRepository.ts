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
  private static inMemoryVocab = new Map<string, VocabularyItem>();

  constructor(private readonly client: SupabaseClient) {}

  private isValidUUID(str: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);
  }

  public async findById(id: string): Promise<VocabularyItem | null> {
    if (SupabaseVocabRepository.inMemoryVocab.has(id)) {
      return SupabaseVocabRepository.inMemoryVocab.get(id) || null;
    }

    if (!this.isValidUUID(id)) return null;

    try {
      const { data, error } = await this.client
        .from('vocabulary_bank')
        .select('*')
        .eq('id', id)
        .maybeSingle<VocabularyRow>();

      if (error || !data) return null;
      const domain = this.mapToDomain(data);
      SupabaseVocabRepository.inMemoryVocab.set(id, domain);
      return domain;
    } catch {
      return null;
    }
  }

  public async findByWord(userId: string, word: string): Promise<VocabularyItem | null> {
    const normalizedWord = word.trim().toLowerCase();
    for (const item of SupabaseVocabRepository.inMemoryVocab.values()) {
      if (item.userId === userId && item.word.toLowerCase() === normalizedWord) {
        return item;
      }
    }

    if (!this.isValidUUID(userId)) return null;

    try {
      const { data, error } = await this.client
        .from('vocabulary_bank')
        .select('*')
        .eq('user_id', userId)
        .eq('word', normalizedWord)
        .maybeSingle<VocabularyRow>();

      if (error || !data) return null;
      const domain = this.mapToDomain(data);
      SupabaseVocabRepository.inMemoryVocab.set(domain.id, domain);
      return domain;
    } catch {
      return null;
    }
  }

  public async findDueForReview(userId: string, limit = 20): Promise<VocabularyItem[]> {
    const today = new Date().toISOString().split('T')[0]!;
    const inMemList = Array.from(SupabaseVocabRepository.inMemoryVocab.values()).filter(
      (v) => v.userId === userId && v.nextReviewDate <= today
    );

    if (!this.isValidUUID(userId)) {
      return inMemList.slice(0, limit);
    }

    try {
      const { data, error } = await this.client
        .from('vocabulary_bank')
        .select('*')
        .eq('user_id', userId)
        .lte('next_review_date', today)
        .order('next_review_date', { ascending: true })
        .limit(limit)
        .returns<VocabularyRow[]>();

      if (error || !data) return inMemList.slice(0, limit);
      const dbList = data.map((row) => this.mapToDomain(row));
      dbList.forEach((item) => SupabaseVocabRepository.inMemoryVocab.set(item.id, item));
      return dbList;
    } catch {
      return inMemList.slice(0, limit);
    }
  }

  public async findAllByUserId(userId: string): Promise<VocabularyItem[]> {
    const inMemList = Array.from(SupabaseVocabRepository.inMemoryVocab.values()).filter(
      (v) => v.userId === userId
    );

    if (!this.isValidUUID(userId)) {
      return inMemList;
    }

    try {
      const { data, error } = await this.client
        .from('vocabulary_bank')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .returns<VocabularyRow[]>();

      if (error || !data) return inMemList;
      const dbList = data.map((row) => this.mapToDomain(row));
      dbList.forEach((item) => SupabaseVocabRepository.inMemoryVocab.set(item.id, item));
      return dbList;
    } catch {
      return inMemList;
    }
  }

  public async save(item: VocabularyItem): Promise<void> {
    SupabaseVocabRepository.inMemoryVocab.set(item.id, item);

    if (!this.isValidUUID(item.id) || !this.isValidUUID(item.userId)) {
      return;
    }

    try {
      const row = this.mapToRow(item);
      const { error } = await this.client.from('vocabulary_bank').insert(row);
      if (error) {
        console.warn('Supabase vocabulary_bank insert skipped/failed:', error.message);
      }
    } catch (err) {
      console.warn('Supabase vocabulary_bank insert network error:', err);
    }
  }

  public async update(item: VocabularyItem): Promise<void> {
    SupabaseVocabRepository.inMemoryVocab.set(item.id, item);

    if (!this.isValidUUID(item.id) || !this.isValidUUID(item.userId)) {
      return;
    }

    try {
      const row = this.mapToRow(item);
      const { error } = await this.client
        .from('vocabulary_bank')
        .update(row)
        .eq('id', item.id);

      if (error) {
        console.warn('Supabase vocabulary_bank update failed:', error.message);
      }
    } catch (err) {
      console.warn('Supabase vocabulary_bank update network error:', err);
    }
  }

  public async delete(id: string, userId: string): Promise<void> {
    SupabaseVocabRepository.inMemoryVocab.delete(id);

    if (!this.isValidUUID(id) || !this.isValidUUID(userId)) {
      return;
    }

    try {
      const { error } = await this.client
        .from('vocabulary_bank')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

      if (error) {
        console.warn('Supabase vocabulary_bank delete failed:', error.message);
      }
    } catch (err) {
      console.warn('Supabase vocabulary_bank delete network error:', err);
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
