import { ISessionRepository } from '../../domain/interfaces/ISessionRepository';
import { IUserRepository } from '../../domain/interfaces/IUserRepository';
import { IAIGateway } from '../../domain/interfaces/IAIGateway';
import { PracticeSessionDTO } from '../dtos';
import { SpeechMetrics } from '../../domain/value-objects/SpeechMetrics';
import { DialogueTurn, PracticeSession } from '../../domain/entities/PracticeSession';

export interface EvaluateSpeechRequest {
  sessionId: string;
  userId: string;
  durationSeconds: number;
  wpm: number;
  hesitationCount: number;
  silenceDurations: number[];
  contextTitle: string;
  targetLevel?: 'a2' | 'b1' | 'b2' | 'c1' | 'c2';
  dialogue?: readonly DialogueTurn[];
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
    let session = await this.sessionRepository.findById(request.sessionId);
    if (!session) {
      session = PracticeSession.create({
        id: request.sessionId,
        userId: request.userId,
        mode: 'ielts_part1',
        topicId: 'default-topic',
      });
      session.startRecording();
      try {
        await this.sessionRepository.save(session);
      } catch (err) {
        console.warn('Session save notice:', err);
      }
    }

    // Ingest dialogue turns passed from the active session
    if (request.dialogue && request.dialogue.length > 0) {
      for (const turn of request.dialogue) {
        if (!session.transcriptDialogue.some((t) => t.id === turn.id)) {
          session.appendDialogueTurn(turn);
        }
      }
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
    const dialogueToEvaluate =
      session.transcriptDialogue.length > 0
        ? session.transcriptDialogue
        : (request.dialogue || []);

    const evaluationResult = await this.aiGateway.evaluateSpeech({
      contextTitle: request.contextTitle,
      targetLevel: request.targetLevel ?? 'b2',
      dialogue: dialogueToEvaluate,
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
    try {
      const user = await this.userRepository.findById(request.userId);
      if (user) {
        user.recordPracticeSession(request.durationSeconds);
        await this.userRepository.update(user);
      }
    } catch (err) {
      console.warn('User update notice:', err);
    }

    // 5. Persist completed session
    try {
      await this.sessionRepository.update(session);
    } catch (err) {
      console.warn('Session update notice:', err);
    }

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
