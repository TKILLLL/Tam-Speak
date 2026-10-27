import { IAIProviderStrategy, ChatMessagePayload } from './IAIProviderStrategy';
import { SensitiveDataRedactor } from '../../security/SensitiveDataRedactor';

export class GeminiProviderStrategy implements IAIProviderStrategy {
  constructor(
    public readonly providerId: string, // e.g. 'gemini_3_8_flash', 'gemini_3_5_flash_lite', 'gemini_3_6_flash'
    public readonly modelName: string   // e.g. 'gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-3.6-flash'
  ) {}

  public async generateChatCompletion(params: {
    systemPrompt: string;
    messages: ChatMessagePayload[];
    apiKey: string;
    temperature?: number;
    jsonMode?: boolean;
    maxOutputTokens?: number;
    timeoutMs?: number;
  }): Promise<string> {
    const {
      systemPrompt,
      messages,
      apiKey,
      temperature = 0.7,
      jsonMode = false,
      maxOutputTokens = 800,
      timeoutMs = 15_000,
    } = params;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.modelName}:generateContent`;

    // Convert messages to Gemini multi-turn contents format
    // Multi-turn Gemini requirement: First turn must be 'user', roles must alternate
    const nonSystem = messages.filter((m) => m.role !== 'system');
    const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

    for (const msg of nonSystem) {
      const role: 'user' | 'model' = msg.role === 'assistant' ? 'model' : 'user';
      if (contents.length === 0) {
        if (role === 'model') {
          // Prepend an initial user turn so conversation starts with 'user'
          contents.push({ role: 'user', parts: [{ text: 'Hello Alex!' }] });
        }
        contents.push({ role, parts: [{ text: msg.content }] });
      } else {
        const last = contents[contents.length - 1]!;
        if (last.role === role) {
          last.parts.push({ text: msg.content });
        } else {
          contents.push({ role, parts: [{ text: msg.content }] });
        }
      }
    }

    const requestBody: Record<string, unknown> = {
      contents,
      systemInstruction: {
        parts: [{ text: systemPrompt }],
      },
      generationConfig: {
        temperature,
        maxOutputTokens,
        responseMimeType: jsonMode ? 'application/json' : 'text/plain',
      },
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-goog-api-key': apiKey,
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        const redactedError = SensitiveDataRedactor.redactString(errorText);
        throw new Error(
          `Gemini API Error [${response.status} ${response.statusText}] on model ${this.modelName}: ${redactedError}`
        );
      }

      const jsonResponse = (await response.json()) as {
        candidates?: Array<{
          content?: {
            parts?: Array<{ text?: string; thought?: boolean }>;
          };
        }>;
      };

      const candidate = jsonResponse.candidates?.[0];
      const parts = candidate?.content?.parts || [];
      // In Gemini 3, handle potential internal reasoning thought parts (thought: true)
      const answerParts = parts.filter((p) => !p.thought && typeof p.text === 'string');
      const text =
        answerParts.length > 0
          ? answerParts.map((p) => p.text).join('')
          : parts.find((p) => typeof p.text === 'string')?.text;

      if (!text) {
        throw new Error(`Gemini returned empty candidate for model ${this.modelName}`);
      }

      return text;
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        throw new Error(`Gemini API request timed out on model ${this.modelName}`);
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
