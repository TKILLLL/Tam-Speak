import { ITopicRepository } from '../../domain/interfaces/ITopicRepository';
import { CustomTopic } from '../../domain/entities/CustomTopic';
import { CustomTopicDTO } from '../dtos';
import { PromptSecurityGuard } from '../../infrastructure/security/PromptSecurityGuard';
import { SkillLevel } from '../../domain/entities/User';

export interface CreateCustomTopicRequest {
  id?: string;
  userId: string;
  title: string;
  description: string;
  contextPrompt: string;
  aiRole: string;
  userRole: string;
  targetKeywords?: string[];
  targetLevel?: SkillLevel;
  isPublic?: boolean;
}

/**
 * CreateCustomTopicUseCase
 * Secure creation of custom roleplays and speaking topics.
 * Sanitizes input through PromptSecurityGuard to block prompt injections before persistence.
 */
export class CreateCustomTopicUseCase {
  constructor(private readonly topicRepository: ITopicRepository) {}

  public async execute(request: CreateCustomTopicRequest): Promise<CustomTopicDTO> {
    // 1. Proactive AppSec Prompt Injection Scan
    PromptSecurityGuard.validateUserInput(request.title);
    PromptSecurityGuard.validateUserInput(request.description);
    PromptSecurityGuard.validateUserInput(request.contextPrompt);
    PromptSecurityGuard.validateUserInput(request.aiRole);
    PromptSecurityGuard.validateUserInput(request.userRole);

    const topicId = request.id || `topic-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // 2. Instantiate Rich Domain Entity (enforces domain invariants)
    const topic = CustomTopic.create({
      id: topicId,
      userId: request.userId,
      title: request.title,
      description: request.description,
      contextPrompt: request.contextPrompt,
      aiRole: request.aiRole,
      userRole: request.userRole,
      targetKeywords: request.targetKeywords,
      targetLevel: request.targetLevel,
      isPublic: request.isPublic,
    });

    // 3. Persist to repository
    await this.topicRepository.save(topic);

    return {
      id: topic.id,
      userId: topic.userId,
      title: topic.title,
      description: topic.description,
      contextPrompt: topic.contextPrompt,
      aiRole: topic.aiRole,
      userRole: topic.userRole,
      targetKeywords: [...topic.targetKeywords],
      targetLevel: topic.targetLevel,
      isPublic: topic.isPublic,
      createdAt: topic.createdAt.toISOString(),
    };
  }
}
