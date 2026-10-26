import { IAIProviderStrategy, ChatMessagePayload } from './IAIProviderStrategy';
import { SensitiveDataRedactor } from '../../security/SensitiveDataRedactor';

export class GeminiProviderStrategy implements IAIProviderStrategy {
  constructor(
    public readonly providerId: string, // e.g. 'gemini_pro', 'gemini_flash', 'gemini_flash_lite'
    public readonly modelName: string   // e.g. 'gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'
  ) {}

  public async generateChatCompletion(params: {
    systemPrompt: string;
    messages: ChatMessagePayload[];
    apiKey: string;
    temperature?: number;
    jsonMode?: boolean;
  }): Promise<string> {
    const { systemPrompt, messages, apiKey, temperature = 0.7, jsonMode = false } = params;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.modelName}:generateContent?key=${encodeURIComponent(apiKey)}`;

    // Convert messages to Gemini contents format
    const contents = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

    const requestBody: Record<string, unknown> = {
      contents,
      systemInstruction: {
        parts: [{ text: systemPrompt }],
      },
      generationConfig: {
        temperature,
        maxOutputTokens: 2048,
        responseMimeType: jsonMode ? 'application/json' : 'text/plain',
      },
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25_000); // 25s timeout

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
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
            parts?: Array<{ text?: string }>;
          };
        }>;
      };

      const candidate = jsonResponse.candidates?.[0];
      const text = candidate?.content?.parts?.[0]?.text;

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
