import { InvalidSpeechMetricsError } from '../errors/DomainErrors';

export type FluencyRating = 'native_pace' | 'fluent' | 'moderate_hesitation' | 'disjointed';

/**
 * Immutable Value Object encapsulating client-side Web Audio speech fluency metrics.
 * Computed 100% on the client using Web Audio API AnalyserNode without LLM token cost.
 */
export class SpeechMetrics {
  private readonly wpm: number;
  private readonly hesitationCount: number;
  private readonly silenceDurations: readonly number[];
  private readonly totalDurationSeconds: number;

  private constructor(
    wpm: number,
    hesitationCount: number,
    silenceDurations: number[],
    totalDurationSeconds: number
  ) {
    this.wpm = wpm;
    this.hesitationCount = hesitationCount;
    this.silenceDurations = Object.freeze([...silenceDurations]);
    this.totalDurationSeconds = totalDurationSeconds;
    Object.freeze(this);
  }

  /**
   * Factory constructor enforcing domain invariants.
   */
  public static create(params: {
    wpm: number;
    hesitationCount: number;
    silenceDurations: number[];
    totalDurationSeconds: number;
  }): SpeechMetrics {
    const { wpm, hesitationCount, silenceDurations, totalDurationSeconds } = params;

    if (wpm < 0 || wpm > 400) {
      throw new InvalidSpeechMetricsError(
        `WPM (${wpm}) is invalid. Words per minute must be between 0 and 400.`
      );
    }

    if (hesitationCount < 0 || !Number.isInteger(hesitationCount)) {
      throw new InvalidSpeechMetricsError(
        `Hesitation count (${hesitationCount}) must be a non-negative integer.`
      );
    }

    if (totalDurationSeconds < 0) {
      throw new InvalidSpeechMetricsError(
        `Total duration (${totalDurationSeconds}s) cannot be negative.`
      );
    }

    for (const duration of silenceDurations) {
      if (duration < 0.8) {
        throw new InvalidSpeechMetricsError(
          `Silence duration ${duration}s is invalid. Hesitation intervals are defined as pauses >= 0.8s.`
        );
      }
    }

    if (silenceDurations.length !== hesitationCount) {
      throw new InvalidSpeechMetricsError(
        `Hesitation count (${hesitationCount}) does not match silence intervals length (${silenceDurations.length}).`
      );
    }

    return new SpeechMetrics(
      Math.round(wpm * 10) / 10,
      hesitationCount,
      silenceDurations,
      Math.round(totalDurationSeconds * 10) / 10
    );
  }

  public getWpm(): number {
    return this.wpm;
  }

  public getHesitationCount(): number {
    return this.hesitationCount;
  }

  public getSilenceDurations(): readonly number[] {
    return this.silenceDurations;
  }

  public getTotalDurationSeconds(): number {
    return this.totalDurationSeconds;
  }

  /**
   * Returns total cumulative silence duration in seconds for pauses >= 0.8s.
   */
  public getTotalSilenceSeconds(): number {
    return this.silenceDurations.reduce((sum, d) => sum + d, 0);
  }

  /**
   * Evaluates natural speaking pace category.
   * Typical native conversational pace: 120 - 160 WPM.
   */
  public getFluencyRating(): FluencyRating {
    if (this.wpm >= 120 && this.wpm <= 165 && this.hesitationRatePerMinute() <= 2) {
      return 'native_pace';
    }
    if (this.wpm >= 100 && this.hesitationRatePerMinute() <= 4) {
      return 'fluent';
    }
    if (this.wpm >= 70 && this.hesitationRatePerMinute() <= 7) {
      return 'moderate_hesitation';
    }
    return 'disjointed';
  }

  /**
   * Calculates hesitations per minute of speech.
   */
  public hesitationRatePerMinute(): number {
    if (this.totalDurationSeconds <= 0) return 0;
    return (this.hesitationCount / this.totalDurationSeconds) * 60;
  }

  /**
   * Computes a score multiplier (0.0 to 1.0) to modulate fluency scoring based on objective acoustic data.
   */
  public computeAcousticFluencyFactor(): number {
    // Target optimal: 130 WPM with <= 2 hesitations/min
    const optimalWpm = 135;
    const wpmDiff = Math.abs(this.wpm - optimalWpm);
    const paceScore = Math.max(0.3, 1.0 - wpmDiff / 150);

    const hesitationsPerMin = this.hesitationRatePerMinute();
    const pausePenalty = Math.min(0.5, (hesitationsPerMin * 0.08));

    return Math.max(0.1, Math.min(1.0, paceScore - pausePenalty));
  }

  public equals(other: SpeechMetrics): boolean {
    return (
      this.wpm === other.wpm &&
      this.hesitationCount === other.hesitationCount &&
      this.totalDurationSeconds === other.totalDurationSeconds &&
      this.silenceDurations.length === other.silenceDurations.length &&
      this.silenceDurations.every((val, index) => val === other.silenceDurations[index])
    );
  }
}
