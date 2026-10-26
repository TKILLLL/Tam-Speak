import { VocabularyItem } from '../entities/VocabularyItem';

export interface IVocabRepository {
  findById(id: string): Promise<VocabularyItem | null>;
  findByWord(userId: string, word: string): Promise<VocabularyItem | null>;
  findDueForReview(userId: string, limit?: number): Promise<VocabularyItem[]>;
  findAllByUserId(userId: string): Promise<VocabularyItem[]>;
  save(item: VocabularyItem): Promise<void>;
  update(item: VocabularyItem): Promise<void>;
  delete(id: string, userId: string): Promise<void>;
}
