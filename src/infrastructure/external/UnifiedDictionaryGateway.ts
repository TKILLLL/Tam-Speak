import {
  IDictionaryGateway,
  DictionaryEntry,
  CollocationSuggestion,
  GrammarCheckError,
} from '../../domain/interfaces/IDictionaryGateway';
import { FreeDictionaryAdapter } from './FreeDictionaryAdapter';
import { DatamuseAdapter } from './DatamuseAdapter';
import { LanguageToolAdapter } from './LanguageToolAdapter';
import { FreeTranslateAdapter } from './FreeTranslateAdapter';
import { dexieDb } from '../database/dexie/TamSpeakDexieDatabase';
import { IPAPhonetic } from '../../domain/value-objects/IPAPhonetic';

/**
 * UnifiedDictionaryGateway
 * Implements IDictionaryGateway interface from Domain Layer.
 * Combines offline IndexedDB CMUdict (0ms latency), Free Dictionary API,
 * Datamuse Collocations API, LanguageTool Grammar API, and GTX Translate.
 */
export class UnifiedDictionaryGateway implements IDictionaryGateway {
  constructor(
    private readonly freeDictionaryAdapter: FreeDictionaryAdapter = new FreeDictionaryAdapter(),
    private readonly datamuseAdapter: DatamuseAdapter = new DatamuseAdapter(),
    private readonly languageToolAdapter: LanguageToolAdapter = new LanguageToolAdapter(),
    private readonly translateAdapter: FreeTranslateAdapter = new FreeTranslateAdapter()
  ) {}

  /**
   * Looks up a word:
   * 1. Checks Dexie client-side offline dictionary first (0ms, 0 token)
   * 2. If online and needed, enriches with Oxford definitions and audio sample via FreeDictionary API
   */
  public async lookupWord(word: string): Promise<DictionaryEntry | null> {
    const cleaned = word.trim().toLowerCase();
    if (!cleaned) return null;

    // 1. Check offline dictionary in Dexie
    const offlineRecord = await dexieDb.lookupIPA(cleaned);

    // 2. Fetch full definitions from Free Dictionary API
    const onlineResult = await this.freeDictionaryAdapter.fetchWordDetails(cleaned);

    if (onlineResult) {
      // If online result has no IPA but offline has, merge them
      if (!onlineResult.ipa && offlineRecord?.ipa) {
        try {
          return {
            ...onlineResult,
            ipa: IPAPhonetic.create(offlineRecord.ipa),
          };
        } catch {
          return onlineResult;
        }
      }
      return onlineResult;
    }

    // 3. Fallback to offline entry if online request failed or offline
    if (offlineRecord) {
      let ipaVo: IPAPhonetic | null = null;
      try {
        ipaVo = IPAPhonetic.create(offlineRecord.ipa);
      } catch {
        ipaVo = null;
      }

      return {
        word: offlineRecord.word,
        ipa: ipaVo,
        meanings: [
          {
            partOfSpeech: 'word',
            definition: 'Definition stored offline in CMUdict lexicon.',
            synonyms: [],
            antonyms: [],
          },
        ],
      };
    }

    return null;
  }

  public async getCollocations(word: string): Promise<CollocationSuggestion[]> {
    return await this.datamuseAdapter.getCollocations(word);
  }

  public async checkGrammar(text: string): Promise<GrammarCheckError[]> {
    return await this.languageToolAdapter.checkGrammar(text);
  }

  public async translateText(text: string, fromLang = 'en', toLang = 'vi'): Promise<string> {
    return await this.translateAdapter.translateText(text, fromLang, toLang);
  }
}
