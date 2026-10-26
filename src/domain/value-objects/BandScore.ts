import { InvalidBandScoreError } from '../errors/DomainErrors';

export type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

/**
 * Immutable Value Object representing an IELTS Band Score.
 * Invariant: Score must be a number between 0.0 and 9.0, exactly divisible by 0.5.
 */
export class BandScore {
  private readonly value: number;

  private constructor(score: number) {
    this.value = score;
    Object.freeze(this);
  }

  /**
   * Factory method with strict validation against IELTS half-band standards.
   */
  public static create(score: number): BandScore {
    if (typeof score !== 'number' || Number.isNaN(score)) {
      throw new InvalidBandScoreError(score, 'Band score must be a valid number.');
    }

    if (score < 0.0 || score > 9.0) {
      throw new InvalidBandScoreError(
        score,
        `Band score ${score} is out of bounds. Must be between 0.0 and 9.0.`
      );
    }

    // Must be divisible by 0.5 (e.g. 0.0, 0.5, 1.0 ... 8.5, 9.0)
    const multiplied = Math.round(score * 10);
    if (multiplied % 5 !== 0) {
      throw new InvalidBandScoreError(
        score,
        `Band score ${score} is invalid. IELTS scores must be in increments of 0.5 (e.g., 6.0, 6.5, 7.0).`
      );
    }

    return new BandScore(score);
  }

  /**
   * Rounds any raw decimal score (e.g., 6.25 -> 6.5, 6.125 -> 6.0) according to standard IELTS rounding rules.
   * Standard IELTS rule:
   * - If average ends in .25, round up to .5
   * - If average ends in .75, round up to next whole band
   * - If average is .125, round down to .0; .375 -> .5; .625 -> .5; .875 -> 1.0
   */
  public static fromRawAverage(rawAverage: number): BandScore {
    if (typeof rawAverage !== 'number' || Number.isNaN(rawAverage)) {
      throw new InvalidBandScoreError(rawAverage, 'Average must be a valid number.');
    }

    const clamped = Math.max(0.0, Math.min(9.0, rawAverage));
    const whole = Math.floor(clamped);
    const fraction = clamped - whole;

    let roundedBand = whole;
    if (fraction < 0.25) {
      roundedBand = whole;
    } else if (fraction < 0.75) {
      roundedBand = whole + 0.5;
    } else {
      roundedBand = whole + 1.0;
    }

    return BandScore.create(Math.min(9.0, roundedBand));
  }

  public getValue(): number {
    return this.value;
  }

  /**
   * Maps IELTS Band Score to Common European Framework of Reference (CEFR).
   */
  public toCEFR(): CEFRLevel {
    if (this.value >= 9.0) return 'C2';
    if (this.value >= 8.0) return 'C1';
    if (this.value >= 6.5) return 'B2';
    if (this.value >= 5.5) return 'B1';
    if (this.value >= 4.0) return 'A2';
    return 'A1';
  }

  public isGreaterThanOrEqual(other: BandScore): boolean {
    return this.value >= other.value;
  }

  public equals(other: BandScore): boolean {
    return this.value === other.value;
  }

  public toString(): string {
    return this.value.toFixed(1);
  }
}
