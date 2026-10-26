import { DomainError } from '../errors/DomainErrors';
import { type SkillLevel } from './User';

export class InvalidTopicError extends DomainError {
  constructor(message: string) {
    super(message, 'INVALID_TOPIC_DATA', 422);
  }
}

export interface CustomTopicProps {
  id: string;
  userId: string;
  title: string;
  description: string;
  contextPrompt: string;
  aiRole: string;
  userRole: string;
  targetKeywords: string[];
  targetLevel: SkillLevel;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Rich Domain Entity representing a Speaking Topic or Roleplay Scenario.
 * Enforces validation on context length, role descriptions, and target vocabulary deduplication.
 */
export class CustomTopic {
  private readonly _id: string;
  private readonly _userId: string;
  private _title: string;
  private _description: string;
  private _contextPrompt: string;
  private _aiRole: string;
  private _userRole: string;
  private _targetKeywords: Set<string>;
  private _targetLevel: SkillLevel;
  private _isPublic: boolean;
  private readonly _createdAt: Date;
  private _updatedAt: Date;

  private constructor(props: CustomTopicProps) {
    this._id = props.id;
    this._userId = props.userId;
    this._title = props.title;
    this._description = props.description;
    this._contextPrompt = props.contextPrompt;
    this._aiRole = props.aiRole;
    this._userRole = props.userRole;
    this._targetKeywords = new Set(props.targetKeywords.map((k) => k.trim().toLowerCase()));
    this._targetLevel = props.targetLevel;
    this._isPublic = props.isPublic;
    this._createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
  }

  public static create(params: {
    id: string;
    userId: string;
    title: string;
    description: string;
    contextPrompt: string;
    aiRole: string;
    userRole: string;
    targetKeywords?: string[];
    targetLevel?: SkillLevel;
    isPublic?: boolean;
  }): CustomTopic {
    if (!params.id || params.id.trim().length === 0) {
      throw new InvalidTopicError('Topic ID is required.');
    }
    if (!params.userId || params.userId.trim().length === 0) {
      throw new InvalidTopicError('User ID is required.');
    }

    const title = params.title?.trim();
    if (!title || title.length < 3 || title.length > 150) {
      throw new InvalidTopicError('Topic title must be between 3 and 150 characters.');
    }

    const description = params.description?.trim();
    if (!description || description.length < 5 || description.length > 1000) {
      throw new InvalidTopicError('Topic description must be between 5 and 1000 characters.');
    }

    const aiRole = params.aiRole?.trim();
    if (!aiRole || aiRole.length < 2 || aiRole.length > 100) {
      throw new InvalidTopicError('AI Role definition must be between 2 and 100 characters.');
    }

    const userRole = params.userRole?.trim();
    if (!userRole || userRole.length < 2 || userRole.length > 100) {
      throw new InvalidTopicError('User Role definition must be between 2 and 100 characters.');
    }

    const now = new Date();
    return new CustomTopic({
      id: params.id,
      userId: params.userId,
      title,
      description,
      contextPrompt: params.contextPrompt?.trim() ?? '',
      aiRole,
      userRole,
      targetKeywords: params.targetKeywords ?? [],
      targetLevel: params.targetLevel ?? 'b2',
      isPublic: params.isPublic ?? false,
      createdAt: now,
      updatedAt: now,
    });
  }

  public static reconstitute(props: CustomTopicProps): CustomTopic {
    return new CustomTopic(props);
  }

  // Getters
  public get id(): string { return this._id; }
  public get userId(): string { return this._userId; }
  public get title(): string { return this._title; }
  public get description(): string { return this._description; }
  public get contextPrompt(): string { return this._contextPrompt; }
  public get aiRole(): string { return this._aiRole; }
  public get userRole(): string { return this._userRole; }
  public get targetKeywords(): readonly string[] { return Object.freeze(Array.from(this._targetKeywords)); }
  public get targetLevel(): SkillLevel { return this._targetLevel; }
  public get isPublic(): boolean { return this._isPublic; }
  public get createdAt(): Date { return this._createdAt; }
  public get updatedAt(): Date { return this._updatedAt; }

  // Business Methods
  public updateContent(params: {
    title?: string;
    description?: string;
    contextPrompt?: string;
  }): void {
    if (params.title !== undefined) {
      const title = params.title.trim();
      if (title.length < 3 || title.length > 150) {
        throw new InvalidTopicError('Title must be between 3 and 150 characters.');
      }
      this._title = title;
    }

    if (params.description !== undefined) {
      const description = params.description.trim();
      if (description.length < 5 || description.length > 1000) {
        throw new InvalidTopicError('Description must be between 5 and 1000 characters.');
      }
      this._description = description;
    }

    if (params.contextPrompt !== undefined) {
      this._contextPrompt = params.contextPrompt.trim();
    }

    this._updatedAt = new Date();
  }

  public updateRoles(aiRole: string, userRole: string): void {
    const trimmedAi = aiRole.trim();
    const trimmedUser = userRole.trim();

    if (trimmedAi.length < 2 || trimmedAi.length > 100) {
      throw new InvalidTopicError('AI Role must be between 2 and 100 characters.');
    }
    if (trimmedUser.length < 2 || trimmedUser.length > 100) {
      throw new InvalidTopicError('User Role must be between 2 and 100 characters.');
    }

    this._aiRole = trimmedAi;
    this._userRole = trimmedUser;
    this._updatedAt = new Date();
  }

  public addTargetKeyword(keyword: string): void {
    const cleaned = keyword.trim().toLowerCase();
    if (cleaned.length === 0 || cleaned.length > 50) {
      throw new InvalidTopicError('Keyword must be between 1 and 50 characters.');
    }
    if (this._targetKeywords.size >= 50) {
      throw new InvalidTopicError('A topic cannot have more than 50 target keywords.');
    }
    this._targetKeywords.add(cleaned);
    this._updatedAt = new Date();
  }

  public removeTargetKeyword(keyword: string): void {
    this._targetKeywords.delete(keyword.trim().toLowerCase());
    this._updatedAt = new Date();
  }

  public setPublic(isPublic: boolean): void {
    this._isPublic = isPublic;
    this._updatedAt = new Date();
  }

  /**
   * Constructs the XML-isolated conversational system prompt for the AI roleplayer.
   */
  public generateRoleplayInstruction(): string {
    const keywordsList = Array.from(this._targetKeywords).join(', ');
    return [
      `You are simulating: ${this._aiRole}.`,
      `The user is: ${this._userRole}.`,
      `Topic: ${this._title}.`,
      `Scenario Context: ${this._contextPrompt || this._description}`,
      keywordsList ? `Encourage natural opportunities for the user to use these keywords: [${keywordsList}].` : '',
      `Target CEFR Level: ${this._targetLevel.toUpperCase()}. Adjust your vocabulary and sentence structures appropriately.`,
      `Keep replies concise (2-3 sentences max) to maintain a natural voice-to-voice speaking flow.`,
    ]
      .filter(Boolean)
      .join('\n');
  }
}
