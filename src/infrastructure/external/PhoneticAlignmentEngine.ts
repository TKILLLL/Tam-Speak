import { IPAPhonetic } from '../../domain/value-objects/IPAPhonetic';

export type PhoneticErrorType =
  | 'missing_ending_sound'
  | 'wrong_vowel'
  | 'incorrect_stress'
  | 'omission'
  | 'substitution';

export interface PhoneticAlignmentResult {
  expectedIPA: string;
  spokenIPA: string;
  accuracyScore: number; // 0.0 to 1.0
  isCorrect: boolean;
  errorType?: PhoneticErrorType;
  detailedAnalysis: string;
}

/**
 * PhoneticAlignmentEngine
 * Zero-Token, client-side phonemic alignment and error categorization.
 * Detects pronunciation issues common to English learners (Vietnamese, Asian, and Romance L1 speakers):
 * - Dropped ending sounds (/s/, /z/, /t/, /d/, /k/, /g/, /θ/, /ð/)
 * - Vowel shifts (/iː/ vs /ɪ/, /æ/ vs /e/)
 * - Stress placement errors (e.g. first vs second syllable stress)
 */
export class PhoneticAlignmentEngine {
  private static readonly ENDING_CONSONANTS = new Set([
    's', 'z', 't', 'd', 'k', 'g', 'θ', 'ð', 'ʃ', 'ʒ', 'tʃ', 'dʒ', 'p', 'b', 'm', 'n', 'ŋ', 'l', 'r'
  ]);

  private static readonly VOWEL_SYMBOLS = new Set([
    'iː', 'ɪ', 'e', 'æ', 'ɑː', 'ɒ', 'ɔː', 'ʊ', 'uː', 'ʌ', 'ɜː', 'ə', 'eɪ', 'aɪ', 'ɔɪ', 'aʊ', 'əʊ', 'oʊ', 'ɪə', 'eə', 'ʊə'
  ]);

  public static alignPhonetics(
    expectedVo: IPAPhonetic,
    spokenVo: IPAPhonetic
  ): PhoneticAlignmentResult {
    const expectedClean = expectedVo.getCleanedIPA();
    const spokenClean = spokenVo.getCleanedIPA();

    // 1. Check for stress divergence
    const expectedStressIndex = expectedVo.getPrimaryStressSyllableIndex();
    const spokenStressIndex = spokenVo.getPrimaryStressSyllableIndex();
    const isStressDivergent =
      expectedStressIndex !== -1 &&
      spokenStressIndex !== -1 &&
      expectedStressIndex !== spokenStressIndex;

    const rawSimilarity = expectedVo.calculateSimilarity(spokenVo);
    const accuracy = isStressDivergent ? Math.max(0.0, rawSimilarity - 0.25) : rawSimilarity;

    if (isStressDivergent) {
      return {
        expectedIPA: expectedVo.toEnclosedString(),
        spokenIPA: spokenVo.toEnclosedString(),
        accuracyScore: accuracy,
        isCorrect: false,
        errorType: 'incorrect_stress',
        detailedAnalysis: `Stress placed on syllable ${spokenStressIndex + 1} instead of syllable ${expectedStressIndex + 1}.`,
      };
    }

    if (accuracy >= 0.85) {
      return {
        expectedIPA: expectedVo.toEnclosedString(),
        spokenIPA: spokenVo.toEnclosedString(),
        accuracyScore: accuracy,
        isCorrect: true,
        detailedAnalysis: 'Accurate pronunciation matching native phonetic model.',
      };
    }

    // 1. Check for missing ending sound (very common in ESL speakers)
    const lastExpectedChar = expectedClean.slice(-1);
    const lastSpokenChar = spokenClean.slice(-1);

    if (
      PhoneticAlignmentEngine.ENDING_CONSONANTS.has(lastExpectedChar) &&
      lastExpectedChar !== lastSpokenChar &&
      !spokenClean.endsWith(lastExpectedChar)
    ) {
      return {
        expectedIPA: expectedVo.toEnclosedString(),
        spokenIPA: spokenVo.toEnclosedString(),
        accuracyScore: accuracy,
        isCorrect: false,
        errorType: 'missing_ending_sound',
        detailedAnalysis: `Missing final consonant sound /${lastExpectedChar}/. Make sure to release the ending sound clearly.`,
      };
    }

    // 2. Check for vowel distortion
    const expectedVowels = this.extractVowels(expectedClean);
    const spokenVowels = this.extractVowels(spokenClean);

    if (expectedVowels.length === spokenVowels.length && expectedVowels.some((v, i) => v !== spokenVowels[i])) {
      return {
        expectedIPA: expectedVo.toEnclosedString(),
        spokenIPA: spokenVo.toEnclosedString(),
        accuracyScore: accuracy,
        isCorrect: false,
        errorType: 'wrong_vowel',
        detailedAnalysis: `Vowel sound divergence. Expected /${expectedVowels.join(', ')}/ but detected /${spokenVowels.join(', ')}/.`,
      };
    }

    return {
      expectedIPA: expectedVo.toEnclosedString(),
      spokenIPA: spokenVo.toEnclosedString(),
      accuracyScore: accuracy,
      isCorrect: false,
      errorType: 'substitution',
      detailedAnalysis: 'Phonetic mismatch detected. Re-listen to native audio model and match mouth posture.',
    };
  }

  private static extractVowels(ipa: string): string[] {
    const vowels: string[] = [];
    let i = 0;
    while (i < ipa.length) {
      // Check 2-character vowels first
      const twoChar = ipa.slice(i, i + 2);
      if (PhoneticAlignmentEngine.VOWEL_SYMBOLS.has(twoChar)) {
        vowels.push(twoChar);
        i += 2;
        continue;
      }
      // Check 1-character vowel
      const oneChar = ipa.slice(i, i + 1);
      if (PhoneticAlignmentEngine.VOWEL_SYMBOLS.has(oneChar)) {
        vowels.push(oneChar);
        i += 1;
        continue;
      }
      i++;
    }
    return vowels;
  }
}
