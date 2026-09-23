import { describe, expect, it } from 'vitest';
import { buildNegotiationLocal, clauseRef, type NegotiationInput } from './builder';
import type { Clause, GapRow, InterviewAnswers, MatchRow, RuleHit } from '../types';

const clauses: Clause[] = [
  { id: 'c005', label: '4', heading: null, text: 'Deposit text', page: 1, pageEnd: 1, order: 5 },
  {
    id: 'c009',
    label: null,
    heading: 'VISITORS',
    text: 'Visitors text',
    page: 2,
    pageEnd: 2,
    order: 9,
  },
  { id: 'c001', label: null, heading: null, text: 'Preamble', page: 1, pageEnd: 1, order: 1 },
];

const match = (key: string, patch: Partial<MatchRow> = {}): MatchRow => ({
  key: key as keyof InterviewAnswers,
  agreed: '₹80,000',
  written: 'Rs. 1,20,000',
  verdict: 'differs',
  severity: 'HIGH',
  evidence: { clauseId: 'c005', quote: 'q', status: 'verified' },
  note: 'The deposit is higher than agreed.',
  suggestedQuestion: null,
  ...patch,
});

const gap = (patch: Partial<GapRow> = {}): GapRow => ({
  id: 'DEPOSIT_REFUND_TIMELINE',
  title: 'When the deposit comes back',
  state: 'absent',
  evidence: null,
  whyItMatters: 'The top dispute cause',
  requestWording: 'The deposit shall be refunded within 15 days of handing over vacant possession.',
  ...patch,
});

const rule: RuleHit = {
  ruleId: 'IN-RENT-GUEST-RESTRICTION',
  clauseId: 'c009',
  severity: 'MEDIUM',
  title: 'Limits on guests, visitors or lifestyle',
  message: 'm',
  basis: 'b',
  questions: ['Can the restriction on visitors be removed?'],
  lastReviewed: '2025-01-15',
};

const build = (patch: Partial<NegotiationInput>) =>
  buildNegotiationLocal({
    matches: [],
    gaps: [],
    rules: [],
    clauses,
    selectedRowIds: [],
    tone: 'polite',
    channel: 'whatsapp',
    ...patch,
  });

describe('clauseRef', () => {
  it('names clauses the way the agreement prints them', () => {
    expect(clauseRef(clauses, 'c005')).toBe('Clause 4');
    expect(clauseRef(clauses, 'c009')).toBe('Clause VISITORS');
    expect(clauseRef(clauses, 'c001')).toBeNull();
    expect(clauseRef(clauses, 'c999')).toBeNull();
    expect(clauseRef(clauses, null)).toBeNull();
  });
});

