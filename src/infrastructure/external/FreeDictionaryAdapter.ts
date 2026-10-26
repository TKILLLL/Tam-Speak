import { DictionaryEntry } from '../../domain/interfaces/IDictionaryGateway';
import { IPAPhonetic } from '../../domain/value-objects/IPAPhonetic';

interface RawDictionaryResponseEntry {
  word: string;
  phonetic?: string;
  phonetics?: Array<{
    text?: string;
    audio?: string;
  }>;
  meanings: Array<{
    partOfSpeech: string;
    definitions: Array<{
      definition: string;
      example?: string;
      synonyms: string[];
      antonyms: string[];
    }>;
    synonyms: string[];
    antonyms: string[];
  }>;
}

/**
 * FreeDictionaryAdapter
 * Communicates with https://api.dictionaryapi.dev (0-Token, Free API)
 * to retrieve full Oxford-based definitions, IPA phonetics, and native speaker audio samples.
 */
export class FreeDictionaryAdapter {
  private static readonly BASE_URL = 'https://api.dictionaryapi.dev/api/v2/entries/en';

  public async fetchWordDetails(word: string): Promise<DictionaryEntry | null> {
    const cleanedWord = word.trim().toLowerCase();
    if (!cleanedWord) return null;

    const url = `${FreeDictionaryAdapter.BASE_URL}/${encodeURIComponent(cleanedWord)}`;

    try {
      const response = await fetch(url);
      if (response.status === 404) {
        return null;
      }
      if (!response.ok) {
        throw new Error(`Free Dictionary API returned status ${response.status}`);
      }

      const json = (await response.json()) as RawDictionaryResponseEntry[];
      if (!Array.isArray(json) || json.length === 0) {
        return null;
      }

      const entry = json[0]!;

      // Find first valid IPA string
      let ipaString = entry.phonetic;
      let audioUrl: string | undefined;

      if (entry.phonetics && entry.phonetics.length > 0) {
        for (const p of entry.phonetics) {
          if (!ipaString && p.text) {
            ipaString = p.text;
          }
          if (!audioUrl && p.audio && p.audio.trim().length > 0) {
            audioUrl = p.audio;
          }
        }
      }

      let ipaVo: IPAPhonetic | null = null;
      if (ipaString) {
        try {
          ipaVo = IPAPhonetic.create(ipaString);
        } catch {
          // If raw IPA contains unsupported characters, gracefully handle without breaking
          ipaVo = null;
        }
      }

      const meanings = entry.meanings.map((m) => {
        const firstDef = m.definitions[0];
        const allSynonyms = Array.from(
          new Set([...(m.synonyms || []), ...(firstDef?.synonyms || [])])
        );
        const allAntonyms = Array.from(
          new Set([...(m.antonyms || []), ...(firstDef?.antonyms || [])])
        );

        return {
          partOfSpeech: m.partOfSpeech,
          definition: firstDef?.definition || 'No definition available.',
          example: firstDef?.example,
          synonyms: allSynonyms,
          antonyms: allAntonyms,
        };
      });

      return {
        word: entry.word,
        ipa: ipaVo,
        audioSampleUrl: audioUrl,
        meanings,
      };
    } catch {
      // In case of network errors or offline state, return null so application remains resilient
      return null;
    }
  }
}
