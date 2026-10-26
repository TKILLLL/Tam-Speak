import {
  RawDataIngestionService,
  IngestionResult,
} from '../../infrastructure/ingestion/RawDataIngestionService';
import { RawLexiconInput } from '../../infrastructure/ingestion/RawDataValidator';
import { InvalidRawDataError } from '../../domain/errors/DomainErrors';

export interface ImportRawDataRequest {
  format: 'json_questions' | 'csv_questions' | 'md_questions' | 'json_vocab' | 'cmu_lexicon';
  rawContent: string | RawLexiconInput[];
  category?: 'ielts_part1' | 'ielts_part2' | 'ielts_part3' | 'conversation';
}

/**
 * ImportRawDataUseCase
 * Application entrypoint for bulk ingestion of external question banks, custom vocab, and offline CMUdict lexicon.
 */
export class ImportRawDataUseCase {
  constructor(private readonly ingestionService: RawDataIngestionService) {}

  public async execute(request: ImportRawDataRequest): Promise<IngestionResult> {
    switch (request.format) {
      case 'json_questions':
        if (typeof request.rawContent !== 'string') {
          throw new InvalidRawDataError('Expected string content for JSON questions.');
        }
        return await this.ingestionService.ingestQuestionsFromJSON(request.rawContent);

      case 'csv_questions':
        if (typeof request.rawContent !== 'string') {
          throw new InvalidRawDataError('Expected string content for CSV questions.');
        }
        return await this.ingestionService.ingestQuestionsFromCSV(request.rawContent);

      case 'md_questions':
        if (typeof request.rawContent !== 'string') {
          throw new InvalidRawDataError('Expected string content for Markdown questions.');
        }
        return await this.ingestionService.ingestQuestionsFromMarkdown(
          request.rawContent,
          request.category ?? 'ielts_part1'
        );

      case 'json_vocab':
        if (typeof request.rawContent !== 'string') {
          throw new InvalidRawDataError('Expected string content for JSON vocabulary.');
        }
        return await this.ingestionService.ingestVocabularyFromJSON(request.rawContent);

      case 'cmu_lexicon':
        if (!Array.isArray(request.rawContent)) {
          throw new InvalidRawDataError('Expected array of lexicon objects for CMUdict.');
        }
        return await this.ingestionService.ingestCMUDictLexicon(request.rawContent);

      default:
        throw new InvalidRawDataError(`Unsupported import format.`);
    }
  }
}
