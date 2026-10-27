import { IAIGateway, SpeakingAIChatResult } from '../../domain/interfaces/IAIGateway';
import { TokenBucketRateLimiter } from '../../infrastructure/security/TokenBucketRateLimiter';

export interface ChatSpeakingAIRequest {
  userId: string;
  rawSttInput: string;
  conversationHistory: ReadonlyArray<{ speaker: 'user' | 'ai'; text: string }>;
}

/**
 * ChatSpeakingAIUseCase
 * Orchestrates casual conversation with "Alex" (Native Best Friend):
 * - Rate limiting check
 * - Sliding context window (last 6 turns)
 * - Contextual phonetic auto-correction
 * - Purely in-memory ephemeral return (no persistence to Supabase/IndexedDB)
 */
export class ChatSpeakingAIUseCase {
  constructor(
    private readonly aiGateway: IAIGateway,
    private readonly rateLimiter: TokenBucketRateLimiter
  ) {}

  public async execute(request: ChatSpeakingAIRequest): Promise<SpeakingAIChatResult> {
    this.rateLimiter.checkAndConsumeRequest(request.userId);

    return this.aiGateway.chatSpeakingAI({
      conversationHistory: request.conversationHistory,
      rawSttInput: request.rawSttInput,
    });
  }
}
