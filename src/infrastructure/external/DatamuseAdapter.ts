import { CollocationSuggestion } from '../../domain/interfaces/IDictionaryGateway';

interface DatamuseResultItem {
  word: string;
  score: number;
  tags?: string[];
}

/**
 * DatamuseAdapter
 * Queries the public Datamuse API (0-Token, Free API) to discover:
 * 1. Frequent followers and collocations (e.g., 'heavy' -> 'rain', 'traffic')
 * 2. Frequent preceding adjectives and verbs
 * 3. Topic-specific natural collocations and idioms
 */
export class DatamuseAdapter {
  private static readonly BASE_URL = 'https://api.datamuse.com/words';

  /**
   * Fetches collocations for a word (combining frequent subsequent and preceding words).
   */
  public async getCollocations(word: string): Promise<CollocationSuggestion[]> {
    const cleaned = word.trim().toLowerCase();
    if (!cleaned) return [];

    try {
      // 1. Fetch frequent words that follow this word (e.g., 'make' -> 'decision')
      const followersPromise = fetch(`${DatamuseAdapter.BASE_URL}?rel_bga=${encodeURIComponent(cleaned)}&max=10`);
      // 2. Fetch frequent words that precede this word (e.g., 'decision' -> 'make', 'difficult')
      const predecessorsPromise = fetch(`${DatamuseAdapter.BASE_URL}?rel_bgb=${encodeURIComponent(cleaned)}&max=10`);

      const [resFollowers, resPredecessors] = await Promise.all([followersPromise, predecessorsPromise]);

      const followers = resFollowers.ok ? ((await resFollowers.json()) as DatamuseResultItem[]) : [];
      const predecessors = resPredecessors.ok ? ((await resPredecessors.json()) as DatamuseResultItem[]) : [];

      const suggestions: CollocationSuggestion[] = [];

      for (const item of followers) {
        suggestions.push({
          phrase: `${cleaned} ${item.word}`,
          score: item.score,
        });
      }

      for (const item of predecessors) {
        suggestions.push({
          phrase: `${item.word} ${cleaned}`,
          score: item.score,
        });
      }

      // Sort by frequency score descending and deduplicate
      const seen = new Set<string>();
      return suggestions
        .filter((s) => {
          if (seen.has(s.phrase)) return false;
          seen.add(s.phrase);
          return true;
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 15);
    } catch {
      return [];
    }
  }

  /**
   * Fetches contextually similar words or synonyms (0-Token).
   */
  public async getSynonyms(word: string): Promise<string[]> {
    const cleaned = word.trim().toLowerCase();
    if (!cleaned) return [];

    try {
      const response = await fetch(`${DatamuseAdapter.BASE_URL}?rel_syn=${encodeURIComponent(cleaned)}&max=10`);
      if (!response.ok) return [];

      const results = (await response.json()) as DatamuseResultItem[];
      return results.map((r) => r.word);
    } catch {
      return [];
    }
  }
}
