import { z } from 'zod';
import {
  IAIGateway,
  EvaluationResult,
  RoleplayReplyResult,
  UpgradedExpressionResult,
} from '../../domain/interfaces/IAIGateway';
import { BandScore } from '../../domain/value-objects/BandScore';
import { DialogueTurn } from '../../domain/entities/PracticeSession';
import { type SkillLevel } from '../../domain/entities/User';
import { CircuitBreaker } from '../security/CircuitBreaker';
import { PromptSecurityGuard } from '../security/PromptSecurityGuard';
import { IAIProviderStrategy, ChatMessagePayload } from './providers/IAIProviderStrategy';
import { GeminiProviderStrategy } from './providers/GeminiProviderStrategy';
import { GroqProviderStrategy } from './providers/GroqProviderStrategy';
import { OpenRouterProviderStrategy } from './providers/OpenRouterProviderStrategy';

// --- Zod Schemas for LLM Output Validation ---

const evaluationOutputSchema = z.object({
  pronunciationScore: z.number().min(0).max(9),
  fluencyScore: z.number().min(0).max(9),
  lexicalScore: z.number().min(0).max(9),
  grammarScore: z.number().min(0).max(9),
  detailedFeedback: z.object({
    summary: z.string(),
    strengths: z.array(z.string()),
    weaknesses: z.array(z.string()),
    suggestedPhrases: z.array(
      z.object({
        original: z.string(),
        improved: z.string(),
        reason: z.string(),
      })
    ),
    grammarCorrections: z.array(
      z.object({
        original: z.string(),
        corrected: z.string(),
        explanation: z.string(),
      })
    ),
    vocabularyEnhancements: z.array(
      z.object({
        basicWord: z.string(),
        advancedAlternative: z.string(),
        collocations: z.array(z.string()),
      })
    ),
  }),
});

const roleplayReplyOutputSchema = z.object({
  replyText: z.string().min(1),
  suggestedCorrection: z.string().optional(),
  ipaCorrections: z
    .array(
      z.object({
        word: z.string(),
        expectedIpa: z.string(),
        spokenIpa: z.string(),
      })
    )
    .optional(),
});

const upgradeExpressionOutputSchema = z.object({
  originalSentence: z.string(),
  upgradedSentence: z.string(),
  explanation: z.string(),
  nativeIdiomsUsed: z.array(z.string()),
  estimatedBand: z.number().min(0).max(9),
});

export interface KeyPoolEntry {
  provider: 'gemini' | 'groq' | 'openrouter';
  keys: string[];
  currentIndex: number;
}

/**
 * ResilientAIGateway
 * Production Multi-Tier AI Gateway:
 * - Strategy Pattern for multiple AI Providers
 * - Circuit Breaker pattern on each provider
 * - Key Rotation across shared key arrays on 429/503 errors
 * - Sliding Window context compression (last 4 dialogue turns)
 * - Automatic Fallback Chain: Gemini Pro -> Flash -> Flash-Lite -> Groq -> OpenRouter
 * - Zod Schema Validation on AI JSON outputs
 */
export class ResilientAIGateway implements IAIGateway {
  private readonly strategies: Map<string, IAIProviderStrategy> = new Map();
  private readonly circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private readonly keyPools: Map<string, KeyPoolEntry> = new Map();

  constructor(
    customKeyConfig?: {
      geminiKeys?: string[];
      groqKeys?: string[];
      openRouterKeys?: string[];
    }
  ) {
    // Register Default Strategies
    this.registerStrategy(new GeminiProviderStrategy('gemini_pro', 'gemini-2.5-pro'));
    this.registerStrategy(new GeminiProviderStrategy('gemini_flash', 'gemini-2.5-flash'));
    this.registerStrategy(new GeminiProviderStrategy('gemini_flash_lite', 'gemini-2.5-flash-lite'));
    this.registerStrategy(new GroqProviderStrategy('llama-3.3-70b-versatile'));
    this.registerStrategy(new OpenRouterProviderStrategy('meta-llama/llama-3.3-70b-instruct:free'));

    // Initialize Key Pools
    this.setKeyPool('gemini', customKeyConfig?.geminiKeys ?? []);
    this.setKeyPool('groq', customKeyConfig?.groqKeys ?? []);
    this.setKeyPool('openrouter', customKeyConfig?.openRouterKeys ?? []);
  }

  public registerStrategy(strategy: IAIProviderStrategy): void {
    this.strategies.set(strategy.providerId, strategy);
    this.circuitBreakers.set(strategy.providerId, new CircuitBreaker(strategy.providerId));
  }

  public setKeyPool(provider: 'gemini' | 'groq' | 'openrouter', keys: string[]): void {
    const validKeys = keys.map((k) => k.trim()).filter((k) => k.length > 0);
    this.keyPools.set(provider, {
      provider,
      keys: validKeys,
      currentIndex: 0,
    });
  }

