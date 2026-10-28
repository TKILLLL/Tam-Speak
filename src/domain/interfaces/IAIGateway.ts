import { BandScore } from '../value-objects/BandScore';
import { DialogueTurn, DetailedFeedbackPayload } from '../entities/PracticeSession';
import { type SkillLevel } from '../entities/User';

export interface EvaluationResult {
  pronunciationScore: BandScore;
  fluencyScore: BandScore;
  lexicalScore: BandScore;
  grammarScore: BandScore;
  detailedFeedback: DetailedFeedbackPayload;
  providerUsed: string;
}

export interface RoleplayReplyResult {
  replyText: string;
  suggestedCorrection?: string;
  ipaCorrections?: Array<{
    word: string;
    expectedIpa: string;
    spokenIpa: string;
  }>;
  providerUsed: string;
}

export interface UpgradedExpressionResult {
  originalSentence: string;
  upgradedSentence: string;
  explanation: string;
  nativeIdiomsUsed: string[];
  estimatedBand: BandScore;
}

export interface SpeakingAIChatResult {
  rawSttInput: string;
  inferredIntendedMeaning: string;
  wasSttMisrecognized: boolean;
  friendReply: string;
  casualNativeTip?: string;
  mispronouncedWords: Array<{
    word: string;
    ipa: string;
    reason: string;
  }>;
  providerUsed: string;
}

export interface IAIGateway {
  evaluateSpeech(params: {
    contextTitle: string;
    targetLevel: SkillLevel;
    dialogue: readonly DialogueTurn[];
  }): Promise<EvaluationResult>;

  generateRoleplayReply(params: {
    systemInstruction: string;
    conversationHistory: readonly DialogueTurn[];
    userLatestMessage: string;
  }): Promise<RoleplayReplyResult>;

  chatSpeakingAI(params: {
    conversationHistory: ReadonlyArray<{ speaker: 'user' | 'ai'; text: string }>;
    rawSttInput: string;
  }): Promise<SpeakingAIChatResult>;

  upgradeExpression(params: {
    sentence: string;
    currentBand: BandScore;
    targetBand: BandScore;
  }): Promise<UpgradedExpressionResult>;

  setPersonalKey?(provider: 'gemini' | 'groq' | 'openrouter', key: string | null, userId?: string | null): void;
  getPersonalKey?(provider: 'gemini' | 'groq' | 'openrouter', userId?: string | null): string | null;
  clearPersonalKeys?(): void;
  transcribeAudio?(audioBlob: Blob, promptContext?: string): Promise<string>;
}
