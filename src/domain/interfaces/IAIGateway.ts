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

  upgradeExpression(params: {
    sentence: string;
    currentBand: BandScore;
    targetBand: BandScore;
  }): Promise<UpgradedExpressionResult>;
}
