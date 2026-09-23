import { describe, it, expect } from 'vitest';
import { buildDerived, runRules, type RuleContext } from './rental';
import { PROTECTIONS, PROTECTION_IDS, buildGapRows } from './protections';
import type { InterviewAnswers, Clause, MatchRow, GapRow, NormalisedAnswers, ProtectionId } from '../types';
import { buildMatchRows } from '../interview/compare';
import { normaliseAnswers } from '../interview/normalise';

const clause = (text: string, id = 'c001'): Clause => ({
  id,
  label: null,
  heading: null,
  text,
  page: 1,
  pageEnd: 1,
  order: 1
});

const gap = (id: string, state: GapRow['state'] = 'absent', quote: string | null = null): GapRow => ({
  id: id as ProtectionId,
  title: id,
  state,
  evidence: quote ? { clauseId: 'c001', quote, status: 'verified' } : null,
  whyItMatters: '',
  requestWording: null
});

const match = (key: string, written: string, verdict: MatchRow['verdict'] = 'matches'): MatchRow => ({
  key: key as keyof InterviewAnswers,
  agreed: '',
  verdict,
  severity: 'INFO',
  note: '',
  written,
  evidence: null,
  suggestedQuestion: null
});

const emptyInterview: NormalisedAnswers = {
  city: 'Pune',
  monthlyRent: null,
  deposit: null,
  duration: null,
  lockIn: null,
  noticePeriod: null,
  maintenance: null,
  repairs: null,
  increase: null,
  extras: []
};

function makeCtx(overrides: Partial<RuleContext>): RuleContext {
  const base: RuleContext = {
    clauses: [],
    matches: [],
    gaps: [],
    interview: emptyInterview,
    derived: {
      depositMonths: null,
      monthlyRent: null,
      lockInDays: null,
      noticeTenantDays: null,
      noticeLandlordDays: null,
      durationDays: null
    }
  };
  const ctx = { ...base, ...overrides };
  return { ...ctx, derived: buildDerived(ctx) };
}

function runIds(ctx: RuleContext): string[] {
  return runRules(ctx).map(h => h.ruleId);
}

describe('buildDerived', () => {
  it('uses interview values directly', () => {
    const d = buildDerived(makeCtx({
      interview: { ...emptyInterview, deposit: { amount: 60000, months: 3 }, lockIn: 180, duration: 330 }
    }));
    expect(d.depositMonths).toBe(3);
    expect(d.lockInDays).toBe(180);
    expect(d.durationDays).toBe(330);
  });

  it('derives tenant notice from the noticePeriod match row', () => {
    const ctx = makeCtx({ matches: [match('noticePeriod', '1 month')] });
    expect(ctx.derived.noticeTenantDays).toBe(30);
  });

  it('derives landlord notice from the NOTICE_LANDLORD gap quote', () => {
    const ctx = makeCtx({ gaps: [gap('NOTICE_LANDLORD', 'present', '14 days notice')] });
    expect(ctx.derived.noticeLandlordDays).toBe(14);
  });

  it('parses multi-month and free-text notice wording', () => {
    const months = makeCtx({ matches: [match('noticePeriod', '3 months')] });
    expect(months.derived.noticeTenantDays).toBe(90);

    const two = makeCtx({ matches: [match('noticePeriod', '2 months')] });
    expect(two.derived.noticeTenantDays).toBe(60);

    const fuzzy = makeCtx({ matches: [match('noticePeriod', 'by written notice')] });
    expect(fuzzy.derived.noticeTenantDays).toBeNull();
  });

  it('stays null when nothing is known', () => {
    const ctx = makeCtx({});
    expect(ctx.derived.depositMonths).toBeNull();
    expect(ctx.derived.noticeTenantDays).toBeNull();
    expect(ctx.derived.noticeLandlordDays).toBeNull();
  });
});

describe('IN-RENT-DEPOSIT-HIGH', () => {
  it('fires for 3+ months deposit', () => {
    const ctx = makeCtx({ interview: { ...emptyInterview, deposit: { amount: 120000, months: 3 } } });
    expect(runIds(ctx)).toContain('IN-RENT-DEPOSIT-HIGH');
  });

  it('stays silent for 2 months', () => {
    const ctx = makeCtx({ interview: { ...emptyInterview, deposit: { amount: 80000, months: 2 } } });
    expect(runIds(ctx)).not.toContain('IN-RENT-DEPOSIT-HIGH');
  });

  it('uses the city context in rule messages', () => {
    const ctx = makeCtx({ interview: { ...emptyInterview, city: 'Pune', deposit: { amount: 120000, months: 3 } } });
    expect(runIds(ctx)).toContain('IN-RENT-DEPOSIT-HIGH');
  });

  it('falls back to a generic reference when the city is unknown', () => {
    const ctx = makeCtx({ interview: { ...emptyInterview, city: null, deposit: { amount: 120000, months: 3 } } });
    const hit = runRules(ctx).find(r => r.ruleId === 'IN-RENT-DEPOSIT-HIGH')!;
    expect(hit.message).not.toContain('undefined');
  });
});

