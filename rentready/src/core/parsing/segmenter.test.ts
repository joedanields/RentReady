import { describe, it, expect } from 'vitest';
import {
  segmentClauses,
  serialiseClauses,
  isClauseStart,
  isAllCapsHeading,
  extractLabel,
} from './segmenter';
import { SAMPLE_PAGES } from '../../sample/sampleData';

const NL = '\n';

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

  it('ends a clause on the page of its last line, not where the next clause starts', () => {
    const page1 = [
      '1. Rent',
      'The tenant shall pay a monthly rent of forty thousand rupees in advance every month.',
      'This clause carries on for a while so that it is long enough to stand on its own here.',
      'Late payment beyond the tenth day of the month attracts a reasonable late fee.',
    ].join(NL);
    const page2 = [
      'and the late fee shall not exceed five hundred rupees for any single month of delay.',
      'The owner will issue a receipt for every payment made by the tenant under this clause.',
    ].join(NL);
    const page3 = [
      '2. Deposit',
      'The deposit of eighty thousand rupees will be returned within fifteen days of handover.',
      'Deductions are limited to unpaid dues and damage beyond normal wear and tear only.',
    ].join(NL);
    const clauses = segmentClauses('', [page1, page2, page3]);
    const rent = clauses.find(c => c.label === '1');
    const deposit = clauses.find(c => c.label === '2');
    expect(rent).toMatchObject({ page: 1, pageEnd: 2 });
    expect(deposit).toMatchObject({ page: 3, pageEnd: 3 });
  });

  it('keeps pageEnd equal to page for a clause that fits on one page before a gap', () => {
    const page1 = [
      '1. Term',
      'This agreement runs for eleven months from the start date agreed between the parties.',
      'Either side may extend it in writing before expiry on mutually agreed revised terms.',
    ].join(NL);
    const page3 = [
      '2. Notice',
      'Either party shall give one month of written notice before ending this agreement early.',
      'Notice may be given by email or by hand to the address stated at the top of this agreement.',
    ].join(NL);
    const clauses = segmentClauses('', [page1, '', page3]);
    expect(clauses.find(c => c.label === '1')).toMatchObject({ page: 1, pageEnd: 1 });
  });

  it('emits each numbered clause exactly once, with sequential ids', () => {
    const long = (s: string) => `${s} ${'and this clause continues with enough words. '.repeat(6)}`;
    const text = [
      long('1. The tenant pays rent monthly.'),
      long('2. The deposit is two months of rent.'),
      long('3. Either party gives one month of notice.'),
    ].join(NL);
    const clauses = segmentClauses(text);
    expect(clauses.map(c => [c.id, c.label])).toEqual([
      ['c001', '1'],
      ['c002', '2'],
      ['c003', '3'],
    ]);
    expect(new Set(clauses.map(c => c.text)).size).toBe(clauses.length);
  });

  it('segments the sample agreement into one clause per heading, no duplicates', () => {
    const clauses = segmentClauses(SAMPLE_PAGES.join(NL), SAMPLE_PAGES);
    expect(clauses.map(c => c.label ?? c.heading)).toEqual([
      'LEAVE AND LICENCE AGREEMENT',
      ...Array.from({ length: 12 }, (_, i) => String(i + 1)),
      'DISPUTE RESOLUTION',
    ]);
    expect(clauses.map(c => c.id)).toEqual(
      clauses.map((_, i) => `c${String(i + 1).padStart(3, '0')}`)
    );
    expect(new Set(clauses.map(c => c.text)).size).toBe(clauses.length);
    const rent = clauses.find(c => c.label === '4')!;
    expect(rent).toMatchObject({ page: 1, pageEnd: 1 });
    expect(clauses.find(c => c.label === '5')).toMatchObject({ page: 2, pageEnd: 2 });
  });

  it('recognises ALL-CAPS headings longer than eight characters', () => {
    expect(isClauseStart('DISPUTE RESOLUTION')).toBe(true);
    expect(isClauseStart('LEAVE AND LICENCE AGREEMENT')).toBe(true);
    expect(isAllCapsHeading('TERMS & CONDITIONS')).toBe(true);
    expect(isAllCapsHeading('A')).toBe(false);
    expect(isAllCapsHeading('Mixed Case Heading')).toBe(false);
  });

  it('does not start a clause at a wrapped line that begins with a number', () => {
    expect(isClauseStart('11 months commencing from the date of possession')).toBe(false);
    expect(isClauseStart('2025 by and between the parties')).toBe(false);
    expect(isClauseStart('5 SECURITY DEPOSIT')).toBe(true);
    expect(isClauseStart('4.2 Deposit refund')).toBe(true);
    const text = [
      '2. Term',
      'The licence shall be for a period of',
      '11 months commencing from the date of handing over possession of the premises.',
    ].join(NL);
    const clauses = segmentClauses(text);
    expect(clauses).toHaveLength(1);
    expect(clauses[0]!.text).toContain('11 months commencing');
  });

  it('merges short unnumbered paragraphs until they are long enough', () => {
    const para = 'This unnumbered paragraph describes the arrangement between the two parties. ';
    const text = [para, '', para, '', para, '', para].join(NL);
    const clauses = segmentClauses(text);
    expect(clauses).toHaveLength(2);
    expect(clauses[0]!.text.length).toBeGreaterThanOrEqual(200);
  });

  it('keeps blank lines inside a numbered clause', () => {
    const text = [
      '1. Rent',
      '',
      'The monthly rent is forty thousand rupees, payable in advance.',
    ].join(NL);
    const clauses = segmentClauses(text);
    expect(clauses).toHaveLength(1);
    expect(clauses[0]!.label).toBe('1');
  });

  it('carries a bare heading onto the clause below it', () => {
    const text = [
      'TERMS AND CONDITIONS',
      '1. The monthly rent is forty thousand rupees, payable in advance.',
      'CLOSING',
    ].join(NL);
    const clauses = segmentClauses('', [text]);
    expect(clauses).toHaveLength(1);
    expect(clauses[0]).toMatchObject({ label: '1', heading: 'TERMS AND CONDITIONS', page: 1 });
    expect(clauses[0]!.text.startsWith('TERMS AND CONDITIONS')).toBe(true);
  });

  it('keeps a trailing heading long enough to stand alone', () => {
    const clauses = segmentClauses(
      ['1. The rent is forty thousand rupees a month.', 'SIGNED BY BOTH PARTIES TODAY'].join(NL)
    );
    expect(clauses.map(c => c.heading)).toEqual([null, 'SIGNED BY BOTH PARTIES TODAY']);
  });

  it('keeps a schedule separate from the clause before it', () => {
    const text = [
      '12. Property tax is paid by the owner every year without fail.',
      'Schedule A',
      'Inventory: two fans, one bed, one wardrobe, geyser in the bathroom.',
    ].join(NL);
    const clauses = segmentClauses(text);
    expect(clauses).toHaveLength(2);
    expect(clauses[1]!.text).toContain('Inventory');
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
