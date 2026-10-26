import { PracticeMode, SessionStatus, DialogueTurn, DetailedFeedbackPayload } from '../../domain/entities/PracticeSession';
import { SkillLevel } from '../../domain/entities/User';

export interface PracticeSessionDTO {
  id: string;
  userId: string;
  topicId: string | null;
  mode: PracticeMode;
  status: SessionStatus;
  durationSeconds: number;
  overallScore: number | null;
  pronunciationScore: number | null;
  fluencyScore: number | null;
  lexicalScore: number | null;
  grammarScore: number | null;
  wordsPerMinute: number;
  hesitationCount: number;
  transcriptDialogue: DialogueTurn[];
  detailedFeedback: DetailedFeedbackPayload | null;
  aiProviderUsed: string | null;
  createdAt: string;
}

export interface CustomTopicDTO {
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
  createdAt: string;
}

export interface VocabularyItemDTO {
  id: string;
  userId: string;
  word: string;
  ipa: string | null;
  definitionEn: string;
  definitionVi: string | null;
  exampleSentence: string | null;
  collocations: string[];
  synonyms: string[];
  masteryLevel: number;
  nextReviewDate: string;
  isDueForReview: boolean;
}

export interface UserProfileDTO {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  targetBand: number;
  currentLevel: SkillLevel;
  streakDays: number;
  lastPracticeDate: string | null;
  totalPracticeMinutes: number;
}
