import { RateLimitExceededError } from '../../domain/errors/DomainErrors';

export interface RateLimiterOptions {
  capacity: number; // Max burst tokens
  refillRatePerSecond: number; // Tokens refilled per second
  dailyTokenQuota: number; // Max AI tokens consumed per day
}

interface UserBucket {
  tokens: number;
  lastRefillTime: number;
  dailyTokensUsed: number;
  lastResetDay: string; // YYYY-MM-DD
  recentClicks: number[]; // Timestamps of rapid click interactions
}

/**
 * TokenBucketRateLimiter
 * Protects against endpoint saturation, runaway costs on Shared Key Pools,
 * and rapid-fire microphone button spam.
 */
export class TokenBucketRateLimiter {
  private readonly buckets: Map<string, UserBucket> = new Map();

  constructor(
    private readonly defaultOptions: RateLimiterOptions = {
      capacity: 20, // 20 requests burst max
      refillRatePerSecond: 0.33, // 1 token every ~3 seconds (approx 20 RPM sustained)
      dailyTokenQuota: 100_000, // 100k tokens/day for shared pool users
    }
  ) {}

  private getTodayString(): string {
    return new Date().toISOString().split('T')[0]!;
  }

  private getOrCreateBucket(userId: string): UserBucket {
    let bucket = this.buckets.get(userId);
    const today = this.getTodayString();

    if (!bucket) {
      bucket = {
        tokens: this.defaultOptions.capacity,
        lastRefillTime: Date.now(),
        dailyTokensUsed: 0,
        lastResetDay: today,
        recentClicks: [],
      };
      this.buckets.set(userId, bucket);
    } else if (bucket.lastResetDay !== today) {
      // New day: reset daily quota
      bucket.dailyTokensUsed = 0;
      bucket.lastResetDay = today;
    }

    // Refill tokens based on elapsed time
    const now = Date.now();
    const elapsedSeconds = (now - bucket.lastRefillTime) / 1000;
    const tokensToAdd = elapsedSeconds * this.defaultOptions.refillRatePerSecond;

    bucket.tokens = Math.min(this.defaultOptions.capacity, bucket.tokens + tokensToAdd);
    bucket.lastRefillTime = now;

    return bucket;
  }

  /**
   * Checks if user has exceeded rate limit. Consumes 1 request token if available.
   * Throws RateLimitExceededError if rate limit is exceeded.
   */
  public checkAndConsumeRequest(userId: string): void {
    const bucket = this.getOrCreateBucket(userId);

    // 1. Detect rapid-fire click spam (e.g. > 5 clicks in 3 seconds)
    const now = Date.now();
    bucket.recentClicks = bucket.recentClicks.filter((t) => now - t < 3000);
    bucket.recentClicks.push(now);

    if (bucket.recentClicks.length > 5) {
      throw new RateLimitExceededError(
        'TamSpeak Anti-Spam',
        5
      );
    }

    // 2. Token Bucket check
    if (bucket.tokens < 1.0) {
      const waitSeconds = Math.ceil((1.0 - bucket.tokens) / this.defaultOptions.refillRatePerSecond);
      throw new RateLimitExceededError('AI Request Pipeline', waitSeconds);
    }

    bucket.tokens -= 1.0;
  }

  /**
   * Tracks token expenditure against daily quota limit for Shared Key Pools.
   */
  public recordTokenUsage(userId: string, tokensConsumed: number): void {
    const bucket = this.getOrCreateBucket(userId);
    bucket.dailyTokensUsed += tokensConsumed;

    if (bucket.dailyTokensUsed >= this.defaultOptions.dailyTokenQuota) {
      throw new RateLimitExceededError(
        'Daily AI Quota Exceeded',
        86400 // Retry next day
      );
    }
  }

  public getRemainingDailyTokens(userId: string): number {
    const bucket = this.getOrCreateBucket(userId);
    return Math.max(0, this.defaultOptions.dailyTokenQuota - bucket.dailyTokensUsed);
  }
}