describe('buildNegotiationLocal', () => {
  it('returns an empty message when nothing is selected', () => {
    expect(build({})).toEqual({ message: '', items: [] });
  });

  it('builds polite asks that cite the printed clause number, never an internal id', () => {
    const out = build({ matches: [match('deposit')], selectedRowIds: ['match-deposit'] });
    expect(out.items[0]!.ask).toContain('(Clause 4)');
    expect(out.message).not.toContain('c005');
    expect(out.message.startsWith('Hi,\nThank you for sharing the agreement.')).toBe(true);
    expect(out.items[0]!.suggestedWording).toContain('refundable within 15 days');
  });

  it('covers mismatches, not-covered promises, missing protections and rule findings', () => {
    const out = build({
      matches: [
        match('deposit'),
        match('extras', {
          verdict: 'not_covered',
          agreed: 'Parking included',
          written: null,
          evidence: null,
        }),
        match('city', { verdict: 'matches' }),
      ],
      gaps: [gap(), gap({ id: 'ENTRY_NOTICE', state: 'present' })],
      rules: [rule],
      selectedRowIds: [
        'match-deposit',
        'match-extras',
        'match-city',
        'gap-DEPOSIT_REFUND_TIMELINE',
        'gap-ENTRY_NOTICE',
        'rule-IN-RENT-GUEST-RESTRICTION',
        'rule-UNKNOWN',
        'match-nope',
        'gap-NOPE',
        'weird',
      ],
    });
    expect(out.items.map(i => i.rowId)).toEqual([
      'match-deposit',
      'match-extras',
      'gap-DEPOSIT_REFUND_TIMELINE',
      'rule-IN-RENT-GUEST-RESTRICTION',
    ]);
    expect(out.items[1]!.ask).toContain("doesn't mention it");
    expect(out.items[3]!.ask).toContain('(Clause VISITORS)');
    expect(out.items[3]!.suggestedWording).toContain('visitors');
    expect(out.message.split('\n').filter(l => /^\d\. /.test(l))).toHaveLength(4);
  });

  it('frames a better-than-promised term as a confirmation', () => {
    const out = build({
      matches: [
        match('noticePeriod', { severity: 'INFO', agreed: '2 months', written: '1 month' }),
      ],
      selectedRowIds: ['match-noticePeriod'],
    });
    expect(out.items[0]!.ask).toContain('better than');
  });

  it('writes direct asks and an email layout when asked', () => {
    const out = build({
      matches: [
        match('deposit'),
        match('lockIn', { severity: 'INFO', agreed: 'no' }),
        match('increase', { verdict: 'not_covered', agreed: '10%', written: null }),
      ],
      gaps: [gap({ requestWording: null })],
      rules: [{ ...rule, ruleId: 'IN-RENT-OTHER', clauseId: null, questions: [] }],
      selectedRowIds: [
        'match-deposit',
        'match-lockIn',
        'match-increase',
        'gap-DEPOSIT_REFUND_TIMELINE',
        'rule-IN-RENT-OTHER',
      ],
      tone: 'direct',
      channel: 'email',
    });
    expect(out.items[0]!.ask).toContain('Please correct.');
    expect(out.items[1]!.ask).toContain('Confirming.');
    expect(out.items[2]!.ask).toContain('Please add it.');
    expect(out.items[3]!.ask).toBe('Missing: When the deposit comes back. Please add.');
    expect(out.items[3]!.suggestedWording).toBe('Please add a clause covering this.');
    expect(out.items[4]!.ask).toContain('Could we discuss this?');
    expect(out.items[4]!.suggestedWording).toBe('Please add a clause covering this.');
    expect(out.message.startsWith('Dear [Owner/Broker],\n\n')).toBe(true);
    expect(out.message.endsWith('Regards,\n[Your Name]')).toBe(true);
  });

  it('ends a polite email warmly', () => {
    const out = build({
      gaps: [gap()],
      selectedRowIds: ['gap-DEPOSIT_REFUND_TIMELINE'],
      channel: 'email',
    });
    expect(out.message).toContain('Best regards');
  });

  it('writes sensible wording for every interview topic', () => {
    const keys = [
      ['monthlyRent', '₹40k', 'Monthly rent: ₹40,000 (as agreed).'],
      ['monthlyRent', 'lots', 'Monthly rent: lots (as agreed).'],
      ['duration', '11 months', 'Term: 11 months (as agreed).'],
      ['lockIn', 'no', 'Lock-in period: none, applicable to both parties.'],
      ['lockIn', '3 months', 'Lock-in period: 3 months, applicable to both parties.'],
      ['noticePeriod', '1 month', 'Notice period: 1 month for both tenant and owner.'],
      ['maintenance', 'owner', 'Society maintenance and property tax: Owner.'],
      ['repairs', 'split', 'Structural and major repairs: Owner.'],
      ['increase', '10%', 'not more than 10% on renewal.'],
      ['increase', 'no', 'Rent shall not be increased during this term.'],
      ['extras', 'Parking', 'As agreed: Parking.'],
      ['unknownKey', 'x', 'As agreed: x.'],
    ] as const;
    for (const [key, agreed, expected] of keys) {
      const out = build({ matches: [match(key, { agreed })], selectedRowIds: [`match-${key}`] });
      expect(out.items[0]!.suggestedWording).toContain(expected);
    }
    const unknown = build({ matches: [match('unknownKey')], selectedRowIds: ['match-unknownKey'] });
    expect(unknown.items[0]!.ask).toContain('unknownKey');
  });
});
