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
import { useTamSpeakStore } from '../../presentation/store';
import { DEFAULT_GEMINI_FALLBACK_KEY, getActiveGeminiApiKey } from './AIService';

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
  provider: 'gemini';
  keys: string[];
  currentIndex: number;
}

export const DEFAULT_GEMINI_PROVIDER_CHAIN = [
  'gemini_3_8_flash',
  'gemini_3_5_flash_lite',
  'gemini_3_6_flash',
  'gemini_3_5_flash',
  'gemini_3_1_flash_lite',
] as const;

/**
 * ResilientAIGateway
 * Production Google Gemini 3 Native REST Gateway:
 * - Direct REST fetch with X-goog-api-key header
 * - Automatic Fallback Chain: gemini-3.8-flash -> gemini-3.5-flash-lite -> gemini-3.6-flash -> gemini-3.5-flash -> gemini-3.1-flash-lite
 * - Automatic failover on 429/503/404 with instant badge update in Header
 * - Unified Key Resolution (BYOK from LocalStorage -> Env -> Secure Fallback)
 */
export class ResilientAIGateway implements IAIGateway {
  private readonly strategies: Map<string, IAIProviderStrategy> = new Map();
  private readonly circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private readonly keyPools: Map<string, KeyPoolEntry> = new Map();
  private readonly personalKeys: Map<string, string> = new Map();

  constructor(
    customKeyConfig?: {
      geminiKeys?: string[];
    }
  ) {
    // Register active official Gemini 3 Models in priority order (ultra-intelligent & fast flash first)
    this.registerStrategy(new GeminiProviderStrategy('gemini_3_8_flash', 'gemini-3.8-flash'));
    this.registerStrategy(new GeminiProviderStrategy('gemini_3_5_flash_lite', 'gemini-3.5-flash-lite'));
    this.registerStrategy(new GeminiProviderStrategy('gemini_3_6_flash', 'gemini-3.6-flash'));
    this.registerStrategy(new GeminiProviderStrategy('gemini_3_5_flash', 'gemini-3.5-flash'));
    this.registerStrategy(new GeminiProviderStrategy('gemini_3_1_flash_lite', 'gemini-3.1-flash-lite'));

    // Initialize Key Pool with unified active key
    const initialKey = getActiveGeminiApiKey();
    const initialKeys =
      customKeyConfig?.geminiKeys && customKeyConfig.geminiKeys.length > 0
        ? customKeyConfig.geminiKeys
        : [initialKey];

    this.setKeyPool('gemini', initialKeys);

    if (initialKey && initialKey !== DEFAULT_GEMINI_FALLBACK_KEY) {
      this.personalKeys.set('gemini', initialKey);
    }
  }

