import { GrammarCheckError } from '../../domain/interfaces/IDictionaryGateway';

interface LanguageToolMatch {
  message: string;
  offset: number;
  length: number;
  replacements: Array<{ value: string }>;
  rule: {
    id: string;
    description: string;
  };
}

interface LanguageToolResponse {
  matches: LanguageToolMatch[];
}

/**
 * LanguageToolAdapter
 * Instant client-side grammar & spell checking via LanguageTool Public API (0-Token).
 * Identifies grammatical errors, typos, and phrasing flaws without calling any LLM.
 */
export class LanguageToolAdapter {
  private static readonly API_ENDPOINT = 'https://api.languagetool.org/v2/check';

  public async checkGrammar(text: string): Promise<GrammarCheckError[]> {
    const trimmed = text.trim();
    if (!trimmed || trimmed.length < 3) return [];

    const bodyParams = new URLSearchParams();
    bodyParams.append('text', trimmed);
    bodyParams.append('language', 'en-US');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout

    try {
      const response = await fetch(LanguageToolAdapter.API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: bodyParams.toString(),
        signal: controller.signal,
      });

      if (!response.ok) {
        return [];
      }

      const data = (await response.json()) as LanguageToolResponse;
      if (!data.matches || !Array.isArray(data.matches)) {
        return [];
      }

      return data.matches.map((m) => ({
        message: m.message,
        offset: m.offset,
        length: m.length,
        replacements: m.replacements.slice(0, 3).map((r) => r.value),
        ruleId: m.rule.id,
      }));
    } catch {
      // In case of timeout or offline, return empty list safely
      return [];
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
