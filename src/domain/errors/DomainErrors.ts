/**
 * Base abstract class for all Domain Errors in TamSpeak.
 * Encapsulates error code, HTTP status mapping, and timestamp.
 */
export abstract class DomainError extends Error {
  public readonly timestamp: Date;

  constructor(
    public override readonly message: string,
    public readonly code: string,
    public readonly statusCode: number = 400
  ) {
    super(message);
    this.name = this.constructor.name;
    this.timestamp = new Date();
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class InvalidBandScoreError extends DomainError {
  constructor(score: number, reason?: string) {
    super(
      reason ?? `Invalid IELTS Band Score: ${score}. Band score must be between 0.0 and 9.0 in increments of 0.5.`,
      'INVALID_BAND_SCORE',
      422
    );
  }
}

export class InvalidSpeechMetricsError extends DomainError {
  constructor(message: string) {
    super(message, 'INVALID_SPEECH_METRICS', 422);
  }
}

export class RateLimitExceededError extends DomainError {
  constructor(provider: string, retryAfterSeconds: number) {
    super(
      `Rate limit exceeded for provider "${provider}". Please retry after ${retryAfterSeconds} seconds.`,
      'RATE_LIMIT_EXCEEDED',
      429
    );
  }
}

export class UnauthorizedAccessError extends DomainError {
  constructor(resource: string) {
    super(
      `Unauthorized access to resource: ${resource}. Permission denied.`,
      'UNAUTHORIZED_ACCESS',
      403
    );
  }
}

export class InvalidRawDataError extends DomainError {
  constructor(details: string) {
    super(
      `Invalid raw data ingestion payload: ${details}`,
      'INVALID_RAW_DATA',
      400
    );
  }
}

export class PromptInjectionDetectedError extends DomainError {
  constructor(pattern: string) {
    super(
      `Potential Prompt Injection attempt intercepted. Prohibited pattern: "${pattern}".`,
      'PROMPT_INJECTION_DETECTED',
      400
    );
  }
}

export class InvalidEmailError extends DomainError {
  constructor(email: string) {
    super(
      `Invalid email address format: "${email}".`,
      'INVALID_EMAIL_ADDRESS',
      422
    );
  }
}

export class EntityNotFoundError extends DomainError {
  constructor(entityName: string, id: string) {
    super(
      `${entityName} with identifier "${id}" was not found.`,
      'ENTITY_NOT_FOUND',
      404
    );
  }
}