  /**
   * Retrieves the current key for a provider and supports key rotation on error.
   */
  private getActiveKey(providerCategory: 'gemini' | 'groq' | 'openrouter'): string {
    const pool = this.keyPools.get(providerCategory);
    if (!pool || pool.keys.length === 0) {
      throw new Error(
        `No API key configured for provider "${providerCategory}". Please add a key in Settings.`
      );
    }
    return pool.keys[pool.currentIndex % pool.keys.length]!;
  }

  private rotateKey(providerCategory: 'gemini' | 'groq' | 'openrouter'): void {
    const pool = this.keyPools.get(providerCategory);
    if (pool && pool.keys.length > 1) {
      pool.currentIndex = (pool.currentIndex + 1) % pool.keys.length;
    }
  }

  /**
   * Dispatches an AI request across the fallback chain with Circuit Breakers & Key Rotation.
   */
  private async executeWithFallback(
    providerChain: string[],
    systemPrompt: string,
    messages: ChatMessagePayload[],
    jsonMode = true
  ): Promise<{ response: string; providerUsed: string }> {
    const errors: string[] = [];

    for (const providerId of providerChain) {
      const strategy = this.strategies.get(providerId);
      const breaker = this.circuitBreakers.get(providerId);

      if (!strategy || !breaker) continue;

      if (!breaker.isAvailable()) {
        errors.push(`${providerId} skipped (Circuit Breaker OPEN)`);
        continue;
      }

      const providerCategory: 'gemini' | 'groq' | 'openrouter' = providerId.startsWith('gemini')
        ? 'gemini'
        : providerId === 'groq'
        ? 'groq'
        : 'openrouter';

      const pool = this.keyPools.get(providerCategory);
      const attemptsCount = Math.max(1, pool?.keys.length ?? 1);

      for (let attempt = 0; attempt < attemptsCount; attempt++) {
        try {
          const apiKey = this.getActiveKey(providerCategory);
          const response = await strategy.generateChatCompletion({
            systemPrompt,
            messages,
            apiKey,
            jsonMode,
          });

          breaker.recordSuccess();
          return { response, providerUsed: `${providerId}:${strategy.modelName}` };
        } catch (err) {
          const errorMsg = (err as Error).message;
          errors.push(`[${providerId} key#${attempt}]: ${errorMsg}`);

          // If rate limited or service overloaded, rotate key and retry next key in pool
          if (errorMsg.includes('429') || errorMsg.includes('503') || errorMsg.includes('quota')) {
            this.rotateKey(providerCategory);
          }
        }
      }

      // If all keys for this provider failed, record failure on the breaker and fall back to next provider
      breaker.recordFailure();
    }

    throw new Error(`All AI providers in fallback chain failed: ${errors.join(' | ')}`);
  }

  // --- Implementation of IAIGateway Methods ---

  /**
   * Deep Speech Evaluation
   * Fallback: Gemini Pro -> Gemini Flash -> Gemini Flash-Lite -> Groq -> OpenRouter
   */
  public async evaluateSpeech(params: {
    contextTitle: string;
    targetLevel: SkillLevel;
    dialogue: readonly DialogueTurn[];
  }): Promise<EvaluationResult> {
    const rawSystemPrompt = [
      `You are an expert IELTS Speaking Examiner and Acoustic Pronunciation Evaluator.`,
      `Context: ${params.contextTitle}. Target Band CEFR: ${params.targetLevel.toUpperCase()}.`,
      `Analyze the transcript dialogue and provide rigorous IELTS band scoring for 4 criteria:`,
      `1. pronunciationScore (0.0 to 9.0 in increments of 0.5)`,
      `2. fluencyScore (0.0 to 9.0 in increments of 0.5)`,
      `3. lexicalScore (0.0 to 9.0 in increments of 0.5)`,
      `4. grammarScore (0.0 to 9.0 in increments of 0.5)`,
      `Provide a comprehensive JSON object matching the requested schema with detailed suggestions.`,
      `Output ONLY valid JSON.`,
    ].join('\n');

    const hardenedSystemPrompt = PromptSecurityGuard.buildHardenedSystemPrompt(rawSystemPrompt);

    // Build dialogue history representation
    const dialogueSummary = params.dialogue
      .map((d) => `${d.speaker.toUpperCase()}: ${d.text}`)
      .join('\n');

    const isolatedInput = PromptSecurityGuard.isolateUserInput(dialogueSummary);

    const messages: ChatMessagePayload[] = [
      {
        role: 'user',
        content: `Here is the speaking session dialogue transcript to evaluate:\n${isolatedInput}`,
      },
    ];

    const providerChain = ['gemini_pro', 'gemini_flash', 'gemini_flash_lite', 'groq', 'openrouter'];
    const { response, providerUsed } = await this.executeWithFallback(
      providerChain,
      hardenedSystemPrompt,
      messages,
      true
    );

    const parsed = PromptSecurityGuard.parseAndValidateJSON(response, evaluationOutputSchema);

    return {
      pronunciationScore: BandScore.fromRawAverage(parsed.pronunciationScore),
      fluencyScore: BandScore.fromRawAverage(parsed.fluencyScore),
      lexicalScore: BandScore.fromRawAverage(parsed.lexicalScore),
      grammarScore: BandScore.fromRawAverage(parsed.grammarScore),
      detailedFeedback: parsed.detailedFeedback,
      providerUsed,
    };
  }

