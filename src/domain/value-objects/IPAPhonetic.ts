import { DomainError } from '../errors/DomainErrors';

export class InvalidIPAPhoneticError extends DomainError {
  constructor(message: string) {
    super(message, 'INVALID_IPA_PHONETIC', 422);
  }
}

/**
 * Immutable Value Object representing an International Phonetic Alphabet (IPA) transcription.
 * Enables zero-token, client-side phonemic analysis and Levenshtein distance alignment.
 */
export class IPAPhonetic {
  private readonly rawIPA: string;
  private readonly cleanedIPA: string;
  private readonly syllables: readonly string[];

  private constructor(raw: string, cleaned: string, syllables: string[]) {
    this.rawIPA = raw;
    this.cleanedIPA = cleaned;
    this.syllables = Object.freeze([...syllables]);
    Object.freeze(this);
  }

  /**
   * Factory method to create and validate an IPAPhonetic object.
   */
  public static create(rawIPA: string): IPAPhonetic {
    if (!rawIPA || typeof rawIPA !== 'string' || rawIPA.trim().length === 0) {
      throw new InvalidIPAPhoneticError('IPA phonetic transcription cannot be empty.');
    }

    const trimmed = rawIPA.trim();

    // Strip out enclosing phonetic slashes /.../ or square brackets [...]
    const cleaned = trimmed.replace(/^[/\[]|[/\]]$/g, '').trim();

    if (cleaned.length === 0) {
      throw new InvalidIPAPhoneticError(`Invalid IPA transcription: "${rawIPA}" contains no symbols.`);
    }

    // Split syllables by dot or hyphen or stress markers
    const syllableTokens = cleaned
      .replace(/[ˈˌ]/g, '.$&')
      .split('.')
      .filter((s) => s.length > 0);

    const syllables = syllableTokens.length > 0 ? syllableTokens : [cleaned];

    return new IPAPhonetic(trimmed, cleaned, syllables);
  }

  public getRawIPA(): string {
    return this.rawIPA;
  }

  public getCleanedIPA(): string {
    return this.cleanedIPA;
  }

  public getSyllables(): readonly string[] {
    return this.syllables;
  }

  public getSyllableCount(): number {
    return this.syllables.length;
  }

  /**
   * Detects the syllable index containing the primary stress mark (ˈ).
   * Returns -1 if no explicit stress mark is annotated.
   */
  public getPrimaryStressSyllableIndex(): number {
    return this.syllables.findIndex((s) => s.includes('ˈ'));
  }

  /**
   * Compares two IPA phonetics using pure string Levenshtein distance on the client.
   * Zero token cost. Returns normalized similarity score between 0.0 (completely divergent) and 1.0 (exact match).
   */
  public calculateSimilarity(other: IPAPhonetic): number {
    const s1 = this.cleanedIPA.replace(/[ˈˌ. ]/g, '');
    const s2 = other.cleanedIPA.replace(/[ˈˌ. ]/g, '');

    if (s1 === s2) return 1.0;
    if (s1.length === 0 || s2.length === 0) return 0.0;

    const distance = IPAPhonetic.levenshtein(s1, s2);
    const maxLength = Math.max(s1.length, s2.length);

    return Math.max(0.0, 1.0 - distance / maxLength);
  }

  private static levenshtein(a: string, b: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }

    return matrix[b.length][a.length];
  }

  public toEnclosedString(): string {
    return `/${this.cleanedIPA}/`;
  }

  public equals(other: IPAPhonetic): boolean {
    return this.cleanedIPA === other.cleanedIPA;
  }
}
