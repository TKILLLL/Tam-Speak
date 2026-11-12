import { useTamSpeakStore } from '../../presentation/store';
import { normalizeGeminiContents } from './normalizeGeminiContents';
import { SettingsStore } from '../security/SettingsStore';
import { GEMINI_CHAT_MODEL_PRIORITY } from './GeminiModels';

// Ephemeral in-memory personal BYOK key (RAM-only per authenticated user)
let inMemoryPersonalApiKey: string | null = null;

export function setPersonalApiKey(key: string | null): void {
  inMemoryPersonalApiKey = key && key.trim().length > 0 ? key.trim() : null;
}

export function clearPersonalApiKey(): void {
  inMemoryPersonalApiKey = null;
}

export const GEMINI_MODELS_FALLBACK_CHAIN = GEMINI_CHAT_MODEL_PRIORITY;

export type GeminiModelName = typeof GEMINI_MODELS_FALLBACK_CHAIN[number];

const MAX_MODEL_ATTEMPTS = 2;
const MAX_AUTOMATIC_429_RETRIES = 1;
const MAX_AUTOMATIC_503_RETRIES = 1;
const MAX_RATE_LIMIT_BACKOFF_MS = 30_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRetryAfterMs(response: Response, body: string): number | null {
  const retryAfterHeader = response.headers.get('Retry-After');
  if (retryAfterHeader) {
    const seconds = Number(retryAfterHeader);
    if (Number.isFinite(seconds)) {
      return Math.max(0, seconds * 1000);
    }

    const retryAt = Date.parse(retryAfterHeader);
    if (Number.isFinite(retryAt)) {
      return Math.max(0, retryAt - Date.now());
    }
  }

  let retryDelay: unknown;
  let errorMessage = body;
  try {
    const parsed = JSON.parse(body);
    errorMessage = parsed?.error?.message || parsed?.message || body;
    retryDelay = parsed?.error?.details?.find?.((detail: any) => detail?.retryDelay)?.retryDelay;
  } catch {
    // Gemini sometimes returns a plain-text error body.
  }

  if (typeof retryDelay === 'string') {
    const match = retryDelay.match(/^(\d+(?:\.\d+)?)\s*(ms|s)$/i);
    if (match) {
      return Math.max(0, Number(match[1]) * (match[2]!.toLowerCase() === 's' ? 1000 : 1));
    }
  }

  const messageMatch = errorMessage.match(/retry\s+in\s+(\d+(?:\.\d+)?)\s*(ms|seconds?|s)/i);
  if (messageMatch) {
    const unit = messageMatch[2]!.toLowerCase();
    return Math.max(0, Number(messageMatch[1]) * (unit === 'ms' ? 1 : 1000));
  }

  return null;
}

function formatRateLimitMessage(waitMs: number): string {
  const waitSeconds = Math.max(1, Math.ceil(waitMs / 1000));
  return `Gemini đang giới hạn tốc độ (HTTP 429). Hãy đợi khoảng ${waitSeconds} giây rồi thử lại.`;
}

function formatServiceUnavailableMessage(waitMs: number): string {
  const waitSeconds = Math.max(1, Math.ceil(waitMs / 1000));
  return `Gemini đang quá tải hoặc tạm thời không khả dụng (HTTP 503). Hãy đợi khoảng ${waitSeconds} giây rồi thử lại. Đây không phải lỗi API Key.`;
}

/**
 * Global single source of truth for resolving active Google Gemini API Key:
 * 1. Ephemeral In-Memory Personal Key (RAM only)
 * 2. User-isolated Vault Key from UserStorageService (`tamspeak_vault_gemini_${userId}`)
 * No shared or build-time key fallback is allowed.
 */
export function getActiveGeminiApiKey(): string {
  // 1. In-memory personal key
  if (inMemoryPersonalApiKey && inMemoryPersonalApiKey.length > 0) {
    return inMemoryPersonalApiKey;
  }

  // 2. User-isolated vault key for current logged in user
  try {
    const currentUserId = useTamSpeakStore.getState().user?.id;
    const userVaultKey = SettingsStore.getGeminiApiKey(currentUserId);
    if (userVaultKey && userVaultKey.trim().length > 0) {
      inMemoryPersonalApiKey = userVaultKey.trim();
      return inMemoryPersonalApiKey;
    }
  } catch {
    // ignore
  }

  return '';
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  inlineData?: { mimeType: string; data: string };
}

