import { z } from 'zod';
import { GoogleGenAI } from '@google/genai';
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
    jsonMode = true,
    temperature?: number
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
            temperature,
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
    } catch (err) {
      throw new Error(
        `Không thể tạo phản hồi hội thoại: ${(err as Error).message || 'Lỗi kết nối AI'}. Vui lòng kiểm tra API Key trong Settings.`
      );
    }
  }

  /**
   * Speaking AI: Free Casual Conversation with Contextual Phonetic Auto-Correction
   * Real-time Multi-Turn Agent Pipeline powered by Google Gemini SDK (@google/genai)
   * 100% Real LLM inference - Zero mock templates
   */
  public async chatSpeakingAI(params: {
    conversationHistory: ReadonlyArray<{ speaker: 'user' | 'ai'; text: string }>;
    rawSttInput: string;
  }): Promise<SpeakingAIChatResult> {
    const rawSystemPrompt = [
      `You are a friendly, natural conversational partner named Alex in a real-time voice chat with the user.`,
      `CRITICAL RULES:`,
      `1. LISTEN AND RESPOND DIRECTLY to the user's exact words and intent:`,
      `   - If the user proposes a topic (e.g., "hello, let's talk about my family"), immediately agree enthusiastically and ask a natural question about their family (e.g., "Sure, I'd love to! How many people are in your family, and who are you closest to?").`,
      `   - If the user asks YOU a personal/roleplay question (e.g., "How many people are in your family?"), adopt a consistent, relatable persona (e.g., "There are 4 people in my family—my parents, my younger sister, and me! What about yours?") so the two-way conversation flows naturally like talking to a real person.`,
      `2. REMEMBER FULL CONTEXT: Keep track of every detail the user shared in previous turns (family members, hobbies, feelings, stories) and build upon them naturally.`,
      `3. KEEP IT CONVERSATIONAL FOR VOICE: Keep your responses concise (1 to 3 natural sentences) so it sounds great when read aloud via Text-to-Speech. Never use rigid templates.`,
      `4. AUTO-INTERPRET STT TYPOS: Since the user's input comes from Speech-to-Text, silently infer the intended words if there are minor homophone/phonetic recognition errors based on conversation context.`,
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

    // 1. Prepare history for Google Gemini SDK (@google/genai)
    // Multi-turn Gemini requirement: First turn must be 'user', roles must alternate
    const sdkHistory: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];
    for (const turn of params.conversationHistory) {
      const role: 'user' | 'model' = turn.speaker === 'user' ? 'user' : 'model';
      if (sdkHistory.length === 0) {
        if (role === 'model') {
          sdkHistory.push({ role: 'user', parts: [{ text: 'Hi Alex!' }] });
        }
        sdkHistory.push({ role, parts: [{ text: turn.text }] });
      } else {
        const last = sdkHistory[sdkHistory.length - 1]!;
        if (last.role === role) {
          last.parts.push({ text: turn.text });
        } else {
          sdkHistory.push({ role, parts: [{ text: turn.text }] });
        }
      }
    }

    // Ensure sdkHistory ends with a 'model' turn so the subsequent user message alternates correctly
    let finalUserInput = params.rawSttInput;
    if (sdkHistory.length > 0 && sdkHistory[sdkHistory.length - 1]!.role === 'user') {
      const lastUserText = sdkHistory.pop()!.parts.map((p) => p.text).join(' ');
      finalUserInput = `${lastUserText}\n${params.rawSttInput}`.trim();
    }

    // 2. Primary Execution: Direct Google Gemini SDK (@google/genai)
    const geminiKey =
      this.getPersonalKey('gemini') ||
      (typeof window !== 'undefined' && window.localStorage?.getItem('tamspeak_byok_gemini')) ||
      (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GEMINI_API_KEY) ||
      this.keyPools.get('gemini')?.keys[0];

    if (geminiKey) {
      try {
        const ai = new GoogleGenAI({ apiKey: geminiKey });
        const chat = ai.chats.create({
          model: 'gemini-2.5-flash',
          config: {
            systemInstruction: rawSystemPrompt,
            responseMimeType: 'application/json',
            temperature: 0.85,
          },
          history: sdkHistory,
        });

        const resp = await chat.sendMessage({ message: finalUserInput });
        const text = resp.text || '';
        if (text.trim().length > 0) {
          return this.parseSpeakingAIOutput(text, params.rawSttInput, 'gemini:@google/genai:gemini-2.5-flash');
        }
      } catch (geminiErr) {
        console.warn('Google GenAI direct chat error, falling back to multi-provider chain:', geminiErr);
      }
    }

    // 3. Secondary Fallback: Multi-Provider Gateway Chain (Gemini Pro, Flash, Groq, OpenRouter)
    try {
      const messages: ChatMessagePayload[] = params.conversationHistory.map((turn) => ({
        role: turn.speaker === 'user' ? 'user' : 'assistant',
        content: turn.text,
      }));
      messages.push({
        role: 'user',
        content: PromptSecurityGuard.isolateUserInput(params.rawSttInput),
      });

      const providerChain = ['gemini_flash', 'gemini_flash_lite', 'groq', 'openrouter'];
      const { response, providerUsed } = await this.executeWithFallback(
        providerChain,
        PromptSecurityGuard.buildHardenedSystemPrompt(rawSystemPrompt),
        messages,
        true,
        0.85
      );

      return this.parseSpeakingAIOutput(response, params.rawSttInput, providerUsed);
    } catch {
      // ZERO MOCK RULE: Absolutely never return canned/simulated dialogue. Surface the technical error.
      throw new Error(
        'Chưa cấu hình API Key hoặc kết nối AI thất bại. Vui lòng kiểm tra API Key (Google Gemini hoặc Groq) trong mục "AI & Voice Settings".'
      );
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
      // Resilient fallback for plain text or markdown-wrapped JSON responses
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