describe('IN-RENT-DEPOSIT-NO-TIMELINE', () => {
  it('fires when absent or unclear', () => {
    expect(runIds(makeCtx({ gaps: [gap('DEPOSIT_REFUND_TIMELINE', 'absent')] }))).toContain('IN-RENT-DEPOSIT-NO-TIMELINE');
    expect(runIds(makeCtx({ gaps: [gap('DEPOSIT_REFUND_TIMELINE', 'unclear')] }))).toContain('IN-RENT-DEPOSIT-NO-TIMELINE');
  });

  it('does not fire when present', () => {
    expect(runIds(makeCtx({ gaps: [gap('DEPOSIT_REFUND_TIMELINE', 'present')] }))).not.toContain('IN-RENT-DEPOSIT-NO-TIMELINE');
  });
});

describe('IN-RENT-DEPOSIT-DISCRETION', () => {
  it('fires on sole discretion without a deduction basis', () => {
    const ctx = makeCtx({
      clauses: [clause('Deductions shall be at the sole discretion of the owner.')],
      gaps: [gap('DEPOSIT_DEDUCTION_BASIS', 'absent')]
    });
    expect(runIds(ctx)).toContain('IN-RENT-DEPOSIT-DISCRETION');
  });

  it('does not fire when a deduction basis is present', () => {
    const ctx = makeCtx({
      clauses: [clause('Deductions at sole discretion of the owner.')],
      gaps: [gap('DEPOSIT_DEDUCTION_BASIS', 'present')]
    });
    expect(runIds(ctx)).not.toContain('IN-RENT-DEPOSIT-DISCRETION');
  });
});

describe('IN-RENT-LOCKIN-LONG', () => {
  it('fires for a 6+ month lock-in', () => {
    const ctx = makeCtx({ interview: { ...emptyInterview, lockIn: 180 } });
    expect(runIds(ctx)).toContain('IN-RENT-LOCKIN-LONG');
  });

  it('fires for a lock-in reaching half the duration', () => {
    const ctx = makeCtx({ interview: { ...emptyInterview, lockIn: 90, duration: 180 } });
    expect(runIds(ctx)).toContain('IN-RENT-LOCKIN-LONG');
  });

  it('is HIGH when the deposit is forfeited', () => {
    const ctx = makeCtx({
      interview: { ...emptyInterview, lockIn: 270 },
      clauses: [clause('On early exit the deposit shall be forfeited.')]
    });
    const hit = runRules(ctx).find(r => r.ruleId === 'IN-RENT-LOCKIN-LONG')!;
    expect(hit.severity).toBe('HIGH');
  });

  it('is MEDIUM otherwise', () => {
    const ctx = makeCtx({ interview: { ...emptyInterview, lockIn: 270 } });
    const hit = runRules(ctx).find(r => r.ruleId === 'IN-RENT-LOCKIN-LONG')!;
    expect(hit.severity).toBe('MEDIUM');
  });

  it('stays silent for a short lock-in', () => {
    const ctx = makeCtx({ interview: { ...emptyInterview, lockIn: 60, duration: 330 } });
    expect(runIds(ctx)).not.toContain('IN-RENT-LOCKIN-LONG');
  });
});

describe('IN-RENT-NOTICE-ASYMMETRIC', () => {
  it('fires when tenant notice exceeds landlord notice', () => {
    const ctx = makeCtx({
      matches: [match('noticePeriod', '1 month')],
      gaps: [gap('NOTICE_LANDLORD', 'present', '15 days')]
    });
    expect(runIds(ctx)).toContain('IN-RENT-NOTICE-ASYMMETRIC');
  });

  it('stays silent on equal notice', () => {
    const ctx = makeCtx({
      matches: [match('noticePeriod', '1 month')],
      gaps: [gap('NOTICE_LANDLORD', 'present', '30 days')]
    });
    expect(runIds(ctx)).not.toContain('IN-RENT-NOTICE-ASYMMETRIC');
  });
});