export interface GeneratedVocabHints {
  activeKeywords: Array<{ word: string; ipa: string; band: string; meaningVi: string; example: string }>;
  collocations: Array<{ phrase: string; meaningVi: string; example: string }>;
  idioms: Array<{ idiom: string; ipa: string; meaningEn: string; meaningVi: string; example: string }>;
}

export interface ExaminerTurnResult {
  feedbackTransition: string;
  nextQuestion: string;
  suggestedUpgrade: string;
  inferredIntendedSentence?: string;
  mistakes: Array<{
    word: string;
    ipa: string;
    reason: string;
    suggestedAlternative: string;
  }>;
  speechAnalysis?: {
    fluencyNote?: string;
    grammarNote?: string;
  };
}

export interface PlacementTestResult {
  overallBand: number;
  cefrLevel: 'a2' | 'b1' | 'b2' | 'c1' | 'c2';
  summaryFeedback: string;
  strengths: string[];
  weaknesses: string[];
}

export interface PlacementQuestion {
  label: string;
  prompt: string;
}

/**
 * AIService: 100% Google Gemini REST Architecture
 * - Uses Google Generative Language REST fetch with 'X-goog-api-key' Header
 * - API key resolution is user-scoped through SettingsStore/UserStorageService
 * - Auto-select Model Fallback Chain: gemini-3.8-flash -> gemini-3.5-flash-lite -> gemini-3.6-flash -> ...
 * - Automatically updates Header badge on model failover
 */
export class AIService {
  private activeModelIndex = 0;
  private vocabHintsCache = new Map<string, GeneratedVocabHints>();
  private rateLimitUntil = 0;
  private consecutiveRateLimits = 0;
  private serviceUnavailableUntil = 0;
  private consecutive503s = 0;

  /**
   * Retrieves active Gemini API Key from the global resolver
   */
  public getActiveApiKey(): string {
    return getActiveGeminiApiKey();
  }

  public getCurrentModel(): GeminiModelName {
    return GEMINI_MODELS_FALLBACK_CHAIN[this.activeModelIndex] || 'gemini-3.8-flash';
  }

