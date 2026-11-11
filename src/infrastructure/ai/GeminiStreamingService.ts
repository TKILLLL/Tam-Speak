/**
 * Low-latency Gemini voice reply helper.
 * Uses the Gemini SSE endpoint and forwards complete sentences as soon as they
 * arrive, so the caller can start TTS before the response finishes.
 */
export const GEMINI_VOICE_CONFIG = {
  model: 'gemini-2.0-flash',
  temperature: 0.6,
  topP: 0.85,
  topK: 40,
  maxOutputTokens: 120,
} as const;

export const GEMINI_VOICE_SYSTEM_INSTRUCTION = [
  'You are a friendly speaking partner in a voice conversation.',
  'Reply in 2 or 3 short sentences, no more than 40 words total.',
  'End with one natural question.',
  'Use plain text only. Never use Markdown, asterisks, headings, bullets, or list markers.',
].join(' ');

export function cleanVoiceText(text: string): string {
  return text
    .replace(/[\*#_`>\[\]{}|~]/g, '')
    .replace(/^\s*[-+•]\s*/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Keeps an unfinished sentence in memory until punctuation or newline arrives. */
export class SentenceSplitter {
  private buffer = '';

  push(chunk: string): string[] {
    this.buffer += chunk;
    const ready: string[] = [];
    let start = 0;
    const boundary = /[.!?。！？\n]+(?=\s|$)/g;
    for (const match of this.buffer.matchAll(boundary)) {
      const end = (match.index ?? 0) + match[0].length;
      const sentence = cleanVoiceText(this.buffer.slice(start, end));
      if (sentence) ready.push(sentence);
      start = end;
    }
    this.buffer = this.buffer.slice(start);
    return ready;
  }

  flush(): string | null {
    const tail = cleanVoiceText(this.buffer);
    this.buffer = '';
    return tail || null;
  }
}

/** Serializes streamed sentences because the browser speech engine cancels an
 * active utterance when a new one is submitted. */
export class SentenceTTSQueue {
  private queue: string[] = [];
  private active = false;

  constructor(private readonly speak: (text: string, done: () => void) => void) {}

  enqueue(sentence: string): void {
    const cleaned = cleanVoiceText(sentence);
    if (!cleaned) return;
    this.queue.push(cleaned);
    this.drain();
  }

  private drain(): void {
    if (this.active || this.queue.length === 0) return;
    this.active = true;
    const next = this.queue.shift()!;
    this.speak(next, () => {
      this.active = false;
      this.drain();
    });
  }
}

export class GeminiStreamingService {
  async streamReply(params: {
    apiKey: string;
    history: Array<{ role: 'user' | 'model'; text: string }>;
    onSentence: (sentence: string) => void;
    signal?: AbortSignal;
  }): Promise<string> {
    if (!params.apiKey.trim()) throw new Error('Gemini API key is required.');
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_VOICE_CONFIG.model}:streamGenerateContent?alt=sse`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-goog-api-key': params.apiKey.trim() },
      body: JSON.stringify({
        contents: params.history.map((turn) => ({
          role: turn.role,
          parts: [{ text: turn.text }],
        })),
        systemInstruction: { parts: [{ text: GEMINI_VOICE_SYSTEM_INSTRUCTION }] },
        generationConfig: {
          temperature: GEMINI_VOICE_CONFIG.temperature,
          topP: GEMINI_VOICE_CONFIG.topP,
          topK: GEMINI_VOICE_CONFIG.topK,
          maxOutputTokens: GEMINI_VOICE_CONFIG.maxOutputTokens,
        },
        // No tools are declared: search, code execution, and function calling are disabled.
      }),
      signal: params.signal,
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`Gemini streaming request failed (${response.status}): ${detail.slice(0, 240)}`);
    }
    if (!response.body) throw new Error('Gemini did not return a streaming response body.');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const splitter = new SentenceSplitter();
    let pending = '';
    let fullText = '';
    const emit = (delta: string) => {
      fullText += delta;
      for (const sentence of splitter.push(delta)) params.onSentence(sentence);
    };

    while (true) {
      const { value, done } = await reader.read();
      pending += decoder.decode(value, { stream: !done });
      const events = pending.split(/\r?\n\r?\n/);
      pending = events.pop() || '';
      for (const event of events) {
        const data = event.split(/\r?\n/).find((line) => line.startsWith('data:'))?.slice(5).trim();
        if (!data || data === '[DONE]') continue;
        const payload = JSON.parse(data) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> } }> };
        const delta = payload.candidates?.[0]?.content?.parts?.filter((part) => !part.thought).map((part) => part.text || '').join('');
        if (delta) emit(delta);
      }
      if (done) break;
    }
    const tail = splitter.flush();
    if (tail) params.onSentence(tail);
    return cleanVoiceText(fullText);
  }
}
