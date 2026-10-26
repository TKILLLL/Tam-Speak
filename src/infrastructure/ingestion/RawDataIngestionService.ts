import { dexieDb, RawQuestionRecord, OfflineDictionaryRecord } from '../database/dexie/TamSpeakDexieDatabase';
import {
  RawDataValidator,
  RawQuestionInput,
  RawVocabularyInput,
  RawLexiconInput,
  rawLexiconEntrySchema,
} from './RawDataValidator';
import { InvalidRawDataError } from '../../domain/errors/DomainErrors';

export interface IngestionResult {
  successCount: number;
  errorCount: number;
  errors: string[];
}

/**
 * RawDataIngestionService
 * Production-grade ingestion engine for external learning data (.json, .csv, .txt, .md).
 * Ingests:
 * 1. Question Banks (IELTS Part 1/2/3, Roleplays, Interviews) -> IndexedDB rawQuestions
 * 2. CMUdict Offline IPA Lexicon -> IndexedDB offlineDictionary (0ms, 0-token IPA lookup)
 * 3. Custom Vocabulary Lists -> Dexie / Supabase
 */
export class RawDataIngestionService {
  /**
   * Ingests Question Bank data from JSON string.
   */
  public async ingestQuestionsFromJSON(jsonString: string): Promise<IngestionResult> {
    RawDataValidator.validateFileSize(new Blob([jsonString]).size);

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonString);
    } catch {
      throw new InvalidRawDataError('Failed to parse input as valid JSON.');
    }

    if (!Array.isArray(parsed)) {
      throw new InvalidRawDataError('Expected JSON array of question objects.');
    }

    const validatedList = RawDataValidator.validateQuestionsBatch(parsed);
    const records: RawQuestionRecord[] = validatedList.map((item, index) => ({
      id: item.id ?? `q-${Date.now()}-${index}`,
      category: item.category,
      topic: item.topic,
      part: item.part,
      questionText: item.questionText,
      targetKeywords: item.targetKeywords,
      suggestedCollocations: item.suggestedCollocations,
      sampleBand8Response: item.sampleBand8Response,
      createdAt: new Date(),
    }));

    await dexieDb.rawQuestions.bulkPut(records);

    return {
      successCount: records.length,
      errorCount: 0,
      errors: [],
    };
  }

  /**
   * Ingests Question Bank from CSV text.
   * CSV Header Expected: category,topic,part,questionText,targetKeywords
   */
  public async ingestQuestionsFromCSV(csvContent: string): Promise<IngestionResult> {
    RawDataValidator.validateFileSize(new Blob([csvContent]).size);

    const rows = this.parseCSVRows(csvContent);
    if (rows.length < 2) {
      throw new InvalidRawDataError('CSV must contain a header row and at least one data row.');
    }

    const header = rows[0]!.map((h) => h.trim().toLowerCase());
    const catIdx = header.indexOf('category');
    const topicIdx = header.indexOf('topic');
    const partIdx = header.indexOf('part');
    const questionIdx = header.indexOf('questiontext');
    const keywordsIdx = header.indexOf('targetkeywords');

    if (catIdx === -1 || topicIdx === -1 || questionIdx === -1) {
      throw new InvalidRawDataError('CSV header must contain "category", "topic", and "questionText" columns.');
    }

    const rawBatch: unknown[] = [];
    const errors: string[] = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i]!;
      if (row.length === 0 || (row.length === 1 && row[0]?.trim() === '')) continue;

      try {
        const category = RawDataValidator.sanitizeCSVCell(row[catIdx] ?? '');
        const topic = RawDataValidator.sanitizeCSVCell(row[topicIdx] ?? '');
        const part = partIdx !== -1 && row[partIdx] ? parseInt(row[partIdx]!, 10) : undefined;
        const questionText = RawDataValidator.sanitizeCSVCell(row[questionIdx] ?? '');
        const rawKeywords = keywordsIdx !== -1 && row[keywordsIdx] ? row[keywordsIdx]!.split(';') : [];
        const targetKeywords = rawKeywords.map((k) => RawDataValidator.sanitizeCSVCell(k.trim())).filter(Boolean);

        rawBatch.push({
          category,
          topic,
          part: Number.isNaN(part) ? undefined : part,
          questionText,
          targetKeywords,
        });
      } catch (err) {
        errors.push(`Row ${i}: ${(err as Error).message}`);
      }
    }

    const validatedList = RawDataValidator.validateQuestionsBatch(rawBatch);
    const records: RawQuestionRecord[] = validatedList.map((item, index) => ({
      id: item.id ?? `q-csv-${Date.now()}-${index}`,
      category: item.category,
      topic: item.topic,
      part: item.part,
      questionText: item.questionText,
      targetKeywords: item.targetKeywords,
      suggestedCollocations: item.suggestedCollocations,
      sampleBand8Response: item.sampleBand8Response,
      createdAt: new Date(),
    }));

    await dexieDb.rawQuestions.bulkPut(records);

    return {
      successCount: records.length,
      errorCount: errors.length,
      errors,
    };
  }

  /**
   * Ingests Question Bank from Markdown text.
   * Recognizes:
   * ## Topic Name
   * - Question text [keyword1, keyword2]
   */
  public async ingestQuestionsFromMarkdown(
    markdownContent: string,
    defaultCategory: 'ielts_part1' | 'ielts_part2' | 'ielts_part3' | 'conversation' = 'ielts_part1'
  ): Promise<IngestionResult> {
    RawDataValidator.validateFileSize(new Blob([markdownContent]).size);

    const lines = markdownContent.split('\n');
    let currentTopic = 'General Speaking';
    const batch: RawQuestionInput[] = [];

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      if (line.startsWith('#')) {
        currentTopic = line.replace(/^#+\s*/, '').trim();
      } else if (line.startsWith('-') || line.startsWith('*') || /^\d+\./.test(line)) {
        let questionText = line.replace(/^(?:[-*]|\d+\.)\s*/, '').trim();
        const keywords: string[] = [];

        // Check for bracketed keywords e.g. "Do you like travel? [journey, vacation]"
        const matchKeywords = questionText.match(/\[(.*?)\]$/);
        if (matchKeywords && matchKeywords[1]) {
          keywords.push(...matchKeywords[1].split(',').map((k) => k.trim()).filter(Boolean));
          questionText = questionText.replace(/\[(.*?)\]$/, '').trim();
        }

        if (questionText.length >= 5) {
          batch.push({
            category: defaultCategory,
            topic: currentTopic,
            questionText: RawDataValidator.sanitizeString(questionText),
            targetKeywords: keywords.map(RawDataValidator.sanitizeString),
          });
        }
      }
    }

    const validatedList = RawDataValidator.validateQuestionsBatch(batch);
    const records: RawQuestionRecord[] = validatedList.map((item, index) => ({
      id: `q-md-${Date.now()}-${index}`,
      category: item.category,
      topic: item.topic,
      part: item.part,
      questionText: item.questionText,
      targetKeywords: item.targetKeywords,
      createdAt: new Date(),
    }));

    await dexieDb.rawQuestions.bulkPut(records);

    return {
      successCount: records.length,
      errorCount: 0,
      errors: [],
    };
  }

  /**
   * Ingests batch CMUdict / Lexicon records into Dexie offline dictionary.
   * Enables 0-token, 0ms IPA phonetic lookups on the client.
   */
  public async ingestCMUDictLexicon(lexiconEntries: RawLexiconInput[]): Promise<IngestionResult> {
    const records: OfflineDictionaryRecord[] = [];
    const errors: string[] = [];

    for (let i = 0; i < lexiconEntries.length; i++) {
      const parsed = rawLexiconEntrySchema.safeParse(lexiconEntries[i]);
      if (parsed.success) {
        records.push({
          word: parsed.data.word.toLowerCase(),
          ipa: parsed.data.ipa,
          syllables: parsed.data.syllables,
          stressPattern: parsed.data.stressPattern,
        });
      } else {
        errors.push(`Lexicon index ${i}: ${parsed.error.message}`);
      }
    }

    await dexieDb.bulkInsertDictionary(records);

    return {
      successCount: records.length,
      errorCount: errors.length,
      errors,
    };
  }

  /**
   * Ingests custom vocabulary list from JSON.
   */
  public async ingestVocabularyFromJSON(jsonString: string): Promise<IngestionResult> {
    RawDataValidator.validateFileSize(new Blob([jsonString]).size);

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonString);
    } catch {
      throw new InvalidRawDataError('Failed to parse input as valid JSON.');
    }

    if (!Array.isArray(parsed)) {
      throw new InvalidRawDataError('Expected JSON array of vocabulary objects.');
    }

    const validatedList: RawVocabularyInput[] = RawDataValidator.validateVocabularyBatch(parsed);

    // Prepare dictionary records for client-side search
    const dictionaryRecords: OfflineDictionaryRecord[] = validatedList
      .filter((v) => v.ipa)
      .map((v) => ({
        word: v.word.toLowerCase(),
        ipa: v.ipa!,
        syllables: [],
        stressPattern: '',
      }));

    if (dictionaryRecords.length > 0) {
      await dexieDb.bulkInsertDictionary(dictionaryRecords);
    }

    return {
      successCount: validatedList.length,
      errorCount: 0,
      errors: [],
    };
  }

  // --- Robust CSV Parser (Supports Commas Inside Quotes) ---
  private parseCSVRows(csvText: string): string[][] {
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentCell = '';
    let insideQuotes = false;

    for (let i = 0; i < csvText.length; i++) {
      const char = csvText[i];
      const nextChar = csvText[i + 1];

      if (char === '"') {
        if (insideQuotes && nextChar === '"') {
          currentCell += '"';
          i++; // Skip escaped quote
        } else {
          insideQuotes = !insideQuotes;
        }
      } else if (char === ',' && !insideQuotes) {
        currentRow.push(currentCell);
        currentCell = '';
      } else if ((char === '\r' || char === '\n') && !insideQuotes) {
        if (char === '\r' && nextChar === '\n') {
          i++;
        }
        currentRow.push(currentCell);
        rows.push(currentRow);
        currentRow = [];
        currentCell = '';
      } else {
        currentCell += char;
      }
    }

    if (currentCell.length > 0 || currentRow.length > 0) {
      currentRow.push(currentCell);
      rows.push(currentRow);
    }

    return rows;
  }
}

export const rawDataIngestionService = new RawDataIngestionService();
