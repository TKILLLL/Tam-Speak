import { z } from 'zod';
import { InvalidRawDataError } from '../../domain/errors/DomainErrors';

export const rawQuestionSchema = z.object({
  id: z.string().optional(),
  category: z.enum(['ielts_part1', 'ielts_part2', 'ielts_part3', 'conversation', 'interview']),
  topic: z.string().min(2).max(150),
  part: z.number().int().min(1).max(3).optional(),
  questionText: z.string().min(5).max(1000),
  targetKeywords: z.array(z.string().min(1).max(50)).default([]),
  suggestedCollocations: z.array(z.string()).optional(),
  sampleBand8Response: z.string().optional(),
});

export const rawVocabularySchema = z.object({
  word: z.string().min(1).max(80),
  ipa: z.string().optional(),
  definitionEn: z.string().min(3).max(1000),
  definitionVi: z.string().max(1000).optional(),
  exampleSentence: z.string().max(1000).optional(),
  collocations: z.array(z.string()).default([]),
  synonyms: z.array(z.string()).default([]),
});

export const rawLexiconEntrySchema = z.object({
  word: z.string().min(1).max(80),
  ipa: z.string().min(1).max(80),
  syllables: z.array(z.string()).default([]),
  stressPattern: z.string().default(''),
});

export type RawQuestionInput = z.infer<typeof rawQuestionSchema>;
export type RawVocabularyInput = z.infer<typeof rawVocabularySchema>;
export type RawLexiconInput = z.infer<typeof rawLexiconEntrySchema>;

/**
 * RawDataValidator
 * AppSec validator and sanitizer for bulk-loaded external files (.json, .csv, .txt, .md).
 * Enforces:
 * - 5MB maximum file size (DoS prevention)
 * - Prototype Pollution defense
 * - CSV Injection / DDE Formula Injection neutralization
 * - XSS sanitization
 */
export class RawDataValidator {
  public static readonly MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

  /**
   * Asserts file size is within safety limits.
   */
  public static validateFileSize(byteLength: number): void {
    if (byteLength > RawDataValidator.MAX_FILE_SIZE_BYTES) {
      throw new InvalidRawDataError(
        `File size (${(byteLength / 1024 / 1024).toFixed(2)}MB) exceeds maximum allowed limit of 5MB.`
      );
    }
  }

  /**
   * Neutralizes CSV Formula Injection (DDE).
   * If cell text starts with '=', '+', '-', '@', '\t', or '\r', prepends single quote "'".
   */
  public static sanitizeCSVCell(cellValue: string): string {
    if (!cellValue || typeof cellValue !== 'string') return cellValue;

    const trimmed = cellValue.trim();
    if (/^[=+\-@\t\r]/.test(trimmed)) {
      return `'${trimmed}`;
    }
    return trimmed;
  }

  /**
   * Sanitizes string against XSS attack vectors.
   */
  public static sanitizeString(input: string): string {
    if (!input || typeof input !== 'string') return '';

    return input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .replace(/data:text\/html/gi, '');
  }

  /**
   * Recursively sanitizes JSON objects against Prototype Pollution (__proto__, constructor, prototype)
   * and XSS strings.
   */
  public static sanitizeObject<T>(obj: T): T {
    if (obj === null || obj === undefined) return obj;

    if (typeof obj === 'string') {
      return RawDataValidator.sanitizeString(obj) as unknown as T;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => RawDataValidator.sanitizeObject(item)) as unknown as T;
    }

    if (typeof obj === 'object') {
      const clean: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        // Block Prototype Pollution
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
          continue;
        }
        clean[key] = RawDataValidator.sanitizeObject(value);
      }
      return clean as T;
    }

    return obj;
  }

  /**
   * Validates array of questions against Zod schema after sanitization.
   */
  public static validateQuestionsBatch(rawBatch: unknown[]): RawQuestionInput[] {
    const validated: RawQuestionInput[] = [];

    for (let i = 0; i < rawBatch.length; i++) {
      const sanitized = RawDataValidator.sanitizeObject(rawBatch[i]);
      const result = rawQuestionSchema.safeParse(sanitized);
      if (!result.success) {
        throw new InvalidRawDataError(
          `Validation failed for question at index ${i}: ${result.error.issues.map((e) => e.message).join(', ')}`
        );
      }
      validated.push(result.data);
    }

    return validated;
  }

  /**
   * Validates array of vocabulary items against Zod schema after sanitization.
   */
  public static validateVocabularyBatch(rawBatch: unknown[]): RawVocabularyInput[] {
    const validated: RawVocabularyInput[] = [];

    for (let i = 0; i < rawBatch.length; i++) {
      const sanitized = RawDataValidator.sanitizeObject(rawBatch[i]);
      const result = rawVocabularySchema.safeParse(sanitized);
      if (!result.success) {
        throw new InvalidRawDataError(
          `Validation failed for vocabulary item at index ${i}: ${result.error.issues.map((e) => e.message).join(', ')}`
        );
      }
      validated.push(result.data);
    }

    return validated;
  }
}
