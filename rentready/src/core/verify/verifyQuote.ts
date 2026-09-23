/** Quote verification — pure functions, 100% test coverage */

import type { VerifiedQuote } from '../types.js';
import { normalizeForComparison, findQuoteOffsets } from './normalize.js';

/**
 * Verify a quote against a clause text.
 * Returns the quote with verification status and character offsets for highlighting.
 */
export function verifyQuote(clauseText: string, quote: string, clauseId: string): VerifiedQuote {
  if (!quote || quote.length < 12) {
    return { clauseId, quote, status: 'unverified' };
  }

  const normClause = normalizeForComparison(clauseText);
  const normQuote = normalizeForComparison(quote);

  // Exact match after normalization. Offsets are approximate and may be
  // unmappable when the quote contains characters normalization rewrites
  // (e.g. curly quotes) — verified still holds without them.
  if (normClause.includes(normQuote)) {
    const offsets = findQuoteOffsets(clauseText, quote);
    return offsets
      ? { clauseId, quote, status: 'verified', start: offsets.start, end: offsets.end }
      : { clauseId, quote, status: 'verified' };
  }

  // Fuzzy match: sliding window token similarity >= 0.9
  const clauseTokens = normClause.split(/\s+/).filter(Boolean);
  const quoteTokens = normQuote.split(/\s+/).filter(Boolean);

  let bestSimilarity = 0;
  const windowSize = quoteTokens.length;

  for (let i = 0; i <= clauseTokens.length - windowSize; i++) {
    const window = clauseTokens.slice(i, i + windowSize);
    const similarity = jaccardSimilarity(new Set(window), new Set(quoteTokens));
    bestSimilarity = Math.max(bestSimilarity, similarity);
  }

  if (bestSimilarity >= 0.9) {
    return { clauseId, quote, status: 'fuzzy' };
  }

  return { clauseId, quote, status: 'unverified' };
}

function jaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return intersection.size / union.size;
}

/** Verify multiple quotes at once */
export function verifyQuotes(
  clauses: Map<string, string>,
  quotes: Array<{ clauseId: string; quote: string }>
): VerifiedQuote[] {
  return quotes.map(({ clauseId, quote }) => {
    const clauseText = clauses.get(clauseId) ?? '';
    return verifyQuote(clauseText, quote, clauseId);
  });
}