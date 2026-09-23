/** Text normalization for quote verification — pure functions */

export function normalizeForComparison(text: string): string {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'") // curly single quotes
    .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"') // curly double quotes
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212]/g, '-') // dashes
    .replace(/[\u00A0\u2000-\u200B\u202F\u205F\u3000\uFEFF]/g, ' ') // various spaces
    .replace(/[\u00AD\u200B-\u200F]/g, '') // soft hyphens, zero-width
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Map a normalized quote back onto the original clause text for highlighting.
 * Builds a whitespace-tolerant regex from the normalized quote and runs it
 * against the original text, so the returned offsets always point at real
 * characters. Returns null when the mapping cannot be made (quote too short,
 * absent, or containing characters that normalization changed beyond
 * whitespace/case).
 */
export function findQuoteOffsets(clauseText: string, quote: string): { start: number; end: number } | null {
  const normQuote = normalizeForComparison(quote);

  if (normQuote.length < 12) return null;

  const chars = normQuote.split('');
  const pattern = chars
    .map((c, i) => {
      if (c === ' ') return '\\s+';
      const prefix = i === 0 || chars[i - 1] === ' ' ? '' : '\\s*';
      return prefix + escapeRegExp(c);
    })
    .join('');

  const match = new RegExp(pattern, 'i').exec(clauseText);
  if (match === null) return null;

  return { start: match.index, end: match.index + match[0].length };
}