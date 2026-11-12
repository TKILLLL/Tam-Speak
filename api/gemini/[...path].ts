import type { IncomingMessage, ServerResponse } from 'node:http';

type VercelRequest = IncomingMessage & {
  method?: string;
  url?: string;
  body?: unknown;
};

type VercelResponse = ServerResponse & {
  status(code: number): VercelResponse;
  json(payload: unknown): void;
};

/** Same-origin relay for browser Gemini calls that fail cross-origin fetch. */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = req.headers['x-goog-api-key'];
  const key = Array.isArray(apiKey) ? apiKey[0] : apiKey;
  if (!key?.trim()) {
    res.status(401).json({ error: 'Gemini API key is required' });
    return;
  }

  const path = decodeURIComponent((req.url || '').split('?')[0] || '')
    .replace(/^\/api\/gemini\/?/, '');
  if (!/^models\/[A-Za-z0-9._-]+:(generateContent|streamGenerateContent)$/.test(path)) {
    res.status(400).json({ error: 'Unsupported Gemini endpoint' });
    return;
  }

  try {
    let body: string;
    if (typeof req.body === 'string') body = req.body;
    else if (req.body) body = JSON.stringify(req.body);
    else {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      body = Buffer.concat(chunks).toString('utf8');
    }

    const upstream = await fetch(`https://generativelanguage.googleapis.com/v1beta/${path}${new URL(req.url || '/', 'http://localhost').search}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-goog-api-key': key.trim() },
      body,
    });
    res.status(upstream.status);
    const contentType = upstream.headers.get('content-type');
    if (contentType) res.setHeader('content-type', contentType);
    res.end(Buffer.from(await upstream.arrayBuffer()));
  } catch (error) {
    res.status(502).json({ error: error instanceof Error ? error.message : 'Gemini upstream request failed' });
  }
}
