export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerConfig {
  failureThreshold: number; // consecutive failures to trip
  recoveryTimeoutMs: number; // time to wait before trying HALF_OPEN
  halfOpenSuccessThreshold: number; // consecutive successes in HALF_OPEN to return to CLOSED
}

/**
 * CircuitBreaker Pattern Implementation
 * Prevents cascading failures and redundant calls to failing or overloaded AI provider endpoints.
 */
export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private consecutiveFailures = 0;
  private consecutiveSuccesses = 0;
  private lastFailureTime = 0;

  constructor(
    public readonly name: string,
    private readonly config: CircuitBreakerConfig = {
      failureThreshold: 3,
      recoveryTimeoutMs: 30_000,
      halfOpenSuccessThreshold: 2,
    }
  ) {}

  public getState(): CircuitState {
    this.updateState();
    return this.state;
  }

  public isAvailable(): boolean {
    this.updateState();
    return this.state !== 'OPEN';
  }

  public recordSuccess(): void {
    if (this.state === 'HALF_OPEN') {
      this.consecutiveSuccesses += 1;
      if (this.consecutiveSuccesses >= this.config.halfOpenSuccessThreshold) {
        this.reset();
      }
    } else if (this.state === 'CLOSED') {
      this.consecutiveFailures = 0;
    }
  }

  public recordFailure(): void {
    this.consecutiveFailures += 1;
    this.lastFailureTime = Date.now();

    if (this.state === 'HALF_OPEN' || this.consecutiveFailures >= this.config.failureThreshold) {
      this.state = 'OPEN';
      this.consecutiveSuccesses = 0;
    }
  }

  public reset(): void {
    this.state = 'CLOSED';
    this.consecutiveFailures = 0;
    this.consecutiveSuccesses = 0;
    this.lastFailureTime = 0;
  }

  private updateState(): void {
    if (this.state === 'OPEN') {
      const elapsed = Date.now() - this.lastFailureTime;
      if (elapsed >= this.config.recoveryTimeoutMs) {
        this.state = 'HALF_OPEN';
        this.consecutiveSuccesses = 0;
      }
    }
  }
}