  public setPersonalKey(provider: 'gemini', key: string | null): void {
    if (!key || key.trim().length === 0) {
      this.personalKeys.delete(provider);
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(`tamspeak_byok_${provider}`);
      }
    } else {
      const trimmed = key.trim();
      this.personalKeys.set(provider, trimmed);
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(`tamspeak_byok_${provider}`, trimmed);
      }
    }
  }

  public getPersonalKey(provider: 'gemini'): string | null {
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

  public setKeyPool(provider: 'gemini', keys: string[]): void {
    const validKeys = keys.map((k) => k.trim()).filter((k) => k.length > 0);
    this.keyPools.set(provider, {
      provider,
      keys: validKeys.length > 0 ? validKeys : [DEFAULT_GEMINI_FALLBACK_KEY],
      currentIndex: 0,
    });
  }

  /**
   * Retrieves active Gemini API key:
   * 1. Personal Key (BYOK) from in-memory / localStorage
   * 2. Key pool
   * 3. Global active API key resolver
   */
  private getActiveKey(providerCategory: 'gemini' = 'gemini'): string {
    const personalKey = this.getPersonalKey(providerCategory);
    if (personalKey && personalKey.length > 0) {
      return personalKey;
    }

    const pool = this.keyPools.get(providerCategory);
    if (pool && pool.keys.length > 0) {
      const poolKey = pool.keys[pool.currentIndex % pool.keys.length];
      if (poolKey && poolKey.length > 0) return poolKey;
    }

    return getActiveGeminiApiKey();
  }

  private rotateKey(providerCategory: 'gemini' = 'gemini'): void {
    const pool = this.keyPools.get(providerCategory);
    if (pool && pool.keys.length > 1) {
      pool.currentIndex = (pool.currentIndex + 1) % pool.keys.length;
    }
  }

  /**
   * Gemini Multimodal Audio Transcription
   */
  public async transcribeAudio(audioBlob: Blob, promptContext?: string): Promise<string> {
    const geminiKey = this.getActiveKey('gemini');
    try {
      const base64Audio = await this.blobToBase64(audioBlob);
      const mimeType = audioBlob.type || 'audio/webm';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent`;

      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-goog-api-key': geminiKey,
        },
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
      });

      if (resp.ok) {
        const data = await resp.json();
        const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (candidateText && candidateText.trim().length > 0) {
          return candidateText.trim().replace(/^["']|["']$/g, '');
        }
      }
    } catch (err) {
      console.warn('Gemini audio transcription notice:', err);
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
   * Core Fallback Chain: cycles through Gemini models on 429, 503, 404
   */
  private async executeWithFallback(
    providerChain: readonly string[] | string[],
    systemPrompt: string,
    messages: ChatMessagePayload[],
    jsonMode = true,
    temperature?: number,
    options?: {
      maxOutputTokens?: number;
      timeoutMs?: number;
    }
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

      const pool = this.keyPools.get('gemini');
      const attemptsCount = Math.max(1, pool?.keys.length ?? 1);

      for (let attempt = 0; attempt < attemptsCount; attempt++) {
        try {
          const apiKey = this.getActiveKey('gemini');
          const response = await strategy.generateChatCompletion({
            systemPrompt,
            messages,
            apiKey,
            jsonMode,
            temperature,
            maxOutputTokens: options?.maxOutputTokens,
            timeoutMs: options?.timeoutMs,
          });

          breaker.recordSuccess();
          // Update active model badge in header
          useTamSpeakStore.getState().setActiveAIProvider(strategy.modelName);
          return { response, providerUsed: `${providerId}:${strategy.modelName}` };
        } catch (err) {
          // Case 3: Stop fallback immediately on HTTP 400/401/403 (Invalid key or bad request)
          if ((err as any)?.isFatalAuthOrClientError) {
            throw err;
          }

          const errorMsg = (err as Error).message;
          errors.push(`[${providerId} key#${attempt}]: ${errorMsg}`);

          // If rate limited or service overloaded, rotate key and retry
          if (errorMsg.includes('429') || errorMsg.includes('503') || errorMsg.includes('quota')) {
            this.rotateKey('gemini');
          }
        }
      }

      breaker.recordFailure();
    }

    throw new Error(`Tất cả các model Gemini đều gặp lỗi: ${errors.join(' | ')}`);
  }

  // --- Implementation of IAIGateway Methods ---

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
      ``,
      `Output format must strictly be valid JSON conforming to this schema:`,
      `{`,
      `  "pronunciationScore": number (0-9),`,
      `  "fluencyScore": number (0-9),`,
      `  "lexicalScore": number (0-9),`,
      `  "grammarScore": number (0-9),`,
      `  "detailedFeedback": {`,
      `    "summary": "Comprehensive 2-3 sentence performance summary",`,
      `    "strengths": ["string", "string"],`,
      `    "weaknesses": ["string", "string"],`,
      `    "suggestedPhrases": [`,
      `      { "original": "...", "improved": "...", "reason": "..." }`,
      `    ],`,
      `    "grammarCorrections": [`,
      `      { "original": "...", "corrected": "...", "explanation": "..." }`,
      `    ],`,
      `    "vocabularyEnhancements": [`,
      `      { "basicWord": "...", "advancedAlternative": "...", "collocations": ["..."] }`,
      `    ]`,
      `  }`,
      `}`,
      `Do not output markdown codeblocks. Return pure JSON only.`,
    ].join('\n');

    const hardenedSystemPrompt = PromptSecurityGuard.buildHardenedSystemPrompt(rawSystemPrompt);

    const userTurns = params.dialogue.filter((turn) => turn.speaker === 'user');
    const dialogueSummary = userTurns
      .map((turn, i) => `[Utterance ${i + 1} at ${turn.timestampSeconds}s]: "${turn.text}"`)
      .join('\n');

    const messages: ChatMessagePayload[] = [
      {
        role: 'user',
        content: PromptSecurityGuard.isolateUserInput(
          `Please evaluate this full candidate performance:\n${dialogueSummary}`
        ),
      },
    ];

    const { response, providerUsed } = await this.executeWithFallback(
      DEFAULT_GEMINI_PROVIDER_CHAIN,
      hardenedSystemPrompt,
      messages,
      true,
      0.3,
      {
        maxOutputTokens: 1800,
        timeoutMs: 20_000,
      }
    );

    const parsed = PromptSecurityGuard.parseAndValidateJSON(response, evaluationOutputSchema);

    return {
      pronunciationScore: BandScore.create(parsed.pronunciationScore),
      fluencyScore: BandScore.create(parsed.fluencyScore),
      lexicalScore: BandScore.create(parsed.lexicalScore),
      grammarScore: BandScore.create(parsed.grammarScore),
      detailedFeedback: parsed.detailedFeedback,
      providerUsed,
    };
  }

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

    const recentTurns = params.conversationHistory.slice(-4);
    const messages: ChatMessagePayload[] = recentTurns.map((turn) => ({
      role: turn.speaker === 'user' ? 'user' : 'assistant',
      content: turn.text,
    }));

    const isolatedUserMessage = PromptSecurityGuard.isolateUserInput(params.userLatestMessage);
    messages.push({
      role: 'user',
      content: isolatedUserMessage,
    });

    try {
      const { response, providerUsed } = await this.executeWithFallback(
        DEFAULT_GEMINI_PROVIDER_CHAIN,
        hardenedSystemPrompt,
        messages,
        true,
        undefined,
        {
          maxOutputTokens: 350,
          timeoutMs: 8_000,
        }
      );

      const parsed = PromptSecurityGuard.parseAndValidateJSON(response, roleplayReplyOutputSchema);

      return {
        replyText: parsed.replyText,
        suggestedCorrection: parsed.suggestedCorrection,
        ipaCorrections: parsed.ipaCorrections,
        providerUsed,
      };
    } catch (err) {
      throw new Error(
        `Không thể tạo phản hồi hội thoại: ${(err as Error).message || 'Lỗi kết nối AI'}.`
      );
    }
  }

  public async chatSpeakingAI(params: {
    conversationHistory: ReadonlyArray<{ speaker: 'user' | 'ai'; text: string }>;
    rawSttInput: string;
  }): Promise<SpeakingAIChatResult> {
    const rawSystemPrompt = [
      `You are a friendly, natural conversational partner named Alex in a real-time voice chat with the user.`,
      `CRITICAL RULES:`,
      `1. LISTEN AND RESPOND DIRECTLY to the user's exact words and intent:`,
      `   - If the user proposes a topic (e.g., "hello, let's talk about my family"), immediately agree enthusiastically and ask a natural question about their family (e.g., "Sure, I'd love to! How many people are in your family, and who are you closest to?").`,
      `   - If the user asks YOU a personal/roleplay question (e.g., "How many people are in your family?"), adopt a consistent, relatable persona so the two-way conversation flows naturally like talking to a real person.`,
      `2. REMEMBER FULL CONTEXT: Keep track of every detail the user shared in previous turns (family members, hobbies, feelings, stories) and build upon them naturally.`,
      `3. KEEP IT CONVERSATIONAL FOR VOICE: Keep your responses concise (1 to 3 natural sentences) so it sounds great when read aloud via Text-to-Speech. Never use rigid templates.`,
      `4. AUTO-INTERPRET STT TYPOS & VIETNAMESE ENTITIES: Since the user's input comes from Speech-to-Text, silently infer intended words if there are homophone errors. If user mentions Vietnamese places or foods ('banh mi', 'Dong Nai', 'pho', 'Da Nang', 'ao dai', 'Ho Chi Minh'), understand and respond naturally without confusing them for English errors.`,
      ``,
      `OUTPUT FORMAT: Return ONLY valid JSON:`,
      `{`,
      `  "friend_reply": "1 to 3 natural conversational sentences responding directly to what the user said",`,
      `  "inferred_intended_meaning": "The intended text if STT misheard words, otherwise the user's exact words",`,
      `  "was_stt_misrecognized": false,`,
      `  "casual_native_tip": "Optional 1-sentence tip on natural native phrasing, or empty string",`,
      `  "mispronounced_words": []`,
      `}`,
    ].join('\n');

    // Sliding Context Window: Keep last 6 dialogue turns to optimize latency (< 2s) & prevent TPM 429 rate limit
    const recentHistory = params.conversationHistory.slice(-6);
    const messages: ChatMessagePayload[] = recentHistory.map((turn) => ({
      role: turn.speaker === 'user' ? 'user' : 'assistant',
      content: turn.text,
    }));
    messages.push({
      role: 'user',
      content: PromptSecurityGuard.isolateUserInput(params.rawSttInput),
    });

    try {
      const { response, providerUsed } = await this.executeWithFallback(
        DEFAULT_GEMINI_PROVIDER_CHAIN,
        PromptSecurityGuard.buildHardenedSystemPrompt(rawSystemPrompt),
        messages,
        true,
        0.85,
        {
          maxOutputTokens: 350,
          timeoutMs: 8_000,
        }
      );

      return this.parseSpeakingAIOutput(response, params.rawSttInput, providerUsed);
    } catch (fallbackErr) {
      const errorDetail = (fallbackErr as Error).message || '';
      throw new Error(`Lỗi kết nối Gemini: ${errorDetail}`);
    }
  }

  private parseSpeakingAIOutput(
    rawResponse: string,
    rawSttInput: string,
    providerUsed: string
  ): SpeakingAIChatResult {
    try {
      const parsed = PromptSecurityGuard.parseAndValidateJSON(rawResponse, speakingAIChatOutputSchema);
      return {
        rawSttInput,
        inferredIntendedMeaning: parsed.inferred_intended_meaning || rawSttInput,
        wasSttMisrecognized: Boolean(parsed.was_stt_misrecognized),
        friendReply: parsed.friend_reply,
        casualNativeTip: parsed.casual_native_tip || undefined,
        mispronouncedWords: parsed.mispronounced_words || [],
        providerUsed,
      };
    } catch {
      const cleanedText = rawResponse
        .replace(/```json/gi, '')
        .replace(/```/g, '')
        .trim();

      const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const innerParsed = JSON.parse(jsonMatch[0]);
          if (innerParsed && typeof innerParsed.friend_reply === 'string') {
            return {
              rawSttInput,
              inferredIntendedMeaning: innerParsed.inferred_intended_meaning || rawSttInput,
              wasSttMisrecognized: Boolean(innerParsed.was_stt_misrecognized),
              friendReply: innerParsed.friend_reply,
              casualNativeTip: innerParsed.casual_native_tip || undefined,
              mispronouncedWords: innerParsed.mispronounced_words || [],
              providerUsed,
            };
          }
        } catch {
          // ignore
        }
      }

      return {
        rawSttInput,
        inferredIntendedMeaning: rawSttInput,
        wasSttMisrecognized: false,
        friendReply: cleanedText || 'I hear you! What would you like to explore next?',
        casualNativeTip: undefined,
        mispronouncedWords: [],
        providerUsed,
      };
    }
  }

  public async upgradeExpression(params: {
    sentence: string;
    currentBand: BandScore;
    targetBand: BandScore;
  }): Promise<UpgradedExpressionResult> {
    const rawPrompt = [
      `You are an IELTS Band 9 Speaking coach and native English editor.`,
      `Transform the user's basic English sentence to Band ${params.targetBand.toString()} level.`,
      `Original Sentence: "${params.sentence}".`,
      `Output JSON format:`,
      `{`,
      `  "originalSentence": "${params.sentence}",`,
      `  "upgradedSentence": "Band 8.5+ upgraded expression",`,
      `  "explanation": "concise explanation of grammar, collocations, or vocabulary enhanced",`,
      `  "nativeIdiomsUsed": ["idiom1"],`,
      `  "estimatedBand": ${params.targetBand.getValue()}`,
      `}`,
      `Do not output markdown codeblocks. Return pure JSON only.`,
    ].join('\n');

    const hardenedSystemPrompt = PromptSecurityGuard.buildHardenedSystemPrompt(rawPrompt);
    const messages: ChatMessagePayload[] = [
      {
        role: 'user',
        content: PromptSecurityGuard.isolateUserInput(`Upgrade sentence: "${params.sentence}"`),
      },
    ];

    const { response } = await this.executeWithFallback(
      DEFAULT_GEMINI_PROVIDER_CHAIN,
      hardenedSystemPrompt,
      messages,
      true,
      0.5,
      {
        maxOutputTokens: 800,
        timeoutMs: 15_000,
      }
    );

    const parsed = PromptSecurityGuard.parseAndValidateJSON(response, upgradeExpressionOutputSchema);

    return {
      originalSentence: parsed.originalSentence,
      upgradedSentence: parsed.upgradedSentence,
      explanation: parsed.explanation,
      nativeIdiomsUsed: parsed.nativeIdiomsUsed,
      estimatedBand: BandScore.create(parsed.estimatedBand),
    };
  }
}