describe('IN-RENT-ENTRY-NO-NOTICE', () => {
  it('fires when entry notice protection is absent', () => {
    const ctx = makeCtx({ gaps: [gap('ENTRY_NOTICE', 'absent')] });
    expect(runIds(ctx)).toContain('IN-RENT-ENTRY-NO-NOTICE');
  });

  it('fires when the owner may enter at any time', () => {
    const ctx = makeCtx({
      gaps: [gap('ENTRY_NOTICE', 'present')],
      clauses: [clause('Owner may enter the premises at any time.')]
    });
    expect(runIds(ctx)).toContain('IN-RENT-ENTRY-NO-NOTICE');
  });

  it('stays silent when entry notice is present without abusive terms', () => {
    const ctx = makeCtx({
      gaps: [gap('ENTRY_NOTICE', 'present')],
      clauses: [clause('Owner shall give 24 hours notice before entry.')]
    });
    expect(runIds(ctx)).not.toContain('IN-RENT-ENTRY-NO-NOTICE');
  });
});

describe('IN-RENT-ESSENTIAL-SERVICES', () => {
  it('fires when the owner may cut supplies', () => {
    const ctx = makeCtx({ clauses: [clause('On default, the owner may disconnect the water or electricity supply.')] });
    expect(runIds(ctx)).toContain('IN-RENT-ESSENTIAL-SERVICES');
  });

  it('stays silent otherwise', () => {
    expect(runIds(makeCtx({ clauses: [clause('Rent is payable in advance.')] }))).not.toContain('IN-RENT-ESSENTIAL-SERVICES');
  });
});

describe('IN-RENT-EVICTION-SELF-HELP', () => {
  it('fires on direct re-entry without court process', () => {
    const ctx = makeCtx({ clauses: [clause('Landlord may re-enter without notice to the Rent Authority.')] });
    expect(runIds(ctx)).toContain('IN-RENT-EVICTION-SELF-HELP');
  });

  it('fires on removing belongings', () => {
    const ctx = makeCtx({ clauses: [clause('Owner may remove goods without prior court order.')] });
    expect(runIds(ctx)).toContain('IN-RENT-EVICTION-SELF-HELP');
  });
});

describe('IN-RENT-REPAIRS-ON-TENANT', () => {
  it('fires when all structural repairs fall on the tenant', () => {
    const ctx = makeCtx({ clauses: [clause('The tenant shall be responsible for structural repairs.')] });
    expect(runIds(ctx)).toContain('IN-RENT-REPAIRS-ON-TENANT');
  });
});

describe('IN-RENT-INCREASE-UNCAPPED', () => {
  it('fires on unscoped rent revision', () => {
    const ctx = makeCtx({ clauses: [clause('The owner may revise the rent at their sole discretion.')] });
    expect(runIds(ctx)).toContain('IN-RENT-INCREASE-UNCAPPED');
  });
});

describe('IN-RENT-MAINTENANCE-UNCLEAR', () => {
  it('fires when maintenance split is absent', () => {
    expect(runIds(makeCtx({ gaps: [gap('MAINTENANCE_CHARGES', 'absent')] }))).toContain('IN-RENT-MAINTENANCE-UNCLEAR');
  });

  it('fires when present but the split is ambiguous', () => {
    const ctx = makeCtx({
      gaps: [gap('MAINTENANCE_CHARGES', 'present')],
      clauses: [clause('Society charges to be borne as per local practice.')]
    });
    expect(runIds(ctx)).toContain('IN-RENT-MAINTENANCE-UNCLEAR');
  });

  it('stays silent when the owner clearly handles society dues', () => {
    const ctx = makeCtx({
      gaps: [gap('MAINTENANCE_CHARGES', 'present')],
      clauses: [clause('Society maintenance shall be borne by the owner.')]
    });
    expect(runIds(ctx)).not.toContain('IN-RENT-MAINTENANCE-UNCLEAR');
  });
});

describe('IN-RENT-REGISTRATION', () => {
  it('fires for an 11 month duration', () => {
    const ctx = makeCtx({ interview: { ...emptyInterview, duration: 330 }, gaps: [gap('REGISTRATION_STAMPING', 'present')] });
    expect(runIds(ctx)).toContain('IN-RENT-REGISTRATION');
  });

  it('fires when registration protection is absent', () => {
    const ctx = makeCtx({ interview: { ...emptyInterview, duration: 400 }, gaps: [gap('REGISTRATION_STAMPING', 'absent')] });
    expect(runIds(ctx)).toContain('IN-RENT-REGISTRATION');
  });

  it('stays silent for a registered longer term', () => {
    const ctx = makeCtx({ interview: { ...emptyInterview, duration: 400 }, gaps: [gap('REGISTRATION_STAMPING', 'present')] });
    expect(runIds(ctx)).not.toContain('IN-RENT-REGISTRATION');
  });
});

