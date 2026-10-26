import { BandScore } from '../value-objects/BandScore';
import { SpeechMetrics } from '../value-objects/SpeechMetrics';
import { DomainError } from '../errors/DomainErrors';

export class InvalidSessionStateError extends DomainError {
  constructor(message: string) {
    super(message, 'INVALID_SESSION_STATE', 400);
  }
}

export type PracticeMode =
  | 'ielts_part1'
  | 'ielts_part2'
  | 'ielts_part3'
  | 'ielts_full_mock'
  | 'daily_conversation'
  | 'custom_roleplay'
  | 'pronunciation_lab'
  | 'placement_test';

export type SessionStatus = 'created' | 'recording' | 'analyzing' | 'completed' | 'abandoned';

export interface DialogueTurn {
  id: string;
  speaker: 'ai' | 'user';
  text: string;
  timestampSeconds: number;
  audioBlobId?: string;
  wpm?: number;
  hesitationsDetected?: number;
  ipaCorrections?: Array<{
    word: string;
    expectedIpa: string;
    spokenIpa: string;
  }>;
}

export interface DetailedFeedbackPayload {
  summary: string;
  strengths: string[];
  weaknesses: string[];
  suggestedPhrases: Array<{ original: string; improved: string; reason: string }>;
  grammarCorrections: Array<{ original: string; corrected: string; explanation: string }>;
  vocabularyEnhancements: Array<{ basicWord: string; advancedAlternative: string; collocations: string[] }>;
}

export interface PracticeSessionProps {
  id: string;
  userId: string;
  topicId: string | null;
  mode: PracticeMode;
  status: SessionStatus;
  durationSeconds: number;
  speechMetrics: SpeechMetrics | null;
  overallScore: BandScore | null;
  pronunciationScore: BandScore | null;
  fluencyScore: BandScore | null;
  lexicalScore: BandScore | null;
  grammarScore: BandScore | null;
  transcriptDialogue: DialogueTurn[];
  detailedFeedback: DetailedFeedbackPayload | null;
  aiProviderUsed: string | null;
  createdAt: Date;
}

/**
 * Rich Domain Entity representing an English Practice Session.
 * Enforces session lifecycle state transitions and official IELTS composite score calculations.
 */
export class PracticeSession {
  private readonly _id: string;
  private readonly _userId: string;
  private readonly _topicId: string | null;
  private readonly _mode: PracticeMode;
  private _status: SessionStatus;
  private _durationSeconds: number;
  private _speechMetrics: SpeechMetrics | null;
  private _overallScore: BandScore | null;
  private _pronunciationScore: BandScore | null;
  private _fluencyScore: BandScore | null;
  private _lexicalScore: BandScore | null;
  private _grammarScore: BandScore | null;
  private readonly _transcriptDialogue: DialogueTurn[];
  private _detailedFeedback: DetailedFeedbackPayload | null;
  private _aiProviderUsed: string | null;
  private readonly _createdAt: Date;

  private constructor(props: PracticeSessionProps) {
    this._id = props.id;
    this._userId = props.userId;
    this._topicId = props.topicId;
    this._mode = props.mode;
    this._status = props.status;
    this._durationSeconds = props.durationSeconds;
    this._speechMetrics = props.speechMetrics;
    this._overallScore = props.overallScore;
    this._pronunciationScore = props.pronunciationScore;
    this._fluencyScore = props.fluencyScore;
    this._lexicalScore = props.lexicalScore;
    this._grammarScore = props.grammarScore;
    this._transcriptDialogue = [...props.transcriptDialogue];
    this._detailedFeedback = props.detailedFeedback;
    this._aiProviderUsed = props.aiProviderUsed;
    this._createdAt = props.createdAt;
  }

  public static create(params: {
    id: string;
    userId: string;
    mode: PracticeMode;
    topicId?: string | null;
  }): PracticeSession {
    if (!params.id || params.id.trim().length === 0) {
      throw new InvalidSessionStateError('Session ID is required.');
    }
    if (!params.userId || params.userId.trim().length === 0) {
      throw new InvalidSessionStateError('User ID is required.');
    }

    return new PracticeSession({
      id: params.id,
      userId: params.userId,
      topicId: params.topicId ?? null,
      mode: params.mode,
      status: 'created',
      durationSeconds: 0,
      speechMetrics: null,
      overallScore: null,
      pronunciationScore: null,
      fluencyScore: null,
      lexicalScore: null,
      grammarScore: null,
      transcriptDialogue: [],
      detailedFeedback: null,
      aiProviderUsed: null,
      createdAt: new Date(),
    });
  }

