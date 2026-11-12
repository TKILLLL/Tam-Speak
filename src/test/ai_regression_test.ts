import assert from 'node:assert/strict';
import { ResilientAIGateway } from '../infrastructure/ai/ResilientAIGateway';
import { normalizeGeminiContents } from '../infrastructure/ai/normalizeGeminiContents';
import { CircuitBreaker } from '../infrastructure/security/CircuitBreaker';
import { IAIProviderStrategy } from '../infrastructure/ai/providers/IAIProviderStrategy';
import { GeminiStreamingService } from '../infrastructure/ai/GeminiStreamingService';

async function main() {
  console.log('Testing audio payload normalization, transcript comparison, model fallback and cooldown...');

  const normalized = normalizeGeminiContents([{
    role: 'user', content: 'draft', inlineData: { mimeType: 'audio/webm', data: 'AQID' },
  }]);
  assert.equal(normalized[0]?.parts.length, 2);
  assert.equal(normalized[0]?.parts[1]?.inlineData?.data, 'AQID');

  const streamingService = new GeminiStreamingService();
  const originalFetch = globalThis.fetch;
  let streamingRequest: { url: string; body: any } | null = null;
  globalThis.fetch = (async (input, init) => {
    streamingRequest = { url: String(input), body: JSON.parse(String(init?.body)) };
    return new Response('data: {"candidates":[{"content":{"parts":[{"text":"Hello."}]}}]}\n\n', {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    });
  }) as typeof fetch;
  try {
    await streamingService.streamReply({
      apiKey: 'test-key',
      model: 'gemini-test-model',
      history: [
        { role: 'model', text: 'Welcome.' },
        { role: 'user', text: 'I am learning English.' },
        { role: 'user', text: 'I am learning English.' },
      ],
      onSentence: () => undefined,
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
  const capturedRequest = streamingRequest as { url: string; body: any } | null;
  assert.equal(capturedRequest?.url, '/api/gemini/models/gemini-test-model:streamGenerateContent?alt=sse');
  assert.deepEqual(
    capturedRequest?.body.contents.map((turn: any) => turn.role),
    ['user', 'model', 'user'],
    'streaming contents must start with user and alternate roles',
  );

  const gateway = new ResilientAIGateway({ geminiKeys: ['test-key'] });
  const parse = (gateway as any).parseSpeakingAIOutput.bind(gateway);
  const parsed = parse(JSON.stringify({
    heard: 'I live in Dong Nai.',
    intended: 'I live in Dong Nai.',
    friend_reply: 'That sounds lovely.',
  }), '', 'test-model');
  assert.equal(parsed.rawSttInput, 'I live in Dong Nai.');
  assert.equal(parsed.wasSttMisrecognized, false);
  const corrected = parse(JSON.stringify({
    heard: 'I go yesterday.', intended: 'I went yesterday.', friend_reply: 'Where did you go?'
  }), '', 'test-model');
  assert.equal(corrected.wasSttMisrecognized, true);

  const calls: string[] = [];
  const first: IAIProviderStrategy = {
    providerId: 'first', modelName: 'first',
    generateChatCompletion: async () => { calls.push('first'); throw new Error('HTTP 429 rate limited'); },
  };
  const second: IAIProviderStrategy = {
    providerId: 'second', modelName: 'second',
    generateChatCompletion: async () => { calls.push('second'); return '{"ok":true}'; },
  };
  gateway.registerStrategy(first);
  gateway.registerStrategy(second);
  const execute = (gateway as any).executeWithFallback.bind(gateway);
  await execute(['first', 'second'], 'system', [{ role: 'user', content: 'hello' }]);
  assert.deepEqual(calls, ['first', 'second']);

  const breaker = new CircuitBreaker('cooldown-test', {
    failureThreshold: 1, recoveryTimeoutMs: 5, halfOpenSuccessThreshold: 1,
  });
  breaker.recordFailure();
  assert.equal(breaker.isAvailable(), false);
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(breaker.isAvailable(), true);
  console.log('[SUCCESS] AI regression tests passed.');
}

void main();
