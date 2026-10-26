import { IAIProviderStrategy, ChatMessagePayload } from './IAIProviderStrategy';
import { SensitiveDataRedactor } from '../../security/SensitiveDataRedactor';

export class OpenRouterProviderStrategy implements IAIProviderStrategy {
  public readonly providerId = 'openrouter';

  constructor(
    public readonly modelName: string = 'meta-llama/llama-3.3-70b-instruct:free'
  ) {}

  public async generateChatCompletion(params: {
    systemPrompt: string;
    messages: ChatMessagePayload[];
    apiKey: string;
    temperature?: number;
    jsonMode?: boolean;
  }): Promise<string> {
    const { systemPrompt, messages, apiKey, temperature = 0.7, jsonMode = false } = params;

    const url = 'https://openrouter.ai/api/v1/chat/completions';

    const fullMessages = [
      { role: 'system', content: systemPrompt },
      ...messages,
    ];

    const requestBody: Record<string, unknown> = {
      model: this.modelName,
      messages: fullMessages,
      temperature,
    };

    if (jsonMode) {
      requestBody.response_format = { type: 'json_object' };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25_000);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey.trim()}`,
          'HTTP-Referer': 'https://tamspeak.local',
          'X-Title': 'TamSpeak English Coach',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        const redacted = SensitiveDataRedactor.redactString(errorText);
        throw new Error(
          `OpenRouter API Error [${response.status} ${response.statusText}]: ${redacted}`
        );
      }

      const json = (await response.json()) as {
        choices?: Array<{
          message?: {
            content?: string;
          };
        }>;
      };

      const content = json.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error('OpenRouter returned empty response content.');
      }

      return content;
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        throw new Error('OpenRouter API request timed out.');
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
