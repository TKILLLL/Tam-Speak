import { EmailAddress } from '../value-objects/EmailAddress';
import { BandScore } from '../value-objects/BandScore';
import { DomainError } from '../errors/DomainErrors';

export class InvalidUserError extends DomainError {
  constructor(message: string) {
    super(message, 'INVALID_USER_DATA', 422);
  }
}

export type SkillLevel = 'a2' | 'b1' | 'b2' | 'c1' | 'c2' | 'unrated';

export interface UserProps {
  id: string;
  email: EmailAddress;
  displayName: string;
  avatarUrl: string | null;
  targetBand: BandScore;
  currentLevel: SkillLevel;
  streakDays: number;
  lastPracticeDate: string | null; // Format: YYYY-MM-DD
  totalPracticeMinutes: number;
  role?: 'admin' | 'user';
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Rich Domain Entity representing a TamSpeak User.
 * Encapsulates domain invariants, streak tracking logic, and progress calculations.
 */
export class User {
  private readonly _id: string;
  private readonly _email: EmailAddress;
  private _displayName: string;
  private _avatarUrl: string | null;
  private _targetBand: BandScore;
  private _currentLevel: SkillLevel;
  private _streakDays: number;
  private _lastPracticeDate: string | null;
  private _totalPracticeMinutes: number;
  private _role: 'admin' | 'user';
  private readonly _createdAt: Date;
  private _updatedAt: Date;

  private constructor(props: UserProps) {
    this._id = props.id;
    this._email = props.email;
    this._displayName = props.displayName;
    this._avatarUrl = props.avatarUrl;
    this._targetBand = props.targetBand;
    this._currentLevel = props.currentLevel;
    this._streakDays = props.streakDays;
    this._lastPracticeDate = props.lastPracticeDate;
    this._totalPracticeMinutes = props.totalPracticeMinutes;
    this._role = props.role ?? 'user';
    this._createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
  }

  public static create(params: {
    id: string;
    email: EmailAddress;
    displayName: string;
    avatarUrl?: string | null;
    targetBand?: BandScore;
    currentLevel?: SkillLevel;
  }): User {
    if (!params.id || params.id.trim().length === 0) {
      throw new InvalidUserError('User ID is required.');
    }

    const trimmedName = params.displayName.trim();
    if (trimmedName.length === 0 || trimmedName.length > 100) {
      throw new InvalidUserError('Display name must be between 1 and 100 characters.');
    }

    const now = new Date();
    return new User({
      id: params.id,
      email: params.email,
      displayName: trimmedName,
      avatarUrl: params.avatarUrl ?? null,
      targetBand: params.targetBand ?? BandScore.create(7.5),
      currentLevel: params.currentLevel ?? 'unrated',
      streakDays: 0,
      lastPracticeDate: null,
      totalPracticeMinutes: 0,
      createdAt: now,
      updatedAt: now,
    });
  }

  public static reconstitute(props: UserProps): User {
    return new User(props);
  }

  // Getters
  public get id(): string { return this._id; }
  public get email(): EmailAddress { return this._email; }
  public get displayName(): string { return this._displayName; }
  public get avatarUrl(): string | null { return this._avatarUrl; }
  public get targetBand(): BandScore { return this._targetBand; }
  public get currentLevel(): SkillLevel { return this._currentLevel; }
  public get streakDays(): number { return this._streakDays; }
  public get lastPracticeDate(): string | null { return this._lastPracticeDate; }
  public get totalPracticeMinutes(): number { return this._totalPracticeMinutes; }
  public get role(): 'admin' | 'user' { return this._role; }
  public get createdAt(): Date { return this._createdAt; }
  public get updatedAt(): Date { return this._updatedAt; }

  // Business Methods
  public updateDisplayName(newName: string): void {
    const trimmed = newName.trim();
    if (trimmed.length === 0 || trimmed.length > 100) {
      throw new InvalidUserError('Display name must be between 1 and 100 characters.');
    }
    this._displayName = trimmed;
    this._updatedAt = new Date();
  }

  public updateTargetBand(newTarget: BandScore): void {
    this._targetBand = newTarget;
    this._updatedAt = new Date();
  }

  public updateCurrentLevel(newLevel: SkillLevel): void {
    this._currentLevel = newLevel;
    this._updatedAt = new Date();
  }

  public updateAvatarUrl(url: string | null): void {
    this._avatarUrl = url;
    this._updatedAt = new Date();
  }

  /**
   * Domain business logic for recording practice activity and updating streak.
   * Compares the date of practice against lastPracticeDate (YYYY-MM-DD format):
   * - Same day: streak unchanged, duration added.
   * - Next consecutive calendar day: streak incremented (+1).
   * - Missed one or more calendar days: streak reset to 1.
   */
  public recordPracticeSession(durationSeconds: number, sessionDate: Date = new Date()): void {
    if (durationSeconds < 0) {
      throw new InvalidUserError('Practice duration cannot be negative.');
    }

    const minutesPracticed = Math.round(durationSeconds / 60);
    this._totalPracticeMinutes += minutesPracticed;

    const sessionDateString = sessionDate.toISOString().split('T')[0];

    if (!this._lastPracticeDate) {
      this._streakDays = 1;
      this._lastPracticeDate = sessionDateString;
    } else if (this._lastPracticeDate === sessionDateString) {
      // Already practiced today, keep streak
    } else {
      const lastDate = new Date(this._lastPracticeDate);
      const currentDate = new Date(sessionDateString);
      const diffTime = Math.abs(currentDate.getTime() - lastDate.getTime());
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        // Consecutive day
        this._streakDays += 1;
      } else {
        // Gap > 1 day, reset streak
        this._streakDays = 1;
      }
      this._lastPracticeDate = sessionDateString;
    }

    this._updatedAt = new Date();
  }

  public isTargetBandAchieved(evaluatedScore: BandScore): boolean {
    return evaluatedScore.isGreaterThanOrEqual(this._targetBand);
  }
}
