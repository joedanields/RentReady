import { describe, it, expect } from 'vitest';
import { verifyQuote, verifyQuotes } from './verifyQuote';
import { normalizeForComparison, findQuoteOffsets } from './normalize';

describe('normalizeForComparison', () => {
  it('normalises case, spaces, quotes, dashes, NBSP and soft hyphens', () => {
    const input =
      'The Owner \u201Cmay\u201D enter after 24\u00A0hours\u2019 written\u00AD notice,\u200B in writing.';
    expect(normalizeForComparison(input)).toBe(
      "the owner \"may\" enter after 24 hours' written notice, in writing."
    );
  });
});

describe('findQuoteOffsets', () => {
  it('returns null for short quotes', () => {
    expect(findQuoteOffsets('a long clause text to search within', 'short')).toBeNull();
  });

  it('returns null when not found', () => {
    expect(
      findQuoteOffsets('this is a reasonably long clause sentence of text', 'totally different phrase')
    ).toBeNull();
  });

  it('finds offsets in the original text', () => {
    const clause = 'The tenant shall pay the rent on the first day of each month in advance.';
    const out = findQuoteOffsets(clause, 'pay the rent on the first day');
    expect(out).not.toBeNull();
    expect(clause.slice(out!.start, out!.end)).toContain('pay the rent on the first day');
  });
});

describe('verifyQuote', () => {
  it('returns unverified for quotes shorter than 12 chars', () => {
    expect(verifyQuote('actor playing', 'short', 'c001')).toEqual({
      clauseId: 'c001',
      quote: 'short',
      status: 'unverified'
    });
  });

  it('returns verified with offsets for an exact match', () => {
    const clause = 'The security deposit of Rs. 50,000 shall be refunded on vacating the premises.';
    const quote = 'The security deposit of Rs. 50,000';
    const out = verifyQuote(clause, quote, 'c002');
    expect(out.status).toBe('verified');
    expect(out.start).toBeGreaterThanOrEqual(0);
    expect(out.end).toBeGreaterThan(out.start!);
    expect(clause.slice(out.start, out.end)).toBe('The security deposit of Rs. 50,000');
  });

  it('returns verified ignoring formatting differences', () => {
    const clause = `Clause 5. The  Tenant   shall\ngive 15 days notice
before leaving the flat without exception.`;
    const quote = 'The Tenant shall give 15 days notice before leaving the flat without exception';
    expect(verifyQuote(clause, quote, 'c003').status).toBe('verified');
  });

  it('returns fuzzy for one word swapped in a >=19 distinct-token window', () => {
    const clause = 'landlord shall credit full original security deposit payment upon vacating flat after final inspection conducted jointly by both parties';
    const quote = 'landlord shall return full original security deposit payment upon vacating flat after final inspection conducted jointly by both parties';
    expect(verifyQuote(clause, quote, 'c004').status).toBe('fuzzy');
  });

  it('returns unverified when the quote is from another clause', () => {
    const clause = 'The agreement is for eleven months commencing on the first of April.';
    const quote = 'The security deposit shall be returned within fifteen days of vacating the premises.';
    expect(verifyQuote(clause, quote, 'c005').status).toBe('unverified');
  });

  it('returns verified without offsets when normalized match cannot map (curly quotes)', () => {
    const clause = 'Rent covers \u201Call utilities\u201D including electricity and water supply bills.';
    const quote = '"all utilities" including';
    const out = verifyQuote(clause, quote, 'c006');
    expect(out.status).toBe('verified');
    expect(out.start).toBeUndefined();
    expect(out.end).toBeUndefined();
  });

  it('handles Devanagari text', () => {
    const clause = 'जमा राशि खाली करने पर पंद्रह दिनों के भीतर लौटा दी जाएगी।';
    const quote = 'जमा राशि खाली करने पर पंद्रह दिनों के भीतर लौटा दी जाएगी';
    expect(verifyQuote(clause, quote, 'c007').status).toBe('verified');
  });
});

describe('verifyQuotes', () => {
  it('verifies a batch against a clause map, missing clauses yield unverified', () => {
    const clauses = new Map([['c001', 'The rent is forty thousand rupees per calendar month payable in advance.']]);
    const out = verifyQuotes(clauses, [
      { clauseId: 'c001', quote: 'The rent is forty thousand rupees' },
      { clauseId: 'c999', quote: 'The rent is forty thousand rupees' }
    ]);
    expect(out[0]!.status).toBe('verified');
    expect(out[1]!.status).toBe('unverified');
  });
});