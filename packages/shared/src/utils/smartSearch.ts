import type { Destinasi } from '../types/wisata.types';

export interface SmartSearchResult {
  items: Destinasi[];
  usedFuzzy: boolean;
  suggestedTerm: string | null;
}

/**
 * Normalizes camelCase, PascalCase, UPPERCASE, lowercase, and punctuation
 * into lowercase space-separated words (e.g. "candiBorobudur" -> "candi borobudur").
 */
export function normalizeSearchText(raw: string): string {
  return raw
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Memory-efficient Levenshtein distance using two 1D rows with early exit.
 */
function boundedLevenshtein(a: string, b: string, maxDist: number): number {
  if (a === b) return 0;
  const lenA = a.length;
  const lenB = b.length;
  if (Math.abs(lenA - lenB) > maxDist) return maxDist + 1;

  let prev = new Array<number>(lenB + 1);
  let curr = new Array<number>(lenB + 1);
  for (let j = 0; j <= lenB; j++) prev[j] = j;

  for (let i = 1; i <= lenA; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    const ca = a.charCodeAt(i - 1);

    for (let j = 1; j <= lenB; j++) {
      const cost = ca === b.charCodeAt(j - 1) ? 0 : 1;
      const val = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      curr[j] = val;
      if (val < rowMin) rowMin = val;
    }

    if (rowMin > maxDist) return maxDist + 1;
    const tmp = prev;
    prev = curr;
    curr = tmp;
  }

  return prev[lenB];
}

/**
 * Matches venues against raw user queries with support for camelCase,
 * uppercase/lowercase, collapsed spaces, and light typo correction.
 */
export function searchVenuesSmart(venues: Destinasi[], rawQuery: string): SmartSearchResult {
  const normalized = normalizeSearchText(rawQuery);
  if (!normalized) {
    return { items: venues, usedFuzzy: false, suggestedTerm: null };
  }

  const tokens = normalized.split(' ');
  const collapsedQuery = normalized.replace(/\s+/g, '');

  const exactMatches = venues.filter((v) => {
    const hay = normalizeSearchText(`${v.nama} ${v.lokasi} ${v.deskripsi}`);
    const collapsedHay = hay.replace(/\s+/g, '');
    if (collapsedHay.includes(collapsedQuery)) return true;
    return tokens.every((t) => hay.includes(t));
  });

  if (exactMatches.length > 0 || collapsedQuery.length < 3) {
    return { items: exactMatches, usedFuzzy: false, suggestedTerm: null };
  }

  const scored: Array<{ venue: Destinasi; score: number }> = [];

  for (const venue of venues) {
    const words = normalizeSearchText(`${venue.nama} ${venue.lokasi}`).split(' ');
    let totalScore = 0;
    let matchedAll = true;

    for (const token of tokens) {
      if (token.length < 2) continue;
      const maxDist = token.length <= 4 ? 1 : 2;
      let bestTokenDist = maxDist + 1;

      for (const word of words) {
        if (word.startsWith(token) || token.startsWith(word)) {
          bestTokenDist = 0;
          break;
        }
        const d = boundedLevenshtein(token, word, maxDist);
        if (d < bestTokenDist) bestTokenDist = d;
        if (bestTokenDist === 0) break;
      }

      if (bestTokenDist > maxDist) {
        matchedAll = false;
        break;
      }
      totalScore += bestTokenDist;
    }

    if (matchedAll) {
      scored.push({ venue, score: totalScore });
    }
  }

  scored.sort((a, b) => a.score - b.score || b.venue.jumlahUlasan - a.venue.jumlahUlasan);

  return {
    items: scored.map((s) => s.venue),
    usedFuzzy: scored.length > 0,
    suggestedTerm: scored[0]?.venue.nama ?? null,
  };
}
