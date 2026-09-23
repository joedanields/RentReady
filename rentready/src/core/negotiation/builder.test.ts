import { describe, it, expect } from 'vitest';
import { buildNegotiationLocal, type NegotiationInput } from './builder';
import type { GapRow, InterviewAnswers, MatchRow, ProtectionId, Severity } from '../types';

const gap = (id: string, state: GapRow['state'] = 'absent'): GapRow => ({
  id: id as ProtectionId,
  title: 'Deposit refund timeline',
  whyItMatters: 'Without a deadline, the deposit can be withheld indefinitely.',
  requestWording: 'Please add: deposit refunded within 15 days of handover.',
  evidence: null,
  state
});

const m = (key: string, verdict: MatchRow['verdict'], severity: Severity = 'MEDIUM', written = '1 month', agreed = 'Quiet stay only'): MatchRow => ({
  key: key as keyof InterviewAnswers,
  agreed,
  verdict,
  severity,
  note: 'The agreement uses different wording than promised.',
  written,
  evidence: { clauseId: 'c1', quote: 'x'.repeat(20), status: 'verified' },
  suggestedQuestion: null
});

const base = (overrides: Partial<NegotiationInput> = {}): NegotiationInput => ({
  matches: [
    m('noticePeriod', 'differs', 'MEDIUM', '1 month', '1 month'),
    m('duration', 'differs', 'INFO', '2 years', '2 years'),
    m('maintenance', 'not_covered'),
    m('repairs', 'unclear')
  ],
  gaps: [gap('DEPOSIT_REFUND_TIMELINE'), gap('ENTRY_NOTICE', 'unclear'), gap('SUBLET_GUESTS', 'present')],
  selectedRowIds: ['match-noticePeriod', 'match-duration', 'match-maintenance', 'match-repairs', 'gap-DEPOSIT_REFUND_TIMELINE', 'gap-ENTRY_NOTICE', 'gap-SUBLET_GUESTS', 'nope', 'gap-nonexistent'],
  tone: 'polite',
  channel: 'whatsapp',
  ...overrides
});

describe('buildNegotiationLocal', () => {
  it('only includes differs matches and absent gaps, skipping anything else', () => {
    const result = buildNegotiationLocal(base());
    expect(result.items.map(i => i.rowId)).toEqual(['match-noticePeriod', 'match-duration', 'gap-DEPOSIT_REFUND_TIMELINE']);
  });

  it('builds polite asks with clause evidence', () => {
    const result = buildNegotiationLocal(base());
    expect(result.items[0]!.ask).toContain('notice period');
    expect(result.items[0]!.ask).toContain('Clause c1');
    expect(result.items[0]!.reason).toBe('The agreement uses different wording than promised.');
  });

  it('frames INFO (better-than-promised) rows as confirmations', () => {
    const result = buildNegotiationLocal(base());
    expect(result.items[1]!.ask).toContain('better than what we discussed');
  });

  it('builds direct asks for direct tone', () => {
    const result = buildNegotiationLocal({ ...base(), tone: 'direct' });
    expect(result.items[0]!.ask).toContain('Please correct.');
    expect(result.items[2]!.ask).toContain('Missing:');
  });

  it('falls back to a default request when a gap has no wording', () => {
    const result = buildNegotiationLocal(base({ gaps: [{ ...gap('DEPOSIT_REFUND_TIMELINE'), requestWording: null }] }));
    expect(result.items[2]!.suggestedWording).toBe('Please add a clause covering this.');
  });

  it('builds suggested wording per key', () => {
    const result = buildNegotiationLocal(base());
    expect(result.items[0]!.suggestedWording).toContain('Notice period: 1 month for both tenant and owner.');
    expect(result.items[1]!.suggestedWording).toContain('Term: 2 years (as agreed).');
  });

  it('collapses blank lines on WhatsApp but keeps them in email', () => {
    const wa = buildNegotiationLocal(base());
    const mail = buildNegotiationLocal({ ...base(), channel: 'email' });

    expect(wa.message).not.toContain('\n\n');
    expect(wa.message.startsWith('Hi, ')).toBe(true);
    expect(wa.message).toContain('Thanks for your time!');

    expect(mail.message).toContain('Dear [Owner/Broker],');
    expect(mail.message).toContain('\n\n');
    expect(mail.message).toContain('Best regards,');
  });

  it('returns an empty message for no selected rows', () => {
    const result = buildNegotiationLocal(base({ selectedRowIds: [] }));
    expect(result.items).toEqual([]);
    expect(result.message).toBe('');
  });

  it('uses the key as topic label fallback for unknown keys', () => {
    const result = buildNegotiationLocal(base({ matches: [m('parking' as string, 'differs', 'MEDIUM', 'Parking 2', 'Parking 1')], selectedRowIds: ['match-parking'] }));
    expect(result.items[0]!.ask).toContain('parking');
  });
});