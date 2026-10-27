import { z } from 'zod';
import {
  IAIGateway,
  EvaluationResult,
  RoleplayReplyResult,
  UpgradedExpressionResult,
  SpeakingAIChatResult,
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

const speakingAIChatOutputSchema = z.object({
  raw_stt_input: z.string().optional(),
  inferred_intended_meaning: z.string().optional(),
  was_stt_misrecognized: z.boolean().optional(),
  friend_reply: z.string(),
  casual_native_tip: z.string().optional(),
  mispronounced_words: z
    .array(
      z.object({
        word: z.string(),
        ipa: z.string(),
        reason: z.string(),
      })
    )
    .optional(),
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
  private readonly personalKeys: Map<string, string> = new Map();

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

  public setPersonalKey(provider: 'gemini' | 'groq' | 'openrouter', key: string | null): void {
    if (!key || key.trim().length === 0) {
      this.personalKeys.delete(provider);
    } else {
      this.personalKeys.set(provider, key.trim());
    }
  }

  public getPersonalKey(provider: 'gemini' | 'groq' | 'openrouter'): string | null {
    if (this.personalKeys.has(provider)) {
      return this.personalKeys.get(provider)!;
    }
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = window.localStorage.getItem(`tamspeak_byok_${provider}`);
      if (stored && stored.trim().length > 0) {
        this.personalKeys.set(provider, stored.trim());
        return stored.trim();
      }
    }
    return null;
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
   * Retrieves the active key for a provider:
   * Priority 1: User's Personal Key (BYOK)
   * Priority 2: System Shared Key Pool
   */
  private getActiveKey(providerCategory: 'gemini' | 'groq' | 'openrouter'): string {
    const personalKey = this.getPersonalKey(providerCategory);
    if (personalKey && personalKey.length > 0) {
      return personalKey;
    }

    const pool = this.keyPools.get(providerCategory);
    if (!pool || pool.keys.length === 0) {
      throw new Error(
        `No API key configured for provider "${providerCategory}". Please add your personal key in Settings.`
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
   * Hybrid Live Speech-to-Text Audio Verification
   * Uses Groq Whisper-large-v3-turbo or Gemini 2.5 Flash Multimodal Audio
   */
  public async transcribeAudio(audioBlob: Blob, promptContext?: string): Promise<string> {
    // 1. Try Groq Whisper (turbo)
    const groqKey = this.getPersonalKey('groq') || this.keyPools.get('groq')?.keys[0];
    if (groqKey) {
      try {
        const formData = new FormData();
        const extension = audioBlob.type.includes('mp4') ? 'mp4' : audioBlob.type.includes('ogg') ? 'ogg' : 'webm';
        formData.append('file', audioBlob, `recording.${extension}`);
        formData.append('model', 'whisper-large-v3-turbo');
        formData.append('language', 'en');
        if (promptContext) {
          formData.append('prompt', promptContext.slice(0, 200));
        }

        const resp = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${groqKey}`,
          },
          body: formData,
        });

        if (resp.ok) {
          const data = await resp.json();
          if (data?.text && data.text.trim().length > 0) {
            return data.text.trim();
          }
        }
      } catch (err) {
        console.warn('Groq Whisper audio transcription failed, attempting Gemini:', err);
      }
    }

    // 2. Try Gemini 2.5 Flash Multimodal Audio
    const geminiKey = this.getPersonalKey('gemini') || this.keyPools.get('gemini')?.keys[0];
    if (geminiKey) {
      try {
        const base64Audio = await this.blobToBase64(audioBlob);
        const mimeType = audioBlob.type || 'audio/webm';
        const resp = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    {
                      text: `Accurately transcribe the spoken English words in this audio recording verbatim. Output ONLY the clean English transcript text without explanation or quotation marks. Context: ${promptContext || 'English conversation practice'}`,
                    },
                    {
                      inlineData: {
                        mimeType: mimeType.split(';')[0] || 'audio/webm',
                        data: base64Audio,
                      },
                    },
                  ],
                },
              ],
              generationConfig: {
                temperature: 0.1,
                maxOutputTokens: 250,
              },
            }),
          }
        );

        if (resp.ok) {
          const data = await resp.json();
          const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (candidateText && candidateText.trim().length > 0) {
            return candidateText.trim().replace(/^["']|["']$/g, '');
          }
        }
      } catch (err) {
        console.warn('Gemini multimodal audio transcription failed:', err);
      }
    }

    return '';
  }

  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1] || '';
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
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
      `You are an expert, strict IELTS Speaking Examiner and Acoustic Pronunciation Evaluator.`,
      `Context: ${params.contextTitle}. Candidate Target CEFR: ${params.targetLevel.toUpperCase()}.`,
      `Analyze the candidate's responses in the transcript dialogue and provide rigorous IELTS band scoring (0.0 to 9.0 in increments of 0.5) for the 4 criteria:`,
      `1. pronunciationScore`,
      `2. fluencyScore`,
      `3. lexicalScore`,
      `4. grammarScore`,
      `CRITICAL EVALUATION RULES:`,
      `- TASK RELEVANCE / OFF-TOPIC CHECK: If the candidate does not answer the examiner's specific question, speaks about an unrelated topic, or gives a nonsensical response, assign Band 2.0 to 4.0 for Fluency & Coherence and Lexical Resource. State explicitly in summary and weaknesses: 'The response is off-topic or fails to address the question.'`,
      `- INSUFFICIENT LENGTH: If the candidate speaks fewer than 20 words across the session, assign Band 1.5 to 3.0. Do not reward brief 1-2 sentence fragments with high scores.`,
      `- REALISTIC BAND DISTRIBUTION: Native C2 is 8.5-9.0. Professional C1 is 7.0-8.0. Intermediate B2 is 5.5-6.5. Basic B1 is 4.0-5.0. Elementary A2 is 2.5-3.5. Strictly avoid score inflation.`,
      `Provide a comprehensive JSON object matching the requested schema with precise weaknesses, strengths, grammar corrections, and native vocabulary enhancements.`,
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
    try {
      const { response, providerUsed } = await this.executeWithFallback(
        providerChain,
        hardenedSystemPrompt,
        messages,
        true
      );

      const rawParsed: any = PromptSecurityGuard.cleanAndParseJSON(response) || {};
      const validation = evaluationOutputSchema.safeParse(rawParsed);
      const parsed: any = validation.success ? validation.data : rawParsed;

      const rawP = Number(parsed.pronunciationScore ?? parsed.pronunciation ?? parsed.scores?.pronunciation ?? 6.0);
      const rawF = Number(parsed.fluencyScore ?? parsed.fluency ?? parsed.scores?.fluency ?? 6.0);
      const rawL = Number(parsed.lexicalScore ?? parsed.lexical ?? parsed.scores?.lexical ?? 6.0);
      const rawG = Number(parsed.grammarScore ?? parsed.grammar ?? parsed.scores?.grammar ?? 6.0);

      const validP = Math.min(9.0, Math.max(1.0, isNaN(rawP) ? 6.0 : rawP));
      const validF = Math.min(9.0, Math.max(1.0, isNaN(rawF) ? 6.0 : rawF));
      const validL = Math.min(9.0, Math.max(1.0, isNaN(rawL) ? 6.0 : rawL));
      const validG = Math.min(9.0, Math.max(1.0, isNaN(rawG) ? 6.0 : rawG));

      return {
        pronunciationScore: BandScore.fromRawAverage(validP),
        fluencyScore: BandScore.fromRawAverage(validF),
        lexicalScore: BandScore.fromRawAverage(validL),
        grammarScore: BandScore.fromRawAverage(validG),
        detailedFeedback: {
          summary: parsed.detailedFeedback?.summary ?? parsed.summary ?? 'Evaluated according to standard IELTS 4 criteria.',
          strengths: Array.isArray(parsed.detailedFeedback?.strengths)
            ? parsed.detailedFeedback.strengths
            : Array.isArray(parsed.strengths)
            ? parsed.strengths
            : ['Spoke with clear articulation', 'Addressed the core question'],
          weaknesses: Array.isArray(parsed.detailedFeedback?.weaknesses)
            ? parsed.detailedFeedback.weaknesses
            : Array.isArray(parsed.weaknesses)
            ? parsed.weaknesses
            : ['Expand sentence variety using idiomatic collocations', 'Practice complex grammatical clauses'],
          suggestedPhrases: Array.isArray(parsed.detailedFeedback?.suggestedPhrases) ? parsed.detailedFeedback.suggestedPhrases : [],
          grammarCorrections: Array.isArray(parsed.detailedFeedback?.grammarCorrections) ? parsed.detailedFeedback.grammarCorrections : [],
          vocabularyEnhancements: Array.isArray(parsed.detailedFeedback?.vocabularyEnhancements) ? parsed.detailedFeedback.vocabularyEnhancements : [],
        },
        providerUsed,
      };
    } catch {
      const userWords = params.dialogue
        .filter((d) => d.speaker === 'user')
        .reduce((sum, d) => sum + d.text.trim().split(/\s+/).filter(Boolean).length, 0);

      const calculatedBand = userWords < 15 ? 2.5 : userWords < 35 ? 4.0 : userWords < 70 ? 5.5 : 6.0;

      return {
        pronunciationScore: BandScore.create(calculatedBand),
        fluencyScore: BandScore.create(calculatedBand),
        lexicalScore: BandScore.create(calculatedBand),
        grammarScore: BandScore.create(calculatedBand),
        detailedFeedback: {
          summary:
            userWords < 20
              ? 'Candidate provided very brief answers with insufficient spoken data to demonstrate full range.'
              : 'Candidate answered communicative prompts with basic coherence, but requires further idiomatic range and complex grammar.',
          strengths: userWords < 20 ? ['Understood prompt direction'] : ['Spoke audibly', 'Direct response'],
          weaknesses:
            userWords < 20
              ? ['Answer was too brief to assess higher-level vocabulary', 'Expand on key supporting details']
              : ['Expand sentence variety using idiomatic collocations', 'Reduce hesitation markers'],
          suggestedPhrases: [
            { original: 'I think that', improved: 'From my personal vantage point', reason: 'Adds nuance and sophistication to expressing opinions' },
          ],
          grammarCorrections: [],
          vocabularyEnhancements: [
            { basicWord: 'good', advancedAlternative: 'advantageous', collocations: ['highly advantageous', 'mutually advantageous'] },
            { basicWord: 'big', advancedAlternative: 'substantial', collocations: ['substantial impact', 'substantial amount'] },
          ],
        },
        providerUsed: 'offline:conversational-evaluator',
      };
    }
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
    try {
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
    } catch {
      return this.generateSimulatedRoleplayReply(params.userLatestMessage);
    }
  }

  private generateSimulatedRoleplayReply(userText: string): RoleplayReplyResult {
    const lower = userText.toLowerCase();
    let reply = 'That is a thoughtful response. Moving along, could you expand on that with a specific personal example?';

    if (lower.includes('hometown') || lower.includes('city') || lower.includes('live') || lower.includes('born')) {
      reply = 'That gives a vivid picture of your area! How has your neighborhood transformed over the years, and do you think those changes are for the better?';
    } else if (lower.includes('work') || lower.includes('job') || lower.includes('study') || lower.includes('major') || lower.includes('career')) {
      reply = 'That sounds like a demanding yet rewarding path. What motivated you to pursue this direction in your life?';
    } else if (lower.includes('travel') || lower.includes('trip') || lower.includes('holiday') || lower.includes('visit')) {
      reply = 'Memorable journeys always shape our worldview. What was the most eye-opening cultural difference you experienced during that trip?';
    } else if (lower.includes('technology') || lower.includes('ai') || lower.includes('phone') || lower.includes('app')) {
      reply = 'Technology certainly plays an indispensable role today! In your opinion, will these advancements bring people closer or create more isolation?';
    } else if (lower.includes('hobby') || lower.includes('music') || lower.includes('sport') || lower.includes('read')) {
      reply = 'Engaging in hobbies is vital for mental balance. How often do you find time for this amidst your busy schedule?';
    } else if (userText.split(/\s+/).filter(Boolean).length <= 4) {
      reply = 'Could you tell me a little more about that? For instance, what are your reasons for that perspective?';
    }

    return {
      replyText: reply,
      suggestedCorrection: undefined,
      ipaCorrections: [],
      providerUsed: 'offline:conversational-evaluator',
    };
  }

  /**
   * Speaking AI: Free Casual Conversation with Contextual Phonetic Auto-Correction
   * Persona: Alex (Native Best Friend, Zero Topics, Casual English)
   * Token Optimization: Sliding Window (last 6 dialogue turns)
   */
  public async chatSpeakingAI(params: {
    conversationHistory: ReadonlyArray<{ speaker: 'user' | 'ai'; text: string }>;
    rawSttInput: string;
  }): Promise<SpeakingAIChatResult> {
    const rawSystemPrompt = [
      `You are "Alex", an authentic, energetic, and supportive native English speaker chatting casually with your close friend.`,
      `CORE PRINCIPLES:`,
      `1. ZERO TOPIC CONSTRAINT: There are no academic exams or set topics here. Talk about anything: daily life, feelings, weekend plans, movies, banter, food, work, or hobbies.`,
      `2. CASUAL NATIVE STYLE: Speak like a real modern friend. Use contractions (I'm, you're, that's, gonna, wanna), natural discourse markers, and everyday spoken idioms ("what's up", "totally", "no way", "gotcha", "hang out", "fair enough", "I feel you").`,
      `3. BREVITY & RHYTHM: Keep your reply between 1 and 3 sentences. Maintain an engaging, fast-paced back-and-forth conversational rhythm. Never lecture, scold, or interview.`,
      `4. CONTEXTUAL PHONETIC AUTO-CORRECTION:`,
      `   The user talks via microphone and speech recognition (STT), which frequently mishears phonetic homophones or non-native pronunciation (e.g. "be a true for respond" instead of "that is a thoughtful response", "eye one go" instead of "I want to go").`,
      `   - Analyze raw_stt_input against recent conversation context and sound-alike phonetic patterns.`,
      `   - If STT was misrecognized: set was_stt_misrecognized: true, infer inferred_intended_meaning, and note mispronounced_words with phonetic error reason.`,
      `   - If STT was natural and accurate: set was_stt_misrecognized: false, and inferred_intended_meaning: raw_stt_input.`,
      `   - In friend_reply: respond naturally and conversationally to inferred_intended_meaning as a real friend (never scold them for speech recognition errors).`,
      `   - In casual_native_tip: offer a brief 1-sentence tip on a natural way native speakers express this (or empty string if already good).`,
      `OUTPUT FORMAT: Return ONLY valid JSON:`,
      `{`,
      `  "raw_stt_input": "...",`,
      `  "inferred_intended_meaning": "...",`,
      `  "was_stt_misrecognized": true/false,`,
      `  "friend_reply": "...",`,
      `  "casual_native_tip": "...",`,
      `  "mispronounced_words": [ { "word": "...", "ipa": "/.../", "reason": "..." } ]`,
      `}`,
    ].join('\n');

    const hardenedSystemPrompt = PromptSecurityGuard.buildHardenedSystemPrompt(rawSystemPrompt);

    // Sliding Window Optimization: Take at most 6 previous turns
    const recentTurns = params.conversationHistory.slice(-6);
    const messages: ChatMessagePayload[] = recentTurns.map((turn) => ({
      role: turn.speaker === 'user' ? 'user' : 'assistant',
      content: turn.text,
    }));

    const isolatedInput = PromptSecurityGuard.isolateUserInput(params.rawSttInput);
    messages.push({
      role: 'user',
      content: isolatedInput,
    });

    const providerChain = ['gemini_flash', 'gemini_flash_lite', 'groq', 'openrouter'];
    try {
      const { response, providerUsed } = await this.executeWithFallback(
        providerChain,
        hardenedSystemPrompt,
        messages,
        true
      );

      const parsed = PromptSecurityGuard.parseAndValidateJSON(response, speakingAIChatOutputSchema);

      return {
        rawSttInput: params.rawSttInput,
        inferredIntendedMeaning: parsed.inferred_intended_meaning || params.rawSttInput,
        wasSttMisrecognized: Boolean(parsed.was_stt_misrecognized),
        friendReply: parsed.friend_reply,
        casualNativeTip: parsed.casual_native_tip || undefined,
        mispronouncedWords: parsed.mispronounced_words || [],
        providerUsed,
      };
    } catch {
      return this.generateSimulatedSpeakingAIReply(params.rawSttInput);
    }
  }

  private generateSimulatedSpeakingAIReply(rawSttInput: string): SpeakingAIChatResult {
    const lower = rawSttInput.toLowerCase();
    
    // Check for common phonetic confusions or tricky pronunciation
    let inferredMeaning = rawSttInput;
    let wasMisrecognized = false;
    const mispronounced: Array<{ word: string; ipa: string; reason: string }> = [];

    if (lower.includes('true for respond') || lower.includes('true for') || lower.includes('truthful respond')) {
      inferredMeaning = rawSttInput.replace(/be a true for respond|true for respond|truthful respond/gi, 'thoughtful response');
      wasMisrecognized = true;
      mispronounced.push({
        word: 'thoughtful',
        ipa: '/ˈθɔːtfəl/',
        reason: 'Voiceless dental fricative /θ/ and consonant blend sounded like "true for"',
      });
    }

    let friendReply = "Haha totally! That is so true. What else have you been up to today?";
    let nativeTip = "";

    if (lower.includes('hello') || lower.includes('hey') || lower.includes('hi') || lower.includes("what's up") || lower.includes('how are you')) {
      friendReply = "Hey! Doing great here, just chilling. How is your day treating you so far?";
      nativeTip = "To sound extra casual, you can say 'Hey, what's good?' or 'Not much, just taking it easy!'";
    } else if (lower.includes('tired') || lower.includes('exhausted') || lower.includes('sleepy') || lower.includes('busy')) {
      friendReply = "Oh man, I totally feel you. Get some good rest tonight, do not push yourself too hard!";
      nativeTip = "'I am beat' or 'I am wiped out' are great native ways to express being tired.";
    } else if (lower.includes('movie') || lower.includes('film') || lower.includes('show') || lower.includes('netflix')) {
      friendReply = "No way, I love that genre! Any recommendations on what I should watch next?";
      nativeTip = "You can ask 'Have you caught any good shows lately?' for natural small talk.";
    } else if (lower.includes('weekend') || lower.includes('tomorrow') || lower.includes('sunday') || lower.includes('saturday')) {
      friendReply = "Sounds like fun! Hope you get to recharge and do something you really enjoy.";
      nativeTip = "Try saying 'I am looking forward to unwinding' instead of 'I want to relax'.";
    } else if (lower.includes('work') || lower.includes('boss') || lower.includes('office') || lower.includes('project')) {
      friendReply = "Work can be a grind sometimes, but you are handling it like a champ! Hang in there.";
    } else if (lower.includes('food') || lower.includes('eat') || lower.includes('lunch') || lower.includes('dinner') || lower.includes('coffee')) {
      friendReply = "Now you are making me hungry! What kind of food are you in the mood for?";
      nativeTip = "'I am craving some...' is the go-to native phrase for wanting specific food.";
    }

    return {
      rawSttInput,
      inferredIntendedMeaning: inferredMeaning,
      wasSttMisrecognized: wasMisrecognized,
      friendReply,
      casualNativeTip: nativeTip || undefined,
      mispronouncedWords: mispronounced,
      providerUsed: 'offline:casual-friend-engine',
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
    try {
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
    } catch {
      return {
        originalSentence: params.sentence,
        upgradedSentence: `From a broader perspective, ${params.sentence.replace(/^(i think|i feel|maybe)\s*/i, '')}`,
        explanation: 'Upgraded using an academic discourse marker to elevate sentence structure.',
        nativeIdiomsUsed: ['From a broader perspective'],
        estimatedBand: BandScore.create(7.5),
      };
    }
  }
}
