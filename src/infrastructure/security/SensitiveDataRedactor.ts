/**
 * SensitiveDataRedactor - Zero-Trust AppSec Utility
 * Automatically masks sensitive tokens, API keys (Gemini, Groq, OpenRouter, OpenAI),
 * Bearer JWTs, and passwords from logs, error stack traces, and console telemetry.
 */
export class SensitiveDataRedactor {
  // Regex patterns targeting standard AI provider API keys and sensitive tokens
  private static readonly SENSITIVE_PATTERNS: Array<{ name: string; regex: RegExp }> = [
    {
      name: 'Google Gemini API Key',
      regex: /AIza[0-9A-Za-z\-_]{30,40}/g,
    },
    {
      name: 'Groq API Key',
      regex: /gsk_[a-zA-Z0-9]{48,64}/g,
    },
    {
      name: 'OpenRouter API Key',
      regex: /sk-or-v1-[a-zA-Z0-9]{64}/g,
    },
    {
      name: 'OpenAI API Key',
      regex: /sk-[a-zA-Z0-9]{48,51}/g,
    },
    {
      name: 'JWT Bearer Token',
      regex: /Bearer\s+eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g,
    },
    {
      name: 'General Bearer Token',
      regex: /Bearer\s+[a-zA-Z0-9_\-\.]{20,}/g,
    },
    {
      name: 'Password in JSON',
      regex: /"password"\s*:\s*"[^"]+"/gi,
    },
  ];

  /**
   * Redacts sensitive substrings within any text input.
   * Retains the first 4 and last 3 characters for debugging identification while masking the rest.
   */
  public static redactString(input: string): string {
    if (!input || typeof input !== 'string') {
      return '';
    }

    let sanitized = input;

    for (const { regex } of SensitiveDataRedactor.SENSITIVE_PATTERNS) {
      sanitized = sanitized.replace(regex, (match) => {
        if (match.startsWith('"password"')) {
          return '"password": "[REDACTED]"';
        }
        if (match.startsWith('Bearer ')) {
          return 'Bearer [REDACTED_TOKEN]';
        }

        if (match.length <= 10) {
          return '***[REDACTED]***';
        }

        const prefix = match.slice(0, 4);
        const suffix = match.slice(-3);
        return `${prefix}...[REDACTED]...${suffix}`;
      });
    }

    return sanitized;
  }

  /**
   * Recursively traverses an object, stringifying or masking any sensitive properties.
   */
  public static redactObject<T>(obj: T): T {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj === 'string') {
      return SensitiveDataRedactor.redactString(obj) as unknown as T;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => SensitiveDataRedactor.redactObject(item)) as unknown as T;
    }

    if (obj instanceof Error) {
      const sanitizedError = new Error(SensitiveDataRedactor.redactString(obj.message));
      sanitizedError.name = obj.name;
      if (obj.stack) {
        sanitizedError.stack = SensitiveDataRedactor.redactString(obj.stack);
      }
      return sanitizedError as unknown as T;
    }

    if (typeof obj === 'object') {
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        const lowerKey = key.toLowerCase();
        if (
          lowerKey.includes('key') ||
          lowerKey.includes('secret') ||
          lowerKey.includes('token') ||
          lowerKey.includes('password') ||
          lowerKey.includes('authorization')
        ) {
          if (typeof value === 'string') {
            if (lowerKey.includes('password') || lowerKey.includes('secret')) {
              result[key] = '***[REDACTED]***';
            } else {
              result[key] = SensitiveDataRedactor.redactString(value);
              // If regex didn't catch it but field name is sensitive (e.g. key or token), mask it
              if (result[key] === value && value.length > 8) {
                const prefix = value.slice(0, 4);
                const suffix = value.slice(-3);
                result[key] = `${prefix}...[REDACTED]...${suffix}`;
              }
            }
          } else {
            result[key] = '[REDACTED_STRUCTURE]';
          }
        } else {
          result[key] = SensitiveDataRedactor.redactObject(value);
        }
      }
      return result as T;
    }

    return obj;
  }
}
