/**
 * FreeTranslateAdapter
 * Provides 0-token instant translation for single words and sentences in the Scratchpad & Transcript Box.
 * Primary Endpoint: Google Translate GTX endpoint (free, no API key).
 * Secondary Fallback: MyMemory Translation API.
 */
export class FreeTranslateAdapter {
  public async translateText(
    text: string,
    fromLang = 'en',
    toLang = 'vi'
  ): Promise<string> {
    const trimmed = text.trim();
    if (!trimmed) return '';

    try {
      // 1. Primary: Google Translate GTX endpoint
      const translated = await this.translateViaGTX(trimmed, fromLang, toLang);
      if (translated) {
        return translated;
      }
    } catch {
      // Fall through to MyMemory
    }

    try {
      // 2. Secondary Fallback: MyMemory API
      const fallbackResult = await this.translateViaMyMemory(trimmed, fromLang, toLang);
      if (fallbackResult) {
        return fallbackResult;
      }
    } catch {
      // Fallback failed
    }

    return trimmed;
  }

  private async translateViaGTX(text: string, fromLang: string, toLang: string): Promise<string | null> {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(
      fromLang
    )}&tl=${encodeURIComponent(toLang)}&dt=t&q=${encodeURIComponent(text)}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) return null;

      const data = (await response.json()) as unknown[];
      // Expected structure: [[["translated_chunk", "original_chunk", ...], ...], ...]
      if (Array.isArray(data) && Array.isArray(data[0])) {
        const chunks = data[0] as Array<unknown[]>;
        const result = chunks.map((c) => (Array.isArray(c) && typeof c[0] === 'string' ? c[0] : '')).join('');
        return result.trim() || null;
      }

      return null;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async translateViaMyMemory(text: string, fromLang: string, toLang: string): Promise<string | null> {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(
      text
    )}&langpair=${encodeURIComponent(fromLang)}|${encodeURIComponent(toLang)}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) return null;

      const data = (await response.json()) as {
        responseData?: {
          translatedText?: string;
        };
      };

      const translated = data.responseData?.translatedText;
      return translated?.trim() || null;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
