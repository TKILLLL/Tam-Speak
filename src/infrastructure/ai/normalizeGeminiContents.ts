/**
 * normalizeGeminiContents
 * Standardizes chat messages into strict Google Gemini Multi-Turn Contents format:
 * 1. Must always start with role 'user'.
 * 2. Roles must strictly alternate between 'user' and 'model'.
 * 3. Consecutive turns with the same role are automatically merged.
 * 4. Filters out system messages and empty content parts.
 * 5. Prepend friendly user turn if history begins with model greeting.
 * 6. Ensures final turn is from 'user' before model generation.
 */

export interface GeminiContentPart {
  text: string;
}

export interface GeminiContent {
  role: 'user' | 'model';
  parts: GeminiContentPart[];
}

export interface InputChatMessage {
  role: 'user' | 'assistant' | 'system' | 'model';
  content: string;
}

export function normalizeGeminiContents(messages: readonly InputChatMessage[]): GeminiContent[] {
  // 1. Filter out system messages and blank utterances
  const validMessages = messages
    .filter((m) => m.role !== 'system' && m.content && m.content.trim().length > 0)
    .map((m) => ({
      role: (m.role === 'assistant' || m.role === 'model' ? 'model' : 'user') as 'user' | 'model',
      text: m.content.trim(),
    }));

  if (validMessages.length === 0) {
    return [{ role: 'user', parts: [{ text: 'Hello' }] }];
  }

  const normalized: GeminiContent[] = [];

  for (const msg of validMessages) {
    if (normalized.length === 0) {
      if (msg.role === 'model') {
        // Multi-turn Gemini rule: First turn MUST be 'user'
        normalized.push({
          role: 'user',
          parts: [{ text: 'Hello, let us begin our English speaking practice.' }],
        });
        normalized.push({
          role: 'model',
          parts: [{ text: msg.text }],
        });
      } else {
        normalized.push({
          role: 'user',
          parts: [{ text: msg.text }],
        });
      }
    } else {
      const last = normalized[normalized.length - 1]!;
      if (last.role === msg.role) {
        // Consecutive turns with the exact same role: merge to preserve strict alternation
        last.parts.push({ text: msg.text });
      } else {
        normalized.push({
          role: msg.role,
          parts: [{ text: msg.text }],
        });
      }
    }
  }

  // Ensure last turn is 'user' so Gemini generates the next 'model' turn
  if (normalized.length > 0 && normalized[normalized.length - 1]!.role === 'model') {
    normalized.push({
      role: 'user',
      parts: [{ text: 'Please continue and give your response.' }],
    });
  }

  return normalized;
}
