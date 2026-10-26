import { IPAPhonetic } from '../value-objects/IPAPhonetic';

export interface DictionaryEntry {
  word: string;
  ipa: IPAPhonetic | null;
  audioSampleUrl?: string;
  meanings: Array<{
    partOfSpeech: string;
    definition: string;
    example?: string;
    synonyms: string[];
    antonyms: string[];
  }>;
}

export interface CollocationSuggestion {
  phrase: string;
  score: number;
}

export interface GrammarCheckError {
  message: string;
  offset: number;
  length: number;
  replacements: string[];
  ruleId: string;
}

export interface IDictionaryGateway {
  /**
   * Fetches full word definitions, IPA transcription, and audio samples (0-token, free API).
   */
  lookupWord(word: string): Promise<DictionaryEntry | null>;

  /**
   * Queries Datamuse API for contextual collocations and phrasal verbs (0-token).
   */
  getCollocations(word: string): Promise<CollocationSuggestion[]>;

  /**
   * Queries LanguageTool API for client-side instant grammar and spelling checks (0-token).
   */
  checkGrammar(text: string): Promise<GrammarCheckError[]>;

  /**
   * Fast translation via free GTX / MyMemory endpoint (0-token).
   */
  translateText(text: string, fromLang: string, toLang: string): Promise<string>;
}
