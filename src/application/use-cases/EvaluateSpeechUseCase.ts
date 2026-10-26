import { ISessionRepository } from '../../domain/interfaces/ISessionRepository';
import { IUserRepository } from '../../domain/interfaces/IUserRepository';
import { IAIGateway } from '../../domain/interfaces/IAIGateway';
import { PracticeSessionDTO } from '../dtos';
import { SpeechMetrics } from '../../domain/value-objects/SpeechMetrics';
import { EntityNotFoundError } from '../../domain/errors/DomainErrors';

export interface EvaluateSpeechRequest {
  sessionId: string;
  userId: string;
  durationSeconds: number;
  wpm: number;
  hesitationCount: number;
  silenceDurations: number[];
  contextTitle: string;
  targetLevel?: 'a2' | 'b1' | 'b2' | 'c1' | 'c2';
}

/**
 * EvaluateSpeechUseCase
 * Orchestrates:
 * 1. Client-side SpeechMetrics ingestion (0-Token)
 * 2. Multi-tier AI Gateway evaluation for IELTS 4-criteria
 * 3. Official IELTS composite overall score computation
 * 4. User streak and practice time update
 * 5. Repository persistence
 */
export class EvaluateSpeechUseCase {
  constructor(
    private readonly sessionRepository: ISessionRepository,
    private readonly userRepository: IUserRepository,
    private readonly aiGateway: IAIGateway
  ) {}

  public async execute(request: EvaluateSpeechRequest): Promise<PracticeSessionDTO> {
    const session = await this.sessionRepository.findById(request.sessionId);
    if (!session) {
      throw new EntityNotFoundError('PracticeSession', request.sessionId);
    }

    // 1. Build immutable SpeechMetrics Value Object
    const speechMetrics = SpeechMetrics.create({
      wpm: request.wpm,
      hesitationCount: request.hesitationCount,
      silenceDurations: request.silenceDurations,
      totalDurationSeconds: request.durationSeconds,
    });

    session.completeRecording(request.durationSeconds, speechMetrics);

    // 2. Call AI Gateway for 4-criterion IELTS evaluation
    const evaluationResult = await this.aiGateway.evaluateSpeech({
      contextTitle: request.contextTitle,
      targetLevel: request.targetLevel ?? 'b2',
      dialogue: session.transcriptDialogue,
    });

    // 3. Finalize evaluation in domain model (computes composite band)
    session.finalizeEvaluation({
      pronunciationScore: evaluationResult.pronunciationScore,
      fluencyScore: evaluationResult.fluencyScore,
      lexicalScore: evaluationResult.lexicalScore,
      grammarScore: evaluationResult.grammarScore,
      detailedFeedback: evaluationResult.detailedFeedback,
      aiProviderUsed: evaluationResult.providerUsed,
    });

    // 4. Update user streak and practice minutes
    const user = await this.userRepository.findById(request.userId);
    if (user) {
      user.recordPracticeSession(request.durationSeconds);
      await this.userRepository.update(user);
    }

    // 5. Persist completed session
    await this.sessionRepository.update(session);

    return {
      id: session.id,
      userId: session.userId,
      topicId: session.topicId,
      mode: session.mode,
      status: session.status,
      durationSeconds: session.durationSeconds,
      overallScore: session.overallScore ? session.overallScore.getValue() : null,
      pronunciationScore: session.pronunciationScore ? session.pronunciationScore.getValue() : null,
      fluencyScore: session.fluencyScore ? session.fluencyScore.getValue() : null,
      lexicalScore: session.lexicalScore ? session.lexicalScore.getValue() : null,
      grammarScore: session.grammarScore ? session.grammarScore.getValue() : null,
      wordsPerMinute: speechMetrics.getWpm(),
      hesitationCount: speechMetrics.getHesitationCount(),
      transcriptDialogue: [...session.transcriptDialogue],
      detailedFeedback: session.detailedFeedback,
      aiProviderUsed: session.aiProviderUsed,
      createdAt: session.createdAt.toISOString(),
    };
  }
}
