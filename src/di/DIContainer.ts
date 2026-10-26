import { supabase } from '../infrastructure/database/supabase/supabaseClient';
import { SupabaseUserRepository } from '../infrastructure/repositories/SupabaseUserRepository';
import { SupabaseSessionRepository } from '../infrastructure/repositories/SupabaseSessionRepository';
import { SupabaseTopicRepository } from '../infrastructure/repositories/SupabaseTopicRepository';
import { SupabaseVocabRepository } from '../infrastructure/repositories/SupabaseVocabRepository';
import { DexieLocalAudioRepository } from '../infrastructure/repositories/DexieLocalAudioRepository';

import { ResilientAIGateway } from '../infrastructure/ai/ResilientAIGateway';
import { UnifiedDictionaryGateway } from '../infrastructure/external/UnifiedDictionaryGateway';
import { WebCryptoVaultService } from '../infrastructure/security/WebCryptoVaultService';
import { TokenBucketRateLimiter } from '../infrastructure/security/TokenBucketRateLimiter';
import { rawDataIngestionService } from '../infrastructure/ingestion/RawDataIngestionService';

import { AudioRecorderEngine } from '../infrastructure/audio/AudioRecorderEngine';
import { WebSpeechSTTEngine } from '../infrastructure/audio/WebSpeechSTTEngine';
import { WebSpeechTTSEngine } from '../infrastructure/audio/WebSpeechTTSEngine';

import { EvaluateSpeechUseCase } from '../application/use-cases/EvaluateSpeechUseCase';
import { CreateCustomTopicUseCase } from '../application/use-cases/CreateCustomTopicUseCase';
import { ImportRawDataUseCase } from '../application/use-cases/ImportRawDataUseCase';
import { ChatRoleplayUseCase } from '../application/use-cases/ChatRoleplayUseCase';
import { UpgradeBandScoreUseCase } from '../application/use-cases/UpgradeBandScoreUseCase';
import { SpacedRepetitionReviewUseCase } from '../application/use-cases/SpacedRepetitionReviewUseCase';

/**
 * DIContainer
 * Central Dependency Injection Container adhering to Clean Architecture.
 * Resolves all singletons, gateways, repositories, and use cases without leaking
 * infrastructure details into UI presentation components.
 */
export class DIContainer {
  // Repositories
  public readonly userRepository: SupabaseUserRepository;
  public readonly sessionRepository: SupabaseSessionRepository;
  public readonly topicRepository: SupabaseTopicRepository;
  public readonly vocabRepository: SupabaseVocabRepository;
  public readonly localAudioRepository: DexieLocalAudioRepository;

  // Gateways & Security
  public readonly aiGateway: ResilientAIGateway;
  public readonly dictionaryGateway: UnifiedDictionaryGateway;
  public readonly cryptoService: WebCryptoVaultService;
  public readonly rateLimiter: TokenBucketRateLimiter;

  // Audio & Ingestion Services
  public readonly audioRecorderEngine: AudioRecorderEngine;
  public readonly speechSTTEngine: WebSpeechSTTEngine;
  public readonly speechTTSEngine: WebSpeechTTSEngine;

  // Application Use Cases
  public readonly evaluateSpeechUseCase: EvaluateSpeechUseCase;
  public readonly createCustomTopicUseCase: CreateCustomTopicUseCase;
  public readonly importRawDataUseCase: ImportRawDataUseCase;
  public readonly chatRoleplayUseCase: ChatRoleplayUseCase;
  public readonly upgradeBandScoreUseCase: UpgradeBandScoreUseCase;
  public readonly spacedRepetitionReviewUseCase: SpacedRepetitionReviewUseCase;

  constructor() {
    // 1. Repositories
    this.userRepository = new SupabaseUserRepository(supabase);
    this.sessionRepository = new SupabaseSessionRepository(supabase);
    this.topicRepository = new SupabaseTopicRepository(supabase);
    this.vocabRepository = new SupabaseVocabRepository(supabase);
    this.localAudioRepository = new DexieLocalAudioRepository();

    // 2. Gateways & AppSec Services
    const defaultGeminiKey =
      (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GEMINI_API_KEY) ||
      (typeof process !== 'undefined' && process.env?.VITE_GEMINI_API_KEY) ||
      '';
    const defaultGroqKey =
      (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GROQ_API_KEY) ||
      (typeof process !== 'undefined' && process.env?.VITE_GROQ_API_KEY) ||
      '';
    const defaultOpenRouterKey =
      (typeof import.meta !== 'undefined' && import.meta.env?.VITE_OPENROUTER_API_KEY) ||
      (typeof process !== 'undefined' && process.env?.VITE_OPENROUTER_API_KEY) ||
      '';

    this.aiGateway = new ResilientAIGateway({
      geminiKeys: defaultGeminiKey ? [defaultGeminiKey] : [],
      groqKeys: defaultGroqKey ? [defaultGroqKey] : [],
      openRouterKeys: defaultOpenRouterKey ? [defaultOpenRouterKey] : [],
    });
    this.dictionaryGateway = new UnifiedDictionaryGateway();
    this.cryptoService = new WebCryptoVaultService();
    this.rateLimiter = new TokenBucketRateLimiter();

    // 3. Audio & Ingestion Engines
    this.audioRecorderEngine = new AudioRecorderEngine();
    this.speechSTTEngine = new WebSpeechSTTEngine();
    this.speechTTSEngine = new WebSpeechTTSEngine();

    // 4. Application Use Cases (Constructor Dependency Injection)
    this.evaluateSpeechUseCase = new EvaluateSpeechUseCase(
      this.sessionRepository,
      this.userRepository,
      this.aiGateway
    );

    this.createCustomTopicUseCase = new CreateCustomTopicUseCase(this.topicRepository);

    this.importRawDataUseCase = new ImportRawDataUseCase(rawDataIngestionService);

    this.chatRoleplayUseCase = new ChatRoleplayUseCase(
      this.sessionRepository,
      this.aiGateway,
      this.rateLimiter
    );

    this.upgradeBandScoreUseCase = new UpgradeBandScoreUseCase(this.aiGateway);

    this.spacedRepetitionReviewUseCase = new SpacedRepetitionReviewUseCase(this.vocabRepository);
  }
}

// Global Singleton Application Container
export const container = new DIContainer();