  public static reconstitute(props: PracticeSessionProps): PracticeSession {
    return new PracticeSession(props);
  }

  // Getters
  public get id(): string { return this._id; }
  public get userId(): string { return this._userId; }
  public get topicId(): string | null { return this._topicId; }
  public get mode(): PracticeMode { return this._mode; }
  public get status(): SessionStatus { return this._status; }
  public get durationSeconds(): number { return this._durationSeconds; }
  public get speechMetrics(): SpeechMetrics | null { return this._speechMetrics; }
  public get overallScore(): BandScore | null { return this._overallScore; }
  public get pronunciationScore(): BandScore | null { return this._pronunciationScore; }
  public get fluencyScore(): BandScore | null { return this._fluencyScore; }
  public get lexicalScore(): BandScore | null { return this._lexicalScore; }
  public get grammarScore(): BandScore | null { return this._grammarScore; }
  public get transcriptDialogue(): readonly DialogueTurn[] { return Object.freeze([...this._transcriptDialogue]); }
  public get detailedFeedback(): DetailedFeedbackPayload | null { return this._detailedFeedback; }
  public get aiProviderUsed(): string | null { return this._aiProviderUsed; }
  public get createdAt(): Date { return this._createdAt; }

  // Business Methods
  public startRecording(): void {
    if (this._status !== 'created' && this._status !== 'recording') {
      throw new InvalidSessionStateError(
        `Cannot start recording from current session status "${this._status}".`
      );
    }
    this._status = 'recording';
  }

  public appendDialogueTurn(turn: DialogueTurn): void {
    if (this._status !== 'recording' && this._status !== 'created') {
      throw new InvalidSessionStateError(
        `Cannot append dialogue turn when session is in "${this._status}" status.`
      );
    }
    if (!turn.text || turn.text.trim().length === 0) {
      throw new InvalidSessionStateError('Dialogue text cannot be empty.');
    }
    this._transcriptDialogue.push({ ...turn });
  }

  public completeRecording(durationSeconds: number, metrics?: SpeechMetrics): void {
    if (this._status !== 'recording' && this._status !== 'created') {
      throw new InvalidSessionStateError(
        `Cannot complete recording from status "${this._status}".`
      );
    }
    if (durationSeconds < 0) {
      throw new InvalidSessionStateError('Session duration cannot be negative.');
    }

    this._durationSeconds = durationSeconds;
    if (metrics) {
      this._speechMetrics = metrics;
    }
    this._status = 'analyzing';
  }

  /**
   * Applies 4-criterion IELTS scoring (Pronunciation, Fluency, Lexical, Grammar),
   * calculates the composite overall band using official IELTS half-band rounding,
   * stores detailed feedback and transitions to 'completed'.
   */
  public finalizeEvaluation(params: {
    pronunciationScore: BandScore;
    fluencyScore: BandScore;
    lexicalScore: BandScore;
    grammarScore: BandScore;
    detailedFeedback: DetailedFeedbackPayload;
    aiProviderUsed: string;
  }): void {
    if (this._status !== 'analyzing') {
      throw new InvalidSessionStateError(
        `Cannot finalize evaluation when session status is "${this._status}". Must be "analyzing".`
      );
    }

    this._pronunciationScore = params.pronunciationScore;
    this._fluencyScore = params.fluencyScore;
    this._lexicalScore = params.lexicalScore;
    this._grammarScore = params.grammarScore;
    this._detailedFeedback = params.detailedFeedback;
    this._aiProviderUsed = params.aiProviderUsed;

    // Official IELTS Overall Band calculation:
    // Average of 4 criteria, rounded to nearest 0.5 according to IELTS guidelines
    const average =
      (params.pronunciationScore.getValue() +
        params.fluencyScore.getValue() +
        params.lexicalScore.getValue() +
        params.grammarScore.getValue()) / 4.0;

    this._overallScore = BandScore.fromRawAverage(average);
    this._status = 'completed';
  }

  public abandon(): void {
    if (this._status === 'completed') {
      throw new InvalidSessionStateError('Cannot abandon an already completed session.');
    }
    this._status = 'abandoned';
  }

  public isCompleted(): boolean {
    return this._status === 'completed';
  }
}
