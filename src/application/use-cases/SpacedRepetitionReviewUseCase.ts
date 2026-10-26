import { IVocabRepository } from '../../domain/interfaces/IVocabRepository';
import { VocabularyItemDTO } from '../dtos';
import { EntityNotFoundError } from '../../domain/errors/DomainErrors';

/**
 * SpacedRepetitionReviewUseCase
 * Implements Leitner / SM-2 spaced repetition review logic for vocabulary acquisition.
 */
export class SpacedRepetitionReviewUseCase {
  constructor(private readonly vocabRepository: IVocabRepository) {}

  public async getDueWords(userId: string, limit = 20): Promise<VocabularyItemDTO[]> {
    const items = await this.vocabRepository.findDueForReview(userId, limit);
    return items.map((item) => ({
      id: item.id,
      userId: item.userId,
      word: item.word,
      ipa: item.ipa ? item.ipa.getRawIPA() : null,
      definitionEn: item.definitionEn,
      definitionVi: item.definitionVi,
      exampleSentence: item.exampleSentence,
      collocations: [...item.collocations],
      synonyms: [...item.synonyms],
      masteryLevel: item.masteryLevel,
      nextReviewDate: item.nextReviewDate,
      isDueForReview: item.isDueForReview(),
    }));
  }

  public async submitReview(params: {
    userId: string;
    vocabId: string;
    isSuccess: boolean;
  }): Promise<VocabularyItemDTO> {
    const item = await this.vocabRepository.findById(params.vocabId);
    if (!item || item.userId !== params.userId) {
      throw new EntityNotFoundError('VocabularyItem', params.vocabId);
    }

    if (params.isSuccess) {
      item.recordReviewSuccess();
    } else {
      item.recordReviewFailure();
    }

    await this.vocabRepository.update(item);

    return {
      id: item.id,
      userId: item.userId,
      word: item.word,
      ipa: item.ipa ? item.ipa.getRawIPA() : null,
      definitionEn: item.definitionEn,
      definitionVi: item.definitionVi,
      exampleSentence: item.exampleSentence,
      collocations: [...item.collocations],
      synonyms: [...item.synonyms],
      masteryLevel: item.masteryLevel,
      nextReviewDate: item.nextReviewDate,
      isDueForReview: item.isDueForReview(),
    };
  }
}