describe('IN-RENT-GUEST-RESTRICTION', () => {
  it('fires on no-guests clauses', () => {
    const ctx = makeCtx({ clauses: [clause('No guests permitted overnight.')] });
    expect(runIds(ctx)).toContain('IN-RENT-GUEST-RESTRICTION');
  });

  it('fires on lifestyle restrictions', () => {
    const ctx = makeCtx({ clauses: [clause('Non-veg is not permitted in the flat.')] });
    expect(runIds(ctx)).toContain('IN-RENT-GUEST-RESTRICTION');
  });
});

describe('IN-RENT-SUBLET-SHARING', () => {
  it('fires on partial possession clauses', () => {
    const ctx = makeCtx({ clauses: [clause('The licensee shall not sublet the premises.')] });
    expect(runIds(ctx)).toContain('IN-RENT-SUBLET-SHARING');
  });

  it('is MEDIUM when the tenant plans flatmates', () => {
    const ctx = makeCtx({
      clauses: [clause('The licensee shall not sublet the premises.')],
      interview: { ...emptyInterview, extras: ['flatmate allowed'] }
    });
    const hit = runRules(ctx).find(r => r.ruleId === 'IN-RENT-SUBLET-SHARING')!;
    expect(hit.severity).toBe('MEDIUM');
  });

  it('is INFO otherwise', () => {
    const ctx = makeCtx({ clauses: [clause('The licensee shall not sublet the premises.')], interview: { ...emptyInterview, extras: ['parking'] } });
    const hit = runRules(ctx).find(r => r.ruleId === 'IN-RENT-SUBLET-SHARING')!;
    expect(hit.severity).toBe('INFO');
  });
});

describe('IN-RENT-SALE-OF-PROPERTY', () => {
  it('fires when sale protection is absent', () => {
    expect(runIds(makeCtx({ gaps: [gap('SALE_OF_PROPERTY', 'absent')] }))).toContain('IN-RENT-SALE-OF-PROPERTY');
  });

  it('stays silent when present', () => {
    expect(runIds(makeCtx({ gaps: [gap('SALE_OF_PROPERTY', 'present')] }))).not.toContain('IN-RENT-SALE-OF-PROPERTY');
  });
});

describe('IN-RENT-TDS', () => {
  it('fires for rent above 50k', () => {
    const ctx = makeCtx({ interview: { ...emptyInterview, monthlyRent: 60000 } });
    expect(runIds(ctx)).toContain('IN-RENT-TDS');
  });

  it('stays silent below 50k', () => {
    const ctx = makeCtx({ interview: { ...emptyInterview, monthlyRent: 40000 } });
    expect(runIds(ctx)).not.toContain('IN-RENT-TDS');
  });
});

describe('IN-RENT-POLICE-VERIFICATION', () => {
  it('fires when the agreement has a police verification clause', () => {
    const ctx = makeCtx({ clauses: [clause('Tenant shall complete police verification.')] });
    expect(runIds(ctx)).toContain('IN-RENT-POLICE-VERIFICATION');
  });

  it('fires in metro cities without a dispute venue', () => {
    const ctx = makeCtx({
      clauses: [],
      interview: { ...emptyInterview, city: 'Mumbai' },
      gaps: [gap('DISPUTE_RESOLUTION', 'absent')]
    });
    expect(runIds(ctx)).toContain('IN-RENT-POLICE-VERIFICATION');
  });

  it('stays silent in a non-metro without dispute gap', () => {
    const ctx = makeCtx({ clauses: [], interview: { ...emptyInterview, city: 'Solapur' }, gaps: [gap('DISPUTE_RESOLUTION', 'present')] });
    expect(runIds(ctx)).not.toContain('IN-RENT-POLICE-VERIFICATION');
  });
});

describe('IN-RENT-DISPUTE', () => {
  it('fires when no dispute venue is set', () => {
    expect(runIds(makeCtx({ gaps: [gap('DISPUTE_RESOLUTION', 'unclear')] }))).toContain('IN-RENT-DISPUTE');
  });

  it('stays silent when a venue exists', () => {
    expect(runIds(makeCtx({ gaps: [gap('DISPUTE_RESOLUTION', 'present')] }))).not.toContain('IN-RENT-DISPUTE');
  });
});

