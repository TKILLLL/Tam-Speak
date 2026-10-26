import { IPAPhonetic } from '../value-objects/IPAPhonetic';
import { DomainError } from '../errors/DomainErrors';

export class InvalidVocabularyError extends DomainError {
  constructor(message: string) {
    super(message, 'INVALID_VOCABULARY_DATA', 422);
  }
}

export interface VocabularyItemProps {
  id: string;
  userId: string;
  word: string;
  ipa: IPAPhonetic | null;
  definitionEn: string;
  definitionVi: string | null;
  exampleSentence: string | null;
  collocations: string[];
  synonyms: string[];
  masteryLevel: number; // 1 to 5
  nextReviewDate: string; // YYYY-MM-DD
  lastReviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Rich Domain Entity representing a Vocabulary entry in the user's personal bank.
 * Implements Leitner/SM-2 Spaced Repetition algorithms for long-term memory retention.
 */
export class VocabularyItem {
  private readonly _id: string;
  private readonly _userId: string;
  private readonly _word: string;
  private _ipa: IPAPhonetic | null;
  private _definitionEn: string;
  private _definitionVi: string | null;
  private _exampleSentence: string | null;
  private _collocations: Set<string>;
  private _synonyms: Set<string>;
  private _masteryLevel: number;
  private _nextReviewDate: string;
  private _lastReviewedAt: Date | null;
  private readonly _createdAt: Date;
  private _updatedAt: Date;

  // Leitner Spaced Repetition interval lookup (in days)
  private static readonly REVIEW_INTERVALS_DAYS: Record<number, number> = {
    1: 1,
    2: 3,
    3: 7,
    4: 14,
    5: 30,
  };

  private constructor(props: VocabularyItemProps) {
    this._id = props.id;
    this._userId = props.userId;
    this._word = props.word;
    this._ipa = props.ipa;
    this._definitionEn = props.definitionEn;
    this._definitionVi = props.definitionVi;
    this._exampleSentence = props.exampleSentence;
    this._collocations = new Set(props.collocations.map((c) => c.trim().toLowerCase()));
    this._synonyms = new Set(props.synonyms.map((s) => s.trim().toLowerCase()));
    this._masteryLevel = props.masteryLevel;
    this._nextReviewDate = props.nextReviewDate;
    this._lastReviewedAt = props.lastReviewedAt;
    this._createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
  }

  public static create(params: {
    id: string;
    userId: string;
    word: string;
    definitionEn: string;
    ipa?: IPAPhonetic | null;
    definitionVi?: string | null;
    exampleSentence?: string | null;
    collocations?: string[];
    synonyms?: string[];
  }): VocabularyItem {
    if (!params.id || params.id.trim().length === 0) {
      throw new InvalidVocabularyError('Vocabulary ID is required.');
    }
    if (!params.userId || params.userId.trim().length === 0) {
      throw new InvalidVocabularyError('User ID is required.');
    }

    const cleanedWord = params.word?.trim().toLowerCase();
    if (!cleanedWord || cleanedWord.length === 0 || cleanedWord.length > 80) {
      throw new InvalidVocabularyError('Word must be between 1 and 80 characters.');
    }

    const definitionEn = params.definitionEn?.trim();
    if (!definitionEn || definitionEn.length === 0) {
      throw new InvalidVocabularyError('English definition is required.');
    }

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    return new VocabularyItem({
      id: params.id,
      userId: params.userId,
      word: cleanedWord,
      ipa: params.ipa ?? null,
      definitionEn,
      definitionVi: params.definitionVi?.trim() ?? null,
      exampleSentence: params.exampleSentence?.trim() ?? null,
      collocations: params.collocations ?? [],
      synonyms: params.synonyms ?? [],
      masteryLevel: 1,
      nextReviewDate: todayStr,
      lastReviewedAt: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  public static reconstitute(props: VocabularyItemProps): VocabularyItem {
    return new VocabularyItem(props);
  }

  // Getters
  public get id(): string { return this._id; }
  public get userId(): string { return this._userId; }
  public get word(): string { return this._word; }
  public get ipa(): IPAPhonetic | null { return this._ipa; }
  public get definitionEn(): string { return this._definitionEn; }
  public get definitionVi(): string | null { return this._definitionVi; }
  public get exampleSentence(): string | null { return this._exampleSentence; }
  public get collocations(): readonly string[] { return Object.freeze(Array.from(this._collocations)); }
  public get synonyms(): readonly string[] { return Object.freeze(Array.from(this._synonyms)); }
  public get masteryLevel(): number { return this._masteryLevel; }
  public get nextReviewDate(): string { return this._nextReviewDate; }
  public get lastReviewedAt(): Date | null { return this._lastReviewedAt; }
  public get createdAt(): Date { return this._createdAt; }
  public get updatedAt(): Date { return this._updatedAt; }

  // Spaced Repetition Business Methods
  /**
   * Promotes word to the next Leitner mastery box (capped at 5)
   * and schedules the next review date accordingly.
   */
  public recordReviewSuccess(reviewDate: Date = new Date()): void {
    this._masteryLevel = Math.min(5, this._masteryLevel + 1);
    this._lastReviewedAt = reviewDate;

    const intervalDays = VocabularyItem.REVIEW_INTERVALS_DAYS[this._masteryLevel] ?? 1;
    const nextDate = new Date(reviewDate.getTime() + intervalDays * 24 * 60 * 60 * 1000);
    this._nextReviewDate = nextDate.toISOString().split('T')[0];
    this._updatedAt = new Date();
  }

  /**
   * Resets word to Level 1 due to recall failure and schedules it for immediate review tomorrow.
   */
  public recordReviewFailure(reviewDate: Date = new Date()): void {
    this._masteryLevel = 1;
    this._lastReviewedAt = reviewDate;

    const nextDate = new Date(reviewDate.getTime() + 1 * 24 * 60 * 60 * 1000);
    this._nextReviewDate = nextDate.toISOString().split('T')[0];
    this._updatedAt = new Date();
  }

  public isDueForReview(currentDate: Date = new Date()): boolean {
    const todayStr = currentDate.toISOString().split('T')[0];
    return this._nextReviewDate <= todayStr;
  }

  public enrichPhonetics(ipa: IPAPhonetic): void {
    this._ipa = ipa;
    this._updatedAt = new Date();
  }

  public addCollocation(collocation: string): void {
    const cleaned = collocation.trim().toLowerCase();
    if (cleaned.length > 0) {
      this._collocations.add(cleaned);
      this._updatedAt = new Date();
    }
  }

  public addSynonym(synonym: string): void {
    const cleaned = synonym.trim().toLowerCase();
    if (cleaned.length > 0) {
      this._synonyms.add(cleaned);
      this._updatedAt = new Date();
    }
  }
}
