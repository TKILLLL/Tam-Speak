/**
 * SpeechNoiseFilter
 * Defensive filtering for accidental microphone triggers, background murmurs,
 * filler grunts (uh/um/ah), and non-meaningful speech fragments.
 */

const JUNK_FILLER_WORDS = new Set([
  'uh',
  'um',
  'er',
  'ah',
  'hmm',
  'hm',
  'huh',
  'eh',
  'oh',
  'ha',
  'a',
  'an',
  'the',
  'to',
  'and',
  'or',
  'so',
  'of',
  'in',
  'at',
  'on',
  'by',
  'is',
  'it',
  // Common Vietnamese accidental murmurs/fillers
  'sao',
  'ê',
  'hả',
  'ơi',
  'ủa',
  'gì',
  'đâu',
  'thế',
  'vậy',
  'nè',
  'nhé',
  'à',
  'ừ',
  'ờ',
  'dạ',
  'ha',
]);

const ALLOWED_SINGLE_WORD_COMMANDS = new Set([
  'yes',
  'no',
  'yeah',
  'yep',
  'nope',
  'sure',
  'okay',
  'ok',
  'correct',
  'ready',
  'start',
  'stop',
  'continue',
  'repeat',
  'help',
  'fine',
  'good',
  'bad',
  'maybe',
  'absolutely',
  'definitely',
  'agree',
  'disagree',
  'never',
  'always',
  'hello',
  'hi',
  'thanks',
  'thank',
]);

export interface SpeechValidationResult {
  isValid: boolean;
  cleanedText: string;
  reason?: string;
}

export class SpeechNoiseFilter {
  /**
   * Evaluates if a recognized transcript represents meaningful, intentional speech
   * or merely accidental background noise / vocal murmur.
   */
  public static validateSpeech(
    rawTranscript: string,
    durationSeconds = 0
  ): SpeechValidationResult {
    const cleaned = rawTranscript.trim();
    if (!cleaned) {
      return { isValid: false, cleanedText: '', reason: 'empty_transcript' };
    }

    // Strip edge punctuation to inspect words
    const stripped = cleaned.toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
    if (!stripped) {
      return { isValid: false, cleanedText: '', reason: 'punctuation_only' };
    }

    // Split words
    const words = stripped.split(/\s+/).filter(Boolean);

    if (words.length === 0) {
      return { isValid: false, cleanedText: '', reason: 'no_words' };
    }

    // Filter 1: Single word inspection
    if (words.length === 1) {
      const singleWord = words[0];
      if (JUNK_FILLER_WORDS.has(singleWord) || singleWord.length < 2) {
        return { isValid: false, cleanedText: cleaned, reason: 'single_filler_noise' };
      }
      if (durationSeconds > 0 && durationSeconds < 0.6 && !ALLOWED_SINGLE_WORD_COMMANDS.has(singleWord)) {
        return { isValid: false, cleanedText: cleaned, reason: 'duration_too_short' };
      }
    }

    // Filter 2: All words in the phrase are junk fillers (e.g. "uh um", "ah hmm", "yeah yeah uh", "ủa sao thế")
    const meaningfulWords = words.filter((w) => !JUNK_FILLER_WORDS.has(w));
    if (words.length <= 4 && meaningfulWords.length === 0) {
      return { isValid: false, cleanedText: cleaned, reason: 'all_filler_words' };
    }

    // Filter 3: Micro utterance with only 1 short meaningful word and very low duration
    if (meaningfulWords.length === 1 && durationSeconds > 0 && durationSeconds < 0.7) {
      const onlyWord = meaningfulWords[0];
      if (!ALLOWED_SINGLE_WORD_COMMANDS.has(onlyWord) && onlyWord.length <= 3) {
        return { isValid: false, cleanedText: cleaned, reason: 'accidental_short_fragment' };
      }
    }

    return { isValid: true, cleanedText: cleaned };
  }

  /**
   * Determines if recognized transcript has enough substance to arm VAD auto-submit.
   * Prevents short static noise or single syllable sounds from starting the silence timer.
   */
  public static hasSubstantialSpeechForVad(rawTranscript: string): boolean {
    const cleaned = rawTranscript.trim();
    if (cleaned.length < 5) return false;
    const words = cleaned.toLowerCase().split(/\s+/).filter(Boolean);
    if (words.length < 2) {
      return words.length === 1 && words[0].length >= 4 && !JUNK_FILLER_WORDS.has(words[0]);
    }
    return true;
  }
}
