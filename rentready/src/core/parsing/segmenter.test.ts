import { describe, it, expect } from 'vitest';
import { segmentClauses, serialiseClauses, isClauseStart, extractLabel } from './segmenter';

describe('isClauseStart', () => {
  it('recognises numbered, named, lettered, roman and ALL-CAPS starts', () => {
    expect(isClauseStart('1. Parties')).toBe(true);
    expect(isClauseStart('1.1.1 Termination')).toBe(true);
    expect(isClauseStart('2) Rent')).toBe(true);
    expect(isClauseStart('Clause 5 Security')).toBe(true);
    expect(isClauseStart('Article 12')).toBe(true);
    expect(isClauseStart('(a) Tenant duties')).toBe(true);
    expect(isClauseStart('(i) rent increase')).toBe(true);
    expect(isClauseStart('TERM')).toBe(true);
  });

  it('recognises schedules and annexures', () => {
    expect(isClauseStart('Schedule A Inventory')).toBe(true);
    expect(isClauseStart('Annexure I photograph')).toBe(true);
  });

  it('rejects prose lines, all-caps over 8 words, and empty input', () => {
    expect(isClauseStart('')).toBe(false);
    expect(isClauseStart('The tenant shall pay rent monthly in advance')).toBe(false);
    expect(isClauseStart('THIS IS A VERY LONG ALL CAPS HEADING THAT IS TOO LONG')).toBe(false);
  });
});

describe('extractLabel', () => {
  it('extracts compact labels', () => {
    expect(extractLabel('1. Parties')).toBe('1');
    expect(extractLabel('1.1.1 Termination')).toBe('1.1.1');
    expect(extractLabel('2) Rent')).toBe('2');
    expect(extractLabel('Clause 5 Security')).toBe('5');
    expect(extractLabel('Section 14')).toBe('14');
    expect(extractLabel('(a) Tenant duties')).toBe('a');
    expect(extractLabel('(i) rent increase')).toBe('i');
    expect(extractLabel('RENT')).toBeNull();
  });

  it('returns null for prose', () => {
    expect(extractLabel('The tenant shall pay rent monthly')).toBeNull();
  });
});

describe('segmentClauses', () => {
  it('splits a numbered agreement into clauses with stable ids', () => {
    const text = [
      'RENTAL AGREEMENT',
      '1. Parties',
      'This agreement is between Rahul and Sneha for a flat in Pune.',
      '2. Monthly Rent',
      'The monthly rent is Rs. 40,000 payable in advance.',
      '3. Deposit',
      'The security deposit is Rs. 80,000, refundable on vacating.',
      '',
    ].join('\n');

    const clauses = segmentClauses(text);
    expect(clauses.length).toBeGreaterThanOrEqual(3);
    expect(clauses[0]!.id).toMatch(/^c\d{3}$/);
    expect(clauses.map(c => c.label).filter(Boolean)).toContain('3');
  });

  it('tracks page numbers and pageEnd across pages', () => {
    const page1 = [
      '1. Term',
      'This agreement runs for eleven months commencing today.',
      '2. Rent',
      'Rent continues on page two for the second clause body.',
    ].join('\n');
    const page2 = ['3. Deposit', 'The deposit will be returned within fifteen days.'].join('\n');

    const clauses = segmentClauses('', [page1, page2]);
    const deposit = clauses.find(c => c.label === '3');
    expect(deposit).toBeDefined();
    expect(deposit!.page).toBe(2);
  });

  it('handles short ALL-CAPS headings as clause headings', () => {
    const text = [
      'TERM',
      'Either party may end the agreement by giving one month written notice.',
      'RENT',
      'Possession shall be handed over on the start date.',
    ].join('\n');
    const clauses = segmentClauses(text);
    const headings = clauses.filter(c => c.heading).map(c => c.heading);
    expect(headings.length).toBeGreaterThanOrEqual(1);
    expect(headings).toContain('TERM');
  });

  it('falls back to a single clause for an unnumbered paragraph', () => {
    const text = 'This is a short unnumbered agreement paragraph.'.repeat(3);
    const clauses = segmentClauses(text);
    expect(clauses.length).toBe(1);
  });

  it('returns no clauses for empty input', () => {
    expect(segmentClauses('')).toEqual([]);
    expect(segmentClauses('   \n  ')).toEqual([]);
  });

  it('splits very long clauses at sentence boundaries', () => {
    const longSentence =
      'The tenant shall keep the premises in good condition and shall report repairs promptly. ';
    const text = `Clause 4. ${longSentence.repeat(60)}`;
    const clauses = segmentClauses(text);
    const totalChars = clauses.reduce((n, c) => n + c.text.length, 0);
    expect(clauses.length).toBeGreaterThan(1);
    expect(totalChars).toBeGreaterThan(1000);
    expect(Math.max(...clauses.map(c => c.text.length))).toBeLessThanOrEqual(2300);
  });
});

describe('serialiseClauses', () => {
  it('serialises with delimiters and sanitises angle brackets', () => {
    const clauses = [
      {
        id: 'c001',
        label: '3',
        heading: null,
        text: 'Deposit <careful>',
        page: 1,
        pageEnd: null,
        order: 1,
      },
    ];
    const out = serialiseClauses(clauses);
    expect(out).toContain('[[c001 | label=3 | page=1]]');
    expect(out).not.toContain('<careful>');
  });
});