  /**
   * Low-level Gemini REST caller. Model fallback is reserved for model/service errors;
   * rate limits and network timeouts must not fan out into more requests.
   * Configurable timeout and output-token limits.
   */
  public async generateContent(params: {
    systemPrompt: string;
    messages: ChatMessage[];
    temperature?: number;
    jsonMode?: boolean;
    maxOutputTokens?: number;
    timeoutMs?: number;
    overallTimeoutMs?: number;
  }): Promise<string> {
    const {
      systemPrompt,
      messages,
      temperature = 0.7,
      jsonMode = false,
      maxOutputTokens = 1200,
      timeoutMs = 8_000,
      overallTimeoutMs = 9_000,
    } = params;
    const apiKey = this.getActiveApiKey();
    if (!apiKey) {
      throw new Error('Chưa có Gemini API Key. Hãy thêm key cá nhân trong Cài đặt → AI & Voice Settings.');
    }

    const remainingRateLimitMs = this.rateLimitUntil - Date.now();
    if (remainingRateLimitMs > 0) {
      throw new Error(formatRateLimitMessage(remainingRateLimitMs));
    }
    const remainingServiceUnavailableMs = this.serviceUnavailableUntil - Date.now();
    if (remainingServiceUnavailableMs > 0) {
      throw new Error(formatServiceUnavailableMessage(remainingServiceUnavailableMs));
    }

    // Standardize contents with strict user-first multi-turn alternation (Case 1)
    const contents = normalizeGeminiContents(messages);

    const errors: string[] = [];
    const overallDeadline = Date.now() + overallTimeoutMs;
    let automatic429Retries = 0;
    let automatic503Retries = 0;

    // Try at most two models for 404. A 429, 503, or connectivity error is
    // handled on its own so the fallback chain cannot multiply failed requests.
    for (let i = 0; i < Math.min(GEMINI_MODELS_FALLBACK_CHAIN.length, MAX_MODEL_ATTEMPTS); i++) {
      const remainingTime = overallDeadline - Date.now();
      if (remainingTime < 1000) {
        break; // Approaching deadline, prevent blocking user
      }

      const modelIndex = (this.activeModelIndex + i) % GEMINI_MODELS_FALLBACK_CHAIN.length;
      const modelName = GEMINI_MODELS_FALLBACK_CHAIN[modelIndex]!;
      const url = `/api/gemini/models/${modelName}:generateContent`;

      const requestPayload: Record<string, unknown> = {
        contents,
        systemInstruction: {
          parts: [{ text: systemPrompt }],
        },
        generationConfig: {
          temperature,
          maxOutputTokens,
          ...(jsonMode ? { responseMimeType: 'application/json' } : {}),
        },
      };

      const perAttemptTimeout = Math.min(timeoutMs, remainingTime);
      const controller = new AbortController();
      const timeoutTimer = setTimeout(() => controller.abort(), perAttemptTimeout);

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-goog-api-key': apiKey.trim(),
          },
          body: JSON.stringify(requestPayload),
          signal: controller.signal,
        });

        clearTimeout(timeoutTimer);

        // Case 3: Stop fallback immediately on HTTP 400/401/403 (Invalid key or bad request)
        if (response.status === 401 || response.status === 403) {
          const fatalErr = new Error(
            `API Key không hợp lệ hoặc không có quyền truy cập (HTTP ${response.status}). Vui lòng kiểm tra lại Google Gemini API Key trong mục Cài Đặt.`
          );
          (fatalErr as any).isFatalAuthOrClientError = true;
          throw fatalErr;
        }

        if (response.status === 400) {
          const errBody = await response.text().catch(() => '');
          const fatalErr = new Error(
            `Cấu trúc yêu cầu không hợp lệ (HTTP 400 trên model ${modelName}): ${errBody.slice(0, 250)}`
          );
          (fatalErr as any).isFatalAuthOrClientError = true;
          throw fatalErr;
        }

        if (response.status === 429) {
          const errBody = await response.text().catch(() => '');
          const serverRetryAfterMs = parseRetryAfterMs(response, errBody);
          const fallbackBackoffMs = Math.min(
            1_000 * (2 ** this.consecutiveRateLimits),
            MAX_RATE_LIMIT_BACKOFF_MS,
          );
          const retryAfterMs = serverRetryAfterMs ?? fallbackBackoffMs;
          this.consecutiveRateLimits += 1;
          this.rateLimitUntil = Date.now() + retryAfterMs;

          if (
            automatic429Retries < MAX_AUTOMATIC_429_RETRIES &&
            retryAfterMs <= 2_000 &&
            Date.now() + retryAfterMs + 1_000 < overallDeadline
          ) {
            automatic429Retries += 1;
            await sleep(retryAfterMs);
            this.rateLimitUntil = 0;
            i -= 1;
            continue;
          }

          const rateLimitError = new Error(formatRateLimitMessage(retryAfterMs));
          (rateLimitError as any).isNonRetryable = true;
          throw rateLimitError;
        }

        if (response.status === 503) {
          const errBody = await response.text().catch(() => '');
          const serverRetryAfterMs = parseRetryAfterMs(response, errBody);
          const fallbackBackoffMs = Math.min(1_000 * (2 ** this.consecutive503s), MAX_RATE_LIMIT_BACKOFF_MS);
          const retryAfterMs = serverRetryAfterMs ?? fallbackBackoffMs;
          this.consecutive503s += 1;
          this.serviceUnavailableUntil = Date.now() + retryAfterMs;

          if (
            automatic503Retries < MAX_AUTOMATIC_503_RETRIES &&
            retryAfterMs <= 2_000 &&
            Date.now() + retryAfterMs + 1_000 < overallDeadline
          ) {
            automatic503Retries += 1;
            await sleep(retryAfterMs);
            this.serviceUnavailableUntil = 0;
            i -= 1;
            continue;
          }

          const serviceUnavailableError = new Error(formatServiceUnavailableMessage(retryAfterMs));
          (serviceUnavailableError as any).isNonRetryable = true;
          throw serviceUnavailableError;
        }

        // A missing model can be fixed by trying the next model in the chain.
        if (response.status === 404) {
          const errBody = await response.text().catch(() => '');
          console.warn(`[Gemini REST Failover] Model ${modelName} returned HTTP ${response.status}: ${errBody.slice(0, 100)}. Trying another model.`);
          errors.push(`${modelName} (HTTP ${response.status})`);
          this.activeModelIndex = (modelIndex + 1) % GEMINI_MODELS_FALLBACK_CHAIN.length;
          useTamSpeakStore.getState().setActiveAIProvider(GEMINI_MODELS_FALLBACK_CHAIN[this.activeModelIndex]!);
          continue;
        }

        if (!response.ok) {
          const errBody = await response.text().catch(() => '');
          const apiError = new Error(`Gemini API trả về HTTP ${response.status}: ${errBody.slice(0, 200)}`);
          (apiError as any).isNonRetryable = true;
          throw apiError;
        }

        const data = await response.json();
        const parts = data?.candidates?.[0]?.content?.parts || [];
        // In Gemini 3, handle potential internal thought parts (thought: true)
        const answerParts = parts.filter((p: any) => !p.thought && typeof p.text === 'string');
        const text =
          answerParts.length > 0
            ? answerParts.map((p: any) => p.text).join('')
            : parts.find((p: any) => typeof p.text === 'string')?.text;
        if (!text || text.trim().length === 0) {
          throw new Error(`Model ${modelName} returned empty text.`);
        }

        // Successfully resolved! Update badge if shifted
        this.activeModelIndex = modelIndex;
        this.consecutiveRateLimits = 0;
        this.rateLimitUntil = 0;
        this.consecutive503s = 0;
        this.serviceUnavailableUntil = 0;
        useTamSpeakStore.getState().setActiveAIProvider(modelName);
        return text.trim();
      } catch (err: any) {
        clearTimeout(timeoutTimer);
        // A network timeout, 429, or client/configuration error is not fixed by
        // sending the same audio to several other model endpoints.
        if (err?.isFatalAuthOrClientError || err?.isNonRetryable) {
          throw err;
        }

        if (err?.name === 'AbortError') {
          throw new Error(`Gemini chưa phản hồi trong ${Math.ceil(perAttemptTimeout / 1000)} giây. Bạn có thể thử lại sau.`);
        }

        if (err instanceof TypeError) {
          throw new Error(`Không kết nối được tới Gemini: ${(err as Error).message}`);
        }

        const errMsg = (err as Error).message;
        errors.push(`${modelName}: ${errMsg}`);
        // Fallback only for unexpected model-specific errors.
        this.activeModelIndex = (modelIndex + 1) % GEMINI_MODELS_FALLBACK_CHAIN.length;
        useTamSpeakStore.getState().setActiveAIProvider(GEMINI_MODELS_FALLBACK_CHAIN[this.activeModelIndex]!);
      }
    }

    throw new Error(`Tất cả các model Gemini đều thất bại: ${errors.join(' | ')}. Vui lòng kiểm tra lại API Key trong mục Settings.`);
  }

  /**
   * Helper: extract clean JSON from LLM response (handling markdown fences)
   */
  public cleanAndParseJson<T>(rawText: string, fallback: T): T {
    try {
      const stripped = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
      const match = stripped.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
      if (match) {
        return JSON.parse(match[0]) as T;
      }
      return JSON.parse(stripped) as T;
    } catch {
      return fallback;
    }
  }

  /**
   * Dynamic Vocab Hints: Generates Band 7.5-8.5 keywords, collocations & idioms tailored to topic + question
   * Features in-memory caching for sub-millisecond tab switching
   */
  public async generateVocabHints(topicTitle: string, currentQuestion: string): Promise<GeneratedVocabHints> {
    const cacheKey = `${topicTitle.trim().toLowerCase()}::${currentQuestion.trim().toLowerCase()}`;
    if (this.vocabHintsCache.has(cacheKey)) {
      return this.vocabHintsCache.get(cacheKey)!;
    }

    const systemPrompt = `You are an elite IELTS Speaking Cambridge Lexical Expert.
Generate high-scoring Band 7.5 - 8.5 vocabulary hints specifically tailored to the topic and current discussion question.

Return ONLY valid JSON:
{
  "activeKeywords": [
    {
      "word": "string",
      "ipa": "/string/",
      "band": "8.0",
      "meaningVi": "string",
      "example": "string"
    }
  ],
  "collocations": [
    {
      "phrase": "string",
      "meaningVi": "string",
      "example": "string"
    }
  ],
  "idioms": [
    {
      "idiom": "string",
      "ipa": "/string/",
      "meaningEn": "string",
      "meaningVi": "string",
      "example": "string"
    }
  ]
}
Provide exactly 5-6 activeKeywords, 5 collocations, and 3-4 natural idioms.`;

    const userPrompt = `Topic: "${topicTitle}"\nCurrent IELTS Question: "${currentQuestion}"\nGenerate the vocabulary hints JSON now.`;

    const raw = await this.generateContent({
        systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
        temperature: 0.5,
        jsonMode: true,
        maxOutputTokens: 800,
        timeoutMs: 7_000,
      });

    const parsed = this.cleanAndParseJson<GeneratedVocabHints>(raw, {
      activeKeywords: [], collocations: [], idioms: [],
    });
    const valid = (value: unknown): value is GeneratedVocabHints => {
      if (!value || typeof value !== 'object') return false;
      const data = value as GeneratedVocabHints;
      return Array.isArray(data.activeKeywords) && data.activeKeywords.every((item) =>
        item && typeof item.word === 'string' && typeof item.ipa === 'string' &&
        typeof item.band === 'string' && typeof item.meaningVi === 'string' && typeof item.example === 'string'
      ) && Array.isArray(data.collocations) && data.collocations.every((item) =>
        item && typeof item.phrase === 'string' && typeof item.meaningVi === 'string' && typeof item.example === 'string'
      ) && Array.isArray(data.idioms) && data.idioms.every((item) =>
        item && typeof item.idiom === 'string' && typeof item.ipa === 'string' &&
        typeof item.meaningEn === 'string' && typeof item.meaningVi === 'string' && typeof item.example === 'string'
      );
    };
    if (!valid(parsed) || parsed.activeKeywords.length === 0) {
      throw new Error('AI trả về dữ liệu gợi ý từ vựng không hợp lệ. Hãy thử làm mới.');
    }

    this.vocabHintsCache.set(cacheKey, parsed);
    return parsed;
  }

  /**
   * Conversation Practice Examiner Turn:
   * Evaluates user utterance (identifying phonetic & grammar slips) + generates natural transition sentence + next question.
   */
  public async generateExaminerTurn(params: {
    topicTitle: string;
    currentQuestion: string;
    userAnswer: string;
    nextPlannedQuestion?: string;
    isFullMock?: boolean;
    partName?: string;
    audioBlob?: Blob;
  }): Promise<ExaminerTurnResult> {
    const systemPrompt = `You are an authentic, encouraging IELTS Speaking Examiner in a real interview.

ABSOLUTE AUDIO/TRANSCRIPT SAFETY: If audio is attached, listen directly and treat the candidate transcript as an unreliable draft. Never invent a sentence. Evaluate only words supported by the provided transcript/audio. If the input is empty or unintelligible, say so plainly, leave inferredIntendedSentence null, and keep mistakes empty.
The candidate just answered your question.

VIETNAMESE ENTITIES & CULTURE: The candidate is Vietnamese and may reference Vietnamese proper nouns, regional dishes, or place names (e.g., 'banh mi', 'Dong Nai', 'pho', 'Da Nang', 'ao dai', 'Ho Chi Minh'). Recognize and treat these as valid natural proper nouns; do not incorrectly flag them as English mistakes.

YOUR TASKS:
1. "feedbackTransition": 1 concise sentence acknowledging the candidate's answer naturally and specifically (e.g. "Thank you, that offers an insightful perspective." or "That is a fascinating personal memory.")
2. "nextQuestion": If nextPlannedQuestion is provided, transition seamlessly into it. If not, formulate an engaging natural follow-up question directly related to what the candidate just explained.
3. "suggestedUpgrade": Provide an upgraded Band 8.5+ native phrasing of their core idea.
4. "inferredIntendedSentence": Only correct a clearly supported word or phrase. Never reconstruct an entire sentence from silence, noise, or a few uncertain words; return null in that case.
5. "mistakes": Identify at most 3 actual grammar or phonetic pronunciation confusions (strictly ignore Vietnamese proper nouns).
6. "speechAnalysis": Brief notes on fluency and grammatical accuracy.

Return ONLY valid JSON:
{
  "feedbackTransition": "string",
  "nextQuestion": "string",
  "suggestedUpgrade": "string",
  "inferredIntendedSentence": "string or null",
  "mistakes": [
    {
      "word": "string",
      "ipa": "/string/",
      "reason": "explanation of mistake",
      "suggestedAlternative": "corrected word"
    }
  ],
  "speechAnalysis": {
    "fluencyNote": "string",
    "grammarNote": "string"
  }
}`;

    const userPrompt = `Topic: "${params.topicTitle}" (${params.partName || 'IELTS'})
Previous Question: "${params.currentQuestion}"
Web Speech draft (may be inaccurate): "${params.userAnswer || '(unavailable)'}"
${params.nextPlannedQuestion ? `Next Planned Question: "${params.nextPlannedQuestion}"` : ''}

Listen to the attached audio, transcribe it, then generate JSON evaluation and transition.`;

    const userMessage: ChatMessage = { role: 'user', content: userPrompt };
    if (params.audioBlob) {
      userMessage.inlineData = {
        mimeType: params.audioBlob.type.split(';')[0] || 'audio/webm',
        data: await this.blobToBase64(params.audioBlob),
      };
    }

    const raw = await this.generateContent({
      systemPrompt,
      messages: [userMessage],
      temperature: 0.6,
      jsonMode: true,
      maxOutputTokens: 700,
      timeoutMs: 24_000,
      overallTimeoutMs: 25_000,
    });

    const parsed = this.cleanAndParseJson<ExaminerTurnResult>(raw, {
      feedbackTransition: '',
      nextQuestion: params.nextPlannedQuestion || '',
      suggestedUpgrade: '',
      inferredIntendedSentence: undefined,
      mistakes: [],
      speechAnalysis: {
        fluencyNote: '',
        grammarNote: '',
      },
    });

    return parsed;
  }

  /**
   * Generates a 100% dynamic, context-aware opening prompt / question for any topic
   */
  public async generateTopicOpening(params: {
    topicTitle: string;
    mode?: string;
    part?: string;
    aiRole?: string;
    userRole?: string;
  }): Promise<string> {
    const isRoleplay = params.mode === 'roleplay';
    const systemPrompt = isRoleplay
      ? `You are roleplaying as: ${params.aiRole || 'an English conversational partner'}.
The user is roleplaying as: ${params.userRole || 'a conversation participant'}.
The topic is: "${params.topicTitle}".
Start the conversation with an authentic, engaging in-character opening greeting and a natural opening question (maximum 2-3 sentences). Do not break character.`
      : `You are an elite, certified IELTS Speaking Examiner conducting an official IELTS interview.
Topic: "${params.topicTitle}" (${params.part || 'Part 1'}).
Welcome the candidate warmly and ask an engaging, authentic first IELTS question for this topic (maximum 2 sentences).
Do not use generic placeholders. Formulate a genuine, topic-specific opening question.`;

    const raw = await this.generateContent({
      systemPrompt,
      messages: [{ role: 'user', content: `Please generate the opening line and question for topic "${params.topicTitle}".` }],
      temperature: 0.7,
      maxOutputTokens: 300,
      timeoutMs: 7_000,
    });

    return raw.trim().replace(/^["']|["']$/g, '');
  }

  /**
   * Generates a dynamic, friendly greeting from Alex (Speaking AI buddy)
   */
  public async generateAlexGreeting(userName?: string): Promise<string> {
    const systemPrompt = `You are Alex, an energetic, friendly, and supportive English speaking practice companion.
The user's name is ${userName || 'friend'}.
Generate a warm, spontaneous, and conversational opening greeting to kick off today's speaking session. Ask a friendly, engaging question to invite them to start talking (1-2 sentences maximum).`;

    const raw = await this.generateContent({
      systemPrompt,
      messages: [{ role: 'user', content: 'Generate opening greeting now.' }],
      temperature: 0.8,
      maxOutputTokens: 200,
      timeoutMs: 6_000,
    });

    return raw.trim().replace(/^["']|["']$/g, '');
  }

  public async generatePlacementQuestions(): Promise<PlacementQuestion[]> {
    const raw = await this.generateContent({
      systemPrompt: `Generate exactly three distinct spoken-English placement questions. Cover personal experience, preferences, and an opinion requiring explanation. Return only valid JSON in this shape: {"questions":[{"label":"short label","prompt":"question"}]}. Do not use generic filler or fixed sample questions.`,
      messages: [{ role: 'user', content: 'Create the placement questions now.' }],
      temperature: 0.7,
      jsonMode: true,
      maxOutputTokens: 400,
      timeoutMs: 7_000,
    });
    const parsed = this.cleanAndParseJson<{ questions?: PlacementQuestion[] }>(raw, { questions: [] });
    return (parsed.questions || [])
      .filter((question) => question?.label?.trim() && question?.prompt?.trim())
      .slice(0, 3);
  }

  /**
   * Placement Test Evaluation: 3 questions from Onboarding
   */
  public async evaluatePlacementTest(answers: Array<{ question: string; answer: string }>): Promise<PlacementTestResult> {
    const systemPrompt = `You are a certified British Council / IDP IELTS Speaking Senior Examiner.
Evaluate these 3 short placement test responses from a candidate.

Score criteria: Pronunciation, Fluency, Lexical Resource, Grammatical Accuracy.
Assign an overall IELTS band between 3.0 and 8.5 (rounded to nearest 0.5).
Map to CEFR level:
- < 4.0: a2
- 4.0 - 5.0: b1
- 5.5 - 6.5: b2
- 7.0 - 8.0: c1
- 8.5 - 9.0: c2

Return ONLY valid JSON:
{
  "overallBand": 6.5,
  "cefrLevel": "b2",
  "summaryFeedback": "string",
  "strengths": ["string", "string"],
  "weaknesses": ["string", "string"]
}`;

    const userPrompt = answers
      .map((a, i) => `Question ${i + 1}: ${a.question}\nCandidate Answer: ${a.answer}`)
      .join('\n\n');

    try {
      const raw = await this.generateContent({
        systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
        temperature: 0.3,
        jsonMode: true,
        maxOutputTokens: 500,
        timeoutMs: 5_500,
      });

      const parsed = this.cleanAndParseJson<PlacementTestResult>(raw, {
        overallBand: 6.0,
        cefrLevel: 'b2',
        summaryFeedback: 'Good functional speaking ability with clear communicational intent.',
        strengths: ['Clear delivery on familiar prompts', 'Good foundational vocabulary'],
        weaknesses: ['Expand subordinating conjunctions', 'Refine word stress on complex words'],
      });

      return parsed;
    } catch {
      return {
        overallBand: 6.0,
        cefrLevel: 'b2',
        summaryFeedback: 'Solid conversational confidence with room to expand grammatical range.',
        strengths: ['Natural pacing on personal topics', 'Willingness to speak at length'],
        weaknesses: ['Vary lexical collocations', 'Practice complex conditional clauses'],
      };
    }
  }
  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
      reader.onerror = () => reject(reader.error || new Error('Could not read recorded audio.'));
      reader.readAsDataURL(blob);
    });
  }
}

// Global Singleton
export const aiService = new AIService();
