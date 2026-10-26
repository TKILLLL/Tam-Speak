import { ISessionRepository } from '../../domain/interfaces/ISessionRepository';
import { IAIGateway, RoleplayReplyResult } from '../../domain/interfaces/IAIGateway';
import { TokenBucketRateLimiter } from '../../infrastructure/security/TokenBucketRateLimiter';
import { EntityNotFoundError } from '../../domain/errors/DomainErrors';

export interface ChatRoleplayRequest {
  sessionId: string;
  userId: string;
  systemInstruction: string;
  userMessage: string;
  timestampSeconds: number;
}

/**
 * ChatRoleplayUseCase
 * Coordinates interactive voice-to-voice turn taking.
 * - Rate limits user calls
 * - Employs sliding window (last 4 dialogue turns) to minimize LLM token consumption
 * - Appends user and AI turns to session state and persists to database
 */
export class ChatRoleplayUseCase {
  constructor(
    private readonly sessionRepository: ISessionRepository,
    private readonly aiGateway: IAIGateway,
    private readonly rateLimiter: TokenBucketRateLimiter
  ) {}

  public async execute(request: ChatRoleplayRequest): Promise<RoleplayReplyResult> {
    // 1. Rate Limiting Check
    this.rateLimiter.checkAndConsumeRequest(request.userId);

    // 2. Fetch Active Session
    const session = await this.sessionRepository.findById(request.sessionId);
    if (!session) {
      throw new EntityNotFoundError('PracticeSession', request.sessionId);
    }

    // 3. Append User Dialogue Turn
    session.appendDialogueTurn({
      id: `turn-user-${Date.now()}`,
      speaker: 'user',
      text: request.userMessage,
      timestampSeconds: request.timestampSeconds,
    });

    // 4. Generate AI Reply via Resilient Multi-tier AI Gateway
    const replyResult = await this.aiGateway.generateRoleplayReply({
      systemInstruction: request.systemInstruction,
      conversationHistory: session.transcriptDialogue,
      userLatestMessage: request.userMessage,
    });

    // 5. Append AI Dialogue Turn
    session.appendDialogueTurn({
      id: `turn-ai-${Date.now()}`,
      speaker: 'ai',
      text: replyResult.replyText,
      timestampSeconds: request.timestampSeconds + 2,
      ipaCorrections: replyResult.ipaCorrections,
    });

    // 6. Update Session in Repository
    await this.sessionRepository.update(session);

    return replyResult;
  }
}