  /**
   * Interactive Conversational Roleplay Reply (Voice-to-Voice)
   * Token Optimization: Sliding Window (last 4 dialogue turns)
   * Fallback: Gemini Flash -> Gemini Flash-Lite -> Groq -> OpenRouter
   */
  public async generateRoleplayReply(params: {
    systemInstruction: string;
    conversationHistory: readonly DialogueTurn[];
    userLatestMessage: string;
  }): Promise<RoleplayReplyResult> {
    const hardenedSystemPrompt = PromptSecurityGuard.buildHardenedSystemPrompt(
      [
        params.systemInstruction,
        `Respond in JSON with format:`,
        `{ "replyText": "...", "suggestedCorrection": "optional small grammar fix if any", "ipaCorrections": [] }`,
        `Keep replyText conversational, natural, and under 3 sentences for fluid voice-to-voice turn taking.`,
      ].join('\n')
    );

    // Sliding Window Optimization: Take at most 4 previous turns to save tokens
    const recentTurns = params.conversationHistory.slice(-4);
    const messages: ChatMessagePayload[] = recentTurns.map((turn) => ({
      role: turn.speaker === 'user' ? 'user' : 'assistant',
      content: turn.text,
    }));

    // Isolate latest user utterance
    const isolatedUserMessage = PromptSecurityGuard.isolateUserInput(params.userLatestMessage);
    messages.push({
      role: 'user',
      content: isolatedUserMessage,
    });

    const providerChain = ['gemini_flash', 'gemini_flash_lite', 'groq', 'openrouter'];
    const { response, providerUsed } = await this.executeWithFallback(
      providerChain,
      hardenedSystemPrompt,
      messages,
      true
    );

    const parsed = PromptSecurityGuard.parseAndValidateJSON(response, roleplayReplyOutputSchema);

    return {
      replyText: parsed.replyText,
      suggestedCorrection: parsed.suggestedCorrection,
      ipaCorrections: parsed.ipaCorrections,
      providerUsed,
    };
  }

  /**
   * Scratchpad Band Upgrade
   * Elevates a user sentence from current band to Band 7.5+ / 8.5+ native phrasing.
   */
  public async upgradeExpression(params: {
    sentence: string;
    currentBand: BandScore;
    targetBand: BandScore;
  }): Promise<UpgradedExpressionResult> {
    const rawPrompt = [
      `You are an IELTS Band 9 Speaking coach and native English editor.`,
      `Transform the user's basic English sentence to Band ${params.targetBand.toString()} level.`,
      `Requirements:`,
      `1. Keep the original intent intact.`,
      `2. Use idiomatic expressions, natural collocations, and advanced grammatical structures.`,
      `3. Explain the linguistic upgrade in concise terms.`,
      `Output ONLY valid JSON matching schema:`,
      `{ "originalSentence": "...", "upgradedSentence": "...", "explanation": "...", "nativeIdiomsUsed": ["..."], "estimatedBand": 8.0 }`,
    ].join('\n');

    const hardenedSystem = PromptSecurityGuard.buildHardenedSystemPrompt(rawPrompt);
    const isolatedInput = PromptSecurityGuard.isolateUserInput(params.sentence);

    const messages: ChatMessagePayload[] = [
      {
        role: 'user',
        content: `Upgrade this expression:\n${isolatedInput}`,
      },
    ];

    const providerChain = ['gemini_flash', 'gemini_flash_lite', 'groq', 'openrouter'];
    const { response } = await this.executeWithFallback(
      providerChain,
      hardenedSystem,
      messages,
      true
    );

    const parsed = PromptSecurityGuard.parseAndValidateJSON(response, upgradeExpressionOutputSchema);

    return {
      originalSentence: parsed.originalSentence,
      upgradedSentence: parsed.upgradedSentence,
      explanation: parsed.explanation,
      nativeIdiomsUsed: parsed.nativeIdiomsUsed,
      estimatedBand: BandScore.fromRawAverage(parsed.estimatedBand),
    };
  }
}