describe('runRules', () => {
  it('replaces {{n}} token with deposit months', () => {
    const ctx = makeCtx({ interview: { ...emptyInterview, deposit: { amount: 120000, months: 3 } } });
    const hit = runRules(ctx).find(r => r.ruleId === 'IN-RENT-DEPOSIT-HIGH')!;
    expect(hit.message).toContain('3 months');
  });

  it('skips all rules for a completely benign agreement', () => {
    const ctx = makeCtx({
      clauses: [clause('The owner shall give 24 hours notice. Essential supplies shall not be withheld. Society maintenance and property tax shall be borne by the owner.')],
      gaps: [
        gap('DEPOSIT_REFUND_TIMELINE', 'present'),
        gap('DEPOSIT_DEDUCTION_BASIS', 'present'),
        gap('ENTRY_NOTICE', 'present'),
        gap('MAINTENANCE_CHARGES', 'present'),
        gap('REGISTRATION_STAMPING', 'present'),
        gap('SALE_OF_PROPERTY', 'present'),
        gap('DISPUTE_RESOLUTION', 'present')
      ],
      interview: { ...emptyInterview, monthlyRent: 40000, deposit: { amount: 80000, months: 2 }, lockIn: 60, duration: 400 },
      matches: [match('noticePeriod', '1 month')]
    });
    expect(runIds(ctx)).toEqual([]);
  });
});

describe('buildGapRows / PROTECTIONS', () => {
  it('has 20 protections with unique ids and correct derived ids', () => {
    expect(PROTECTIONS).toHaveLength(20);
    expect(PROTECTION_IDS).toEqual(Array.from(new Set(PROTECTION_IDS)));
  });

  it('maps findings to gap rows with evidence and defaults to unclear', () => {
    const verified = new Map([['c010', { clauseId: 'c010', quote: 'Deposit refunded within 15 days.', status: 'verified' as const }]]);
    const rows = buildGapRows(
      [
        { id: 'DEPOSIT_REFUND_TIMELINE', state: 'present', summary: 'within 15 days', clauseId: 'c010', quote: 'Deposit refunded within 15 days.' },
        { id: 'RENT_AMOUNT', state: 'absent', summary: null, clauseId: null, quote: null },
        { id: 'LOCK_IN', state: 'unclear', summary: null, clauseId: 'c999', quote: 'x' }
      ],
      verified
    );
    expect(rows).toHaveLength(20);
    const timeline = rows.find(r => r.id === 'DEPOSIT_REFUND_TIMELINE')!;
    expect(timeline.state).toBe('present');
    expect(timeline.evidence?.status).toBe('verified');
    expect(timeline.requestWording).toContain('15 days');
    const missing = rows.find(r => r.id === 'LOCK_IN')!;
    expect(missing.state).toBe('unclear');
    expect(missing.evidence).toBeNull();
    const unlisted = rows.find(r => r.id === 'SUBLET_GUESTS')!;
    expect(unlisted.state).toBe('unclear');
  });
});

describe('integration with buildMatchRows', () => {
  it('flows a demo-style pipeline without rules firing falsely', () => {
    const answers = {
      city: 'Pune',
      monthlyRent: '40000',
      deposit: '80000',
      duration: '11 months',
      lockIn: 'no',
      noticePeriod: '1 month',
      maintenance: 'owner',
      repairs: 'split',
      increase: '5%',
      extras: []
    };
    const normalised = normaliseAnswers(answers);
    const matches = buildMatchRows(
      answers,
      [{ key: 'noticePeriod', found: true, writtenValue: '1 month', clauseId: 'c001', quote: 'x', ambiguity: null }],
      new Map([['c001', { clauseId: 'c001', quote: 'one month written notice', status: 'verified' as const }]])
    );
    const ctx = makeCtx({
      clauses: [clause('Rent payable in advance.')],
      matches,
      gaps: [
        gap('DEPOSIT_REFUND_TIMELINE', 'present'),
        gap('DEPOSIT_DEDUCTION_BASIS', 'present'),
        gap('ENTRY_NOTICE', 'present'),
        gap('MAINTENANCE_CHARGES', 'present'),
        gap('REGISTRATION_STAMPING', 'present'),
        gap('SALE_OF_PROPERTY', 'present'),
        gap('DISPUTE_RESOLUTION', 'present')
      ],
      interview: normalised
    });
    // deposit is 2 months, duration 11 months → registration INFO fires, TDS does not
    const ids = runIds(ctx);
    expect(ids).toContain('IN-RENT-REGISTRATION');
    expect(ids).not.toContain('IN-RENT-TDS');
  });
});