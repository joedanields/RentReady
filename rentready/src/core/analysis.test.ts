import { describe, it, expect } from 'vitest';
import {
  analyseDocument,
  analyseLocalOnly,
  verifyFindingQuotes,
  demoteGapEvidence,
} from './analysis';
import { LIMITS } from './limits';
import { evidenceKey } from './verify/verifyQuote';
import type { Clause, GapRow } from './types';

const clause = (id: string, text: string): Clause => ({
  id,
  label: null,
  heading: null,
  text,
  page: 1,
  pageEnd: 1,
  order: 1,
});

const CLAUSES = [
  clause(
    'c001',
    'The monthly rent is Rs. 40,000 payable in advance within the first week of each month.'
  ),
  clause(
    'c002',
    'The security deposit of Rs. 80,000 shall be refunded within 15 days of vacating.'
  ),
];

const ANSWERS = {
  city: 'Pune',
  monthlyRent: '40000',
  deposit: '80000',
  duration: '11 months',
  lockIn: 'no',
  noticePeriod: '1 month',
  maintenance: 'owner',
  repairs: 'split',
  increase: '5%',
  extras: [],
};

describe('verifyFindingQuotes', () => {
  it('verifies each quote separately, even two quotes from the same clause', () => {
    const real = 'The monthly rent is Rs. 40,000';
    const fake = 'irrelevant other quote not in the clause';
    const verified = verifyFindingQuotes(CLAUSES, [
      { clauseId: 'c001', quote: real },
      { clauseId: 'c001', quote: fake },
      { clauseId: 'c001', quote: real },
      { clauseId: null, quote: 'ignored' },
      { clauseId: 'c002', quote: null },
    ]);
    expect(verified.get(evidenceKey('c001', real))?.status).toBe('verified');
    expect(verified.get(evidenceKey('c001', fake))?.status).toBe('unverified');
    expect(verified.size).toBe(2);
  });

  it('gives unknown clause ids and over-long quotes no evidence', () => {
    const long = 'x'.repeat(LIMITS.MAX_QUOTE_LENGTH + 1);
    const verified = verifyFindingQuotes(CLAUSES, [
      { clauseId: 'c999', quote: 'some long enough quote text here' },
      { clauseId: 'c001', quote: long },
    ]);
    expect(verified.get(evidenceKey('c999', 'some long enough quote text here'))).toBeNull();
    expect(verified.get(evidenceKey('c001', long))).toBeNull();
  });
});

describe('demoteGapEvidence', () => {
  const base: GapRow = {
    id: 'ENTRY_NOTICE',
    title: 'X',
    whyItMatters: '',
    requestWording: null,
    state: 'present',
    evidence: { clauseId: 'c001', quote: 'hello world hello world', status: 'verified' },
  };

  it('demotes present gaps whose evidence failed to verify, keeps fuzzy', () => {
    const unverified = demoteGapEvidence([
      { ...base, evidence: { ...base.evidence!, status: 'unverified' } },
    ]);
    expect(unverified[0]!.state).toBe('unclear');

    const fuzzy = demoteGapEvidence([
      { ...base, evidence: { ...base.evidence!, status: 'fuzzy' } },
    ]);
    expect(fuzzy[0]!.state).toBe('present');
  });

  it('demotes "present" with no evidence at all — present needs proof', () => {
    expect(demoteGapEvidence([{ ...base, evidence: null }])[0]!.state).toBe('unclear');
  });

  it('keeps verified evidence and absent/unclear states', () => {
    expect(demoteGapEvidence([{ ...base, state: 'present' }])[0]!.state).toBe('present');
    expect(demoteGapEvidence([{ ...base, state: 'absent' }])[0]!.state).toBe('absent');
    expect(demoteGapEvidence([{ ...base, state: 'unclear', evidence: null }])[0]!.state).toBe(
      'unclear'
    );
  });
});

describe('analyseDocument (local only)', () => {
  it('makes no match claims without an AI read, leaves the checklist unchecked, runs rules', () => {
    const result = analyseLocalOnly(ANSWERS, CLAUSES);
    expect(result.mode).toBe('local');
    expect(result.overview).toBe('');
    // Saying "not covered" here would be a claim nobody checked.
    expect(result.matches).toEqual([]);
    expect(result.gaps).toHaveLength(20);
    expect(result.gaps.every(g => g.state === 'unclear')).toBe(true);
    // The refund deadline is written in c002, so the offline text check stays quiet.
    expect(result.rules.map(r => r.ruleId)).not.toContain('IN-RENT-DEPOSIT-NO-TIMELINE');
  });

  it('treats a missing model response as local mode', () => {
    expect(analyseDocument({ answers: ANSWERS, clauses: CLAUSES }).mode).toBe('local');
  });
});

describe('analyseDocument (with model response)', () => {
  const modelResponse = {
    overview: 'Rent matches, deposit unclear.',
    matchFindings: [
      {
        key: 'monthlyRent',
        found: true,
        writtenValue: '₹40,000',
        clauseId: 'c001',
        quote: 'The monthly rent is Rs. 40,000',
        ambiguity: null,
      },
      {
        key: 'deposit',
        found: true,
        writtenValue: '₹1,20,000',
        clauseId: 'c999',
        quote: 'made up quote',
        ambiguity: null,
      },
      {
        key: 'extras',
        found: true,
        writtenValue: 'Parking',
        clauseId: 'c001',
        quote: 'short',
        ambiguity: null,
      },
    ],
    protectionFindings: [
      {
        id: 'DEPOSIT_REFUND_TIMELINE',
        state: 'present',
        summary: 'within 15 days',
        clauseId: 'c002',
        quote: 'refunded within 15 days of vacating',
        ambiguity: null,
      },
    ],
  };

  it('keeps findings for real clauses, discards ghost clause ids, uses overview', () => {
    const result = analyseDocument({ answers: ANSWERS, clauses: CLAUSES, modelResponse });
    expect(result.mode).toBe('ai');
    expect(result.overview).toBe('Rent matches, deposit unclear.');
    const rent = result.matches.find(m => m.key === 'monthlyRent')!;
    expect(rent.verdict).toBe('matches');
    const timeline = result.gaps.find(g => g.id === 'DEPOSIT_REFUND_TIMELINE')!;
    expect(timeline.state).toBe('present');
    expect(timeline.evidence?.status).toBe('verified');
    expect(result.gaps.find(g => g.id === 'ENTRY_NOTICE')!.state).toBe('unclear');
  });

  it('throws ZodError for an invalid model response', () => {
    expect(() =>
      analyseDocument({ answers: ANSWERS, clauses: CLAUSES, modelResponse: { overview: 42 } })
    ).toThrowError();
  });
});
