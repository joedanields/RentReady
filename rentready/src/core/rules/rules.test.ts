import { describe, it, expect } from 'vitest';
import { buildDerived, runRules, RENTAL_RULES, type RuleContext } from './rental';
import { PROTECTIONS, PROTECTION_IDS, buildGapRows } from './protections';
import { evidenceKey } from '../verify/verifyQuote';
import { segmentClauses } from '../parsing/segmenter';
import { SAMPLE_PAGES } from '../../sample/sampleData';
import type {
  InterviewAnswers,
  Clause,
  MatchRow,
  GapRow,
  NormalisedAnswers,
  ProtectionId,
} from '../types';

let nextId = 1;
const clause = (text: string): Clause => {
  const id = `c${String(nextId++).padStart(3, '0')}`;
  return { id, label: null, heading: null, text, page: 1, pageEnd: 1, order: 1 };
};

const gap = (id: string, state: GapRow['state'], quote: string | null = null): GapRow => ({
  id: id as ProtectionId,
  title: id,
  state,
  evidence: quote ? { clauseId: 'c900', quote, status: 'verified' } : null,
  whyItMatters: '',
  requestWording: null,
});

const match = (key: string, written: string, verified = true): MatchRow => ({
  key: key as keyof InterviewAnswers,
  agreed: 'x',
  verdict: 'matches',
  severity: 'INFO',
  note: '',
  written,
  evidence: { clauseId: 'c900', quote: 'q', status: verified ? 'verified' : 'unverified' },
  suggestedQuestion: null,
});

const interview: NormalisedAnswers = {
  city: 'Nashik',
  monthlyRent: null,
  deposit: null,
  duration: null,
  lockIn: null,
  noticePeriod: null,
  maintenance: null,
  repairs: null,
  increase: null,
  extras: [],
};

/**
 * A neutral agreement that trips no rule offline: deposit timeline, entry notice, maintenance,
 * sale and dispute wording are all present. Tests add or swap clauses to trigger one rule.
 */
const NEUTRAL = [
  'The security deposit of Rs. 80,000 shall be refunded within 15 days of handing over possession.',
  'The Owner may inspect the premises after giving 24 hours written notice to the Tenant.',
  'Society maintenance charges and property tax shall be paid by the Owner.',
  'If the property is sold, this agreement shall bind the new owner for the remaining term.',
  'Any dispute shall be decided by the courts at the place where the property is situated.',
];

type CtxInput = Partial<Omit<RuleContext, 'derived'>> & { texts?: string[] };

function ctx({ texts, ...rest }: CtxInput = {}): Omit<RuleContext, 'derived'> {
  return {
    clauses: (texts ?? NEUTRAL).map(clause),
    matches: [],
    gaps: [],
    interview,
    aiChecked: false,
    ...rest,
  };
}

const ids = (input: CtxInput = {}) => runRules(ctx(input)).map(h => h.ruleId);
const withText = (...extra: string[]): CtxInput => ({ texts: [...NEUTRAL, ...extra] });
const hit = (id: string, input: CtxInput) => runRules(ctx(input)).find(h => h.ruleId === id);
const aiGaps = (overrides: Record<string, GapRow['state']>): GapRow[] =>
  PROTECTION_IDS.map(id => gap(id, overrides[id] ?? 'present'));

describe('baseline', () => {
  it('a neutral agreement triggers nothing offline', () => {
    expect(ids()).toEqual([]);
  });

  it('a neutral agreement with an all-present AI checklist triggers nothing', () => {
    expect(ids({ aiChecked: true, gaps: aiGaps({}) })).toEqual([]);
  });

  it('treats a checklist item the model never returned as unclear', () => {
    expect(ids({ aiChecked: true, gaps: [] })).toContain('IN-RENT-DEPOSIT-NO-TIMELINE');
  });

  it('every rule carries the state-varies note and a review date', () => {
    for (const rule of RENTAL_RULES) {
      expect(rule.stateVariesNote).toBe(true);
      expect(rule.lastReviewed).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});

describe('buildDerived — reads the agreement, not the interview', () => {
  it('prefers the agreement text over what the user said', () => {
    const d = buildDerived({
      ...ctx({
        texts: [
          'The Licensee shall pay monthly rent of Rs. 40,000 on the fifth of each month.',
          "A security deposit of Rs. 1,20,000 equivalent to three months' rent is payable.",
        ],
      }),
      interview: { ...interview, monthlyRent: 99999, deposit: { amount: 1, months: 1 } },
    });
    expect(d.monthlyRent).toBe(40000);
    expect(d.depositMonths).toBe(3);
    expect(d.sources.deposit?.text).toContain('security deposit');
  });

  it('falls back to verified model findings, never to unverified ones', () => {
    const d = buildDerived({
      ...ctx({ texts: [] }),
      matches: [match('lockIn', '6 months'), match('duration', '11 months', false)],
    });
    expect(d.lockInDays).toBe(180);
    expect(d.durationDays).toBeNull();
  });

  it('uses the NOTICE_LANDLORD quote for owner notice, and the interview rent for TDS only', () => {
    const d = buildDerived({
      ...ctx({ texts: [] }),
      gaps: [gap('NOTICE_LANDLORD', 'present', '14 days notice')],
      interview: { ...interview, monthlyRent: 60000 },
      matches: [match('noticePeriod', '1 month')],
    });
    expect(d.noticeLandlordDays).toBe(14);
    expect(d.noticeTenantDays).toBe(30);
    expect(d.monthlyRent).toBe(60000);
    expect(d.sources).toEqual({});
  });

  it('records the clauses notice, lock-in and term were read from', () => {
    const d = buildDerived(
      ctx({
        texts: [
          'The licence is for a period of eleven (11) months.',
          'Lock-in period of 3 months.',
          "The Licensor shall give one month's notice.",
        ],
      })
    );
    expect(d.sources.duration?.text).toContain('eleven');
    expect(d.sources.lockIn?.text).toContain('Lock-in');
    expect(d.sources.notice?.text).toContain('Licensor');
  });

  it('stays null when nothing is written', () => {
    const d = buildDerived({ ...ctx({ texts: [] }), gaps: [gap('NOTICE_LANDLORD', 'present')] });
    expect(d).toMatchObject({
      depositMonths: null,
      monthlyRent: null,
      lockInDays: null,
      noticeTenantDays: null,
      noticeLandlordDays: null,
      durationDays: null,
    });
  });
});

describe('IN-RENT-DEPOSIT-HIGH', () => {
  const three = "A security deposit equivalent to three months' rent is payable on signing.";
  it('fires for a 3-month deposit and cites the clause, filling {{n}}', () => {
    const h = hit('IN-RENT-DEPOSIT-HIGH', withText(three))!;
    expect(h.message).toContain('about 3 months of rent');
    expect(h.clauseId).not.toBeNull();
  });
  it('fires for a rupee deposit that works out to 4 months', () => {
    expect(
      ids({
        texts: [
          'Monthly rent of Rs. 25,000 is payable in advance.',
          'The security deposit of Rs. 1,00,000 is refundable within 15 days of vacating.',
        ],
      })
    ).toContain('IN-RENT-DEPOSIT-HIGH');
  });
  it('stays silent for 2 months', () => {
    expect(ids(withText("A security deposit of two months' rent is payable."))).not.toContain(
      'IN-RENT-DEPOSIT-HIGH'
    );
  });
  it('stays silent when the user said 3 months but the agreement does not say', () => {
    expect(
      ids({ interview: { ...interview, deposit: { amount: null, months: 3 } } })
    ).not.toContain('IN-RENT-DEPOSIT-HIGH');
  });
});

describe('IN-RENT-DEPOSIT-NO-TIMELINE', () => {
  const noTimeline = [
    'The security deposit of Rs. 80,000 shall be refunded after deductions.',
    ...NEUTRAL.slice(1),
  ];
  it('fires offline when the deposit clause has no refund deadline', () => {
    expect(ids({ texts: noTimeline })).toContain('IN-RENT-DEPOSIT-NO-TIMELINE');
  });
  it('fires when the AI checklist says absent or unclear', () => {
    for (const state of ['absent', 'unclear'] as const) {
      expect(ids({ aiChecked: true, gaps: aiGaps({ DEPOSIT_REFUND_TIMELINE: state }) })).toContain(
        'IN-RENT-DEPOSIT-NO-TIMELINE'
      );
    }
  });
  it('stays silent offline when a deadline is written either way round', () => {
    expect(ids()).not.toContain('IN-RENT-DEPOSIT-NO-TIMELINE');
    expect(
      ids({
        texts: [
          'Within thirty days of vacating, the security deposit of Rs. 50,000 shall be returned.',
        ],
      })
    ).not.toContain('IN-RENT-DEPOSIT-NO-TIMELINE');
  });
  it('stays silent offline when there is no deposit clause at all', () => {
    expect(ids({ texts: NEUTRAL.slice(1) })).not.toContain('IN-RENT-DEPOSIT-NO-TIMELINE');
  });
});

describe('IN-RENT-DEPOSIT-DISCRETION', () => {
  it('fires on deductions "as determined by the Licensor"', () => {
    expect(ids(withText('Deductions as determined by the Licensor apply.'))).toContain(
      'IN-RENT-DEPOSIT-DISCRETION'
    );
  });
  it('fires on "sole discretion" when the AI checklist has no deduction basis', () => {
    expect(
      ids({
        ...withText('Deductions at the sole discretion of the owner.'),
        aiChecked: true,
        gaps: aiGaps({ DEPOSIT_DEDUCTION_BASIS: 'unclear' }),
      })
    ).toContain('IN-RENT-DEPOSIT-DISCRETION');
  });
  it('stays silent when a deduction basis is present', () => {
    expect(
      ids({
        ...withText('Deductions as deemed fit by the owner.'),
        aiChecked: true,
        gaps: aiGaps({}),
      })
    ).not.toContain('IN-RENT-DEPOSIT-DISCRETION');
  });
  it('stays silent without discretionary wording', () => {
    expect(ids()).not.toContain('IN-RENT-DEPOSIT-DISCRETION');
  });
});

describe('IN-RENT-LOCKIN-LONG', () => {
  it('is HIGH for a 6-month lock-in with deposit forfeiture', () => {
    const h = hit(
      'IN-RENT-LOCKIN-LONG',
      withText(
        'The Licensee shall not vacate the premises before the expiry of six (6) months, failing which the Licensor shall forfeit the deposit.'
      )
    )!;
    expect(h.severity).toBe('HIGH');
    expect(h.clauseId).not.toBeNull();
  });
  it('is MEDIUM for a lock-in of half a short term without forfeiture', () => {
    const h = hit(
      'IN-RENT-LOCKIN-LONG',
      withText('The licence is for a period of 8 months from possession.', 'Lock-in: 4 months.')
    )!;
    expect(h.severity).toBe('MEDIUM');
  });
  it('stays silent for a 3-month lock-in in an 11-month term', () => {
    expect(
      ids(
        withText(
          'The licence is for a period of eleven (11) months.',
          'Lock-in period of 3 months.'
        )
      )
    ).not.toContain('IN-RENT-LOCKIN-LONG');
  });
  it('stays silent when the user said 6 months but the agreement has no lock-in', () => {
    expect(ids({ interview: { ...interview, lockIn: 180 } })).not.toContain('IN-RENT-LOCKIN-LONG');
  });
});

describe('IN-RENT-NOTICE-ASYMMETRIC', () => {
  it('fires when the tenant must give more notice than the owner', () => {
    expect(
      ids(
        withText(
          "The Licensee shall give two months' written notice before vacating.",
          "The Licensor shall give one month's notice to terminate."
        )
      )
    ).toContain('IN-RENT-NOTICE-ASYMMETRIC');
  });
  it('reads whose notice it is from who gives it, not who is named', () => {
    expect(
      ids(
        withText(
          "The Tenant must give 60 days' notice before leaving.",
          "The Owner shall give the Tenant 30 days' notice of any termination."
        )
      )
    ).toContain('IN-RENT-NOTICE-ASYMMETRIC');
  });
  it('stays silent when either party gives the same notice', () => {
    expect(ids(withText("Either party shall give two months' written notice."))).not.toContain(
      'IN-RENT-NOTICE-ASYMMETRIC'
    );
  });
  it('stays silent when only one side is known', () => {
    expect(ids(withText("The Tenant shall give one month's notice."))).not.toContain(
      'IN-RENT-NOTICE-ASYMMETRIC'
    );
  });
});

describe('IN-RENT-ENTRY-NO-NOTICE', () => {
  const noEntryNotice = [NEUTRAL[0]!, ...NEUTRAL.slice(2)];
  it('fires when the owner may enter at any time or without prior notice, citing the clause', () => {
    const h = hit(
      'IN-RENT-ENTRY-NO-NOTICE',
      withText('The Owner may enter the premises at any time.')
    )!;
    expect(h.clauseId).not.toBeNull();
    expect(ids(withText('Without prior notice the Licensor may inspect the flat.'))).toContain(
      'IN-RENT-ENTRY-NO-NOTICE'
    );
  });
  it('fires offline when no clause gives notice before entry, or when AI says absent', () => {
    expect(ids({ texts: noEntryNotice })).toContain('IN-RENT-ENTRY-NO-NOTICE');
    expect(ids({ aiChecked: true, gaps: aiGaps({ ENTRY_NOTICE: 'absent' }) })).toContain(
      'IN-RENT-ENTRY-NO-NOTICE'
    );
  });
  it('does not fire for an entry clause with 24 hours notice, either way round', () => {
    expect(ids()).not.toContain('IN-RENT-ENTRY-NO-NOTICE');
    expect(
      ids({ texts: [...noEntryNotice, 'After 24 hours notice the Owner may visit the flat.'] })
    ).not.toContain('IN-RENT-ENTRY-NO-NOTICE');
  });
  it('does not fire for "at any time" about something other than entry', () => {
    expect(ids(withText('The Tenant may pay rent at any time before the fifth.'))).not.toContain(
      'IN-RENT-ENTRY-NO-NOTICE'
    );
  });
});

describe('IN-RENT-ESSENTIAL-SERVICES', () => {
  it('fires on cutting water or disconnecting electricity', () => {
    expect(ids(withText('The Owner may cut off the water supply if rent is late.'))).toContain(
      'IN-RENT-ESSENTIAL-SERVICES'
    );
    expect(ids(withText('The Licensor may disconnect electricity on default.'))).toContain(
      'IN-RENT-ESSENTIAL-SERVICES'
    );
  });
  it('stays silent when supplies are protected or not mentioned', () => {
    expect(ids(withText('Water and electricity will always be available.'))).not.toContain(
      'IN-RENT-ESSENTIAL-SERVICES'
    );
    expect(ids()).not.toContain('IN-RENT-ESSENTIAL-SERVICES');
  });
});

describe('IN-RENT-EVICTION-SELF-HELP', () => {
  it('fires when the owner may re-enter and take possession, with no legal process named', () => {
    expect(
      ids(withText('The Licensor shall be entitled to re-enter the premises and take possession.'))
    ).toContain('IN-RENT-EVICTION-SELF-HELP');
  });
  it('fires when the owner may remove belongings', () => {
    expect(
      ids(withText('On default the Owner may remove the goods and belongings of the Tenant.'))
    ).toContain('IN-RENT-EVICTION-SELF-HELP');
  });
  it('stays silent when possession is taken through a court or rent authority', () => {
    expect(
      ids(withText('The Owner may take possession only through the Rent Authority.'))
    ).not.toContain('IN-RENT-EVICTION-SELF-HELP');
  });
  it('stays silent when it is the tenant taking possession', () => {
    expect(
      ids(withText('The Tenant shall take possession on the first of the month.'))
    ).not.toContain('IN-RENT-EVICTION-SELF-HELP');
  });
});

describe('IN-RENT-REPAIRS-ON-TENANT', () => {
  it('fires when the licensee is responsible for all repairs', () => {
    expect(
      ids(withText('The Licensee shall be responsible for all repairs including structural.'))
    ).toContain('IN-RENT-REPAIRS-ON-TENANT');
  });
  it('fires when major repairs are borne by the tenant, or all repairs fall to the tenant', () => {
    expect(ids(withText('Major repairs shall be borne by the tenant.'))).toContain(
      'IN-RENT-REPAIRS-ON-TENANT'
    );
    expect(ids(withText('All repairs are to be done by the Tenant.'))).toContain(
      'IN-RENT-REPAIRS-ON-TENANT'
    );
  });
  it('stays silent for minor repairs only, or owner-side repairs', () => {
    expect(ids(withText('The Tenant shall handle minor repairs up to Rs. 2,000.'))).not.toContain(
      'IN-RENT-REPAIRS-ON-TENANT'
    );
    expect(ids(withText('All repairs shall be done by the Owner.'))).not.toContain(
      'IN-RENT-REPAIRS-ON-TENANT'
    );
  });
});

describe('IN-RENT-INCREASE-UNCAPPED', () => {
  it('fires on revision at the owner’s sole discretion or without limit', () => {
    expect(ids(withText('The Owner may revise the rent at his sole discretion.'))).toContain(
      'IN-RENT-INCREASE-UNCAPPED'
    );
    expect(ids(withText('The rent may be increased without any limit.'))).toContain(
      'IN-RENT-INCREASE-UNCAPPED'
    );
  });
  it('stays silent for a fixed percentage or no increase clause', () => {
    expect(ids(withText('Rent shall increase by 5% on renewal.'))).not.toContain(
      'IN-RENT-INCREASE-UNCAPPED'
    );
    expect(ids()).not.toContain('IN-RENT-INCREASE-UNCAPPED');
  });
});

describe('IN-RENT-MAINTENANCE-UNCLEAR', () => {
  const noMaintenance = NEUTRAL.filter(t => !t.includes('maintenance'));
  it('fires offline when no clause mentions maintenance or bills', () => {
    expect(ids({ texts: noMaintenance })).toContain('IN-RENT-MAINTENANCE-UNCLEAR');
  });
  it('fires when the AI checklist says absent or unclear', () => {
    for (const state of ['absent', 'unclear'] as const) {
      expect(ids({ aiChecked: true, gaps: aiGaps({ MAINTENANCE_CHARGES: state }) })).toContain(
        'IN-RENT-MAINTENANCE-UNCLEAR'
      );
    }
  });
  it('stays silent when the agreement assigns maintenance (even to the tenant)', () => {
    expect(ids()).not.toContain('IN-RENT-MAINTENANCE-UNCLEAR');
    expect(
      ids({
        texts: [...noMaintenance, 'The Licensee shall pay electricity charges and all outgoings.'],
      })
    ).not.toContain('IN-RENT-MAINTENANCE-UNCLEAR');
  });
});

describe('IN-RENT-REGISTRATION', () => {
  it('fires for an 11-month term, citing it', () => {
    const h = hit(
      'IN-RENT-REGISTRATION',
      withText('This licence is for a period of eleven (11) months.')
    )!;
    expect(h.severity).toBe('INFO');
    expect(h.clauseId).not.toBeNull();
  });
  it('fires when the AI checklist has no registration clause', () => {
    expect(ids({ aiChecked: true, gaps: aiGaps({ REGISTRATION_STAMPING: 'absent' }) })).toContain(
      'IN-RENT-REGISTRATION'
    );
  });
  it('stays silent for a 3-year term, and when no term is known', () => {
    expect(ids(withText('The lease is for a term of 3 years.'))).not.toContain(
      'IN-RENT-REGISTRATION'
    );
    expect(ids()).not.toContain('IN-RENT-REGISTRATION');
  });
});

describe('IN-RENT-GUEST-RESTRICTION', () => {
  it('fires on a 10 p.m. visitor rule and names visitors in the question', () => {
    const h = hit(
      'IN-RENT-GUEST-RESTRICTION',
      withText('The Licensee shall not permit any visitors to remain after 10:00 p.m.')
    )!;
    expect(h.questions[0]).toContain('restriction on visitors');
  });
  it('fires on lifestyle restrictions and names them', () => {
    const cases: Array<[string, string]> = [
      ['No guests are allowed.', 'visitors'],
      ['Guests leaving after 9 pm need consent.', 'visitors'],
      ['Non-veg food is not permitted.', 'non-vegetarian food'],
      ['Unmarried couples may not stay.', 'unmarried occupants'],
      ['Visitors of the opposite sex are not allowed.', 'visitors of the opposite sex'],
      ['Pets are not allowed in the flat.', 'pets'],
    ];
    for (const [text, item] of cases) {
      expect(hit('IN-RENT-GUEST-RESTRICTION', withText(text))!.questions[0]).toContain(item);
    }
  });
  it('stays silent when guests are allowed or not mentioned', () => {
    expect(ids(withText('Guests are welcome.'))).not.toContain('IN-RENT-GUEST-RESTRICTION');
    expect(ids()).not.toContain('IN-RENT-GUEST-RESTRICTION');
  });
});

describe('IN-RENT-SUBLET-SHARING', () => {
  const sublet = 'The Licensee shall not sublet or part with possession.';
  it('is INFO by default and MEDIUM when the user plans flatmates', () => {
    expect(hit('IN-RENT-SUBLET-SHARING', withText(sublet))!.severity).toBe('INFO');
    expect(
      hit('IN-RENT-SUBLET-SHARING', {
        ...withText(sublet),
        interview: { ...interview, extras: ['Sharing with 2 flatmates'] },
      })!.severity
    ).toBe('MEDIUM');
  });
  it('fires on "shall not allow any other person"', () => {
    expect(ids(withText('The Tenant shall not allow any other person to reside.'))).toContain(
      'IN-RENT-SUBLET-SHARING'
    );
  });
  it('stays silent otherwise', () => {
    expect(ids()).not.toContain('IN-RENT-SUBLET-SHARING');
    expect(ids(withText('The Tenant may share the flat with two named flatmates.'))).not.toContain(
      'IN-RENT-SUBLET-SHARING'
    );
  });
});

describe('IN-RENT-SALE-OF-PROPERTY', () => {
  const noSale = NEUTRAL.filter(t => !t.includes('sold'));
  it('fires offline when sale is never mentioned, or when AI says absent', () => {
    expect(ids({ texts: noSale })).toContain('IN-RENT-SALE-OF-PROPERTY');
    expect(ids({ aiChecked: true, gaps: aiGaps({ SALE_OF_PROPERTY: 'absent' }) })).toContain(
      'IN-RENT-SALE-OF-PROPERTY'
    );
  });
  it('stays silent when sale is covered either way round', () => {
    expect(ids()).not.toContain('IN-RENT-SALE-OF-PROPERTY');
    expect(
      ids({ texts: [...noSale, 'On sale of the flat the new owner is bound.'] })
    ).not.toContain('IN-RENT-SALE-OF-PROPERTY');
  });
});

describe('IN-RENT-TDS', () => {
  it('fires above ₹50,000 from the agreement or, failing that, the interview', () => {
    expect(ids(withText('The monthly rent is Rs. 60,000.'))).toContain('IN-RENT-TDS');
    expect(ids({ interview: { ...interview, monthlyRent: 75000 } })).toContain('IN-RENT-TDS');
  });
  it('stays silent at or below ₹50,000 and when unknown', () => {
    expect(ids(withText('The monthly rent is Rs. 50,000.'))).not.toContain('IN-RENT-TDS');
    expect(ids()).not.toContain('IN-RENT-TDS');
  });
});

describe('IN-RENT-POLICE-VERIFICATION', () => {
  it('fires on a police verification clause or in a metro city', () => {
    expect(ids(withText('The Tenant shall cooperate with police verification.'))).toContain(
      'IN-RENT-POLICE-VERIFICATION'
    );
    expect(ids({ interview: { ...interview, city: 'Bengaluru' } })).toContain(
      'IN-RENT-POLICE-VERIFICATION'
    );
  });
  it('stays silent elsewhere, and when the city is unknown', () => {
    expect(ids()).not.toContain('IN-RENT-POLICE-VERIFICATION');
    expect(ids({ interview: { ...interview, city: null } })).not.toContain(
      'IN-RENT-POLICE-VERIFICATION'
    );
  });
});

describe('IN-RENT-DISPUTE', () => {
  const noDispute = NEUTRAL.filter(t => !t.includes('dispute'));
  it('fires offline when disputes are never mentioned, or when AI says not present', () => {
    expect(ids({ texts: noDispute })).toContain('IN-RENT-DISPUTE');
    expect(ids({ aiChecked: true, gaps: aiGaps({ DISPUTE_RESOLUTION: 'unclear' }) })).toContain(
      'IN-RENT-DISPUTE'
    );
  });
  it('stays silent with an arbitration or court clause', () => {
    expect(ids()).not.toContain('IN-RENT-DISPUTE');
    expect(ids({ texts: [...noDispute, 'Matters go to arbitration in Pune.'] })).not.toContain(
      'IN-RENT-DISPUTE'
    );
  });
});

describe('runRules', () => {
  it('replaces every token occurrence and falls back to "your city"', () => {
    const hits = runRules(
      ctx({ ...withText('No guests are allowed.'), interview: { ...interview, city: null } })
    );
    for (const h of hits) {
      expect(h.message).not.toMatch(/\{\{\w+\}\}/);
      for (const q of h.questions) expect(q).not.toMatch(/\{\{\w+\}\}/);
    }
  });

  it('leaves clauseId null for rules that are about something missing', () => {
    const h = hit('IN-RENT-SALE-OF-PROPERTY', { texts: NEUTRAL.filter(t => !t.includes('sold')) })!;
    expect(h.clauseId).toBeNull();
  });
});

describe('the sample agreement, offline', () => {
  it('flags every deliberate problem and nothing the agreement actually covers', () => {
    const clauses = segmentClauses(SAMPLE_PAGES.join('\n'), SAMPLE_PAGES);
    const hits = runRules({ clauses, matches: [], gaps: [], interview, aiChecked: false });
    expect(hits.map(h => h.ruleId).sort()).toEqual(
      [
        'IN-RENT-DEPOSIT-HIGH',
        'IN-RENT-DEPOSIT-NO-TIMELINE',
        'IN-RENT-DEPOSIT-DISCRETION',
        'IN-RENT-LOCKIN-LONG',
        'IN-RENT-ENTRY-NO-NOTICE',
        'IN-RENT-EVICTION-SELF-HELP',
        'IN-RENT-REPAIRS-ON-TENANT',
        'IN-RENT-REGISTRATION',
        'IN-RENT-GUEST-RESTRICTION',
        'IN-RENT-SUBLET-SHARING',
        'IN-RENT-SALE-OF-PROPERTY',
      ].sort()
    );
    expect(hits.find(h => h.ruleId === 'IN-RENT-LOCKIN-LONG')!.severity).toBe('HIGH');
    expect(hits.find(h => h.ruleId === 'IN-RENT-DEPOSIT-HIGH')!.message).toContain('3 months');
  });
});

describe('buildGapRows / PROTECTIONS', () => {
  it('has 20 protections with unique ids', () => {
    expect(PROTECTIONS).toHaveLength(20);
    expect(PROTECTION_IDS).toEqual(Array.from(new Set(PROTECTION_IDS)));
  });

  it('attaches the evidence verified for that exact quote, and defaults to unclear', () => {
    const quote = 'Deposit refunded within 15 days.';
    const verified = new Map([
      [evidenceKey('c010', quote), { clauseId: 'c010', quote, status: 'verified' as const }],
    ]);
    const rows = buildGapRows(
      [
        { id: 'DEPOSIT_REFUND_TIMELINE', state: 'present', summary: 'x', clauseId: 'c010', quote },
        { id: 'RENT_AMOUNT', state: 'absent', summary: null, clauseId: null, quote: null },
        { id: 'LOCK_IN', state: 'unclear', summary: null, clauseId: 'c010', quote: 'other text' },
      ],
      verified
    );
    expect(rows).toHaveLength(20);
    const timeline = rows.find(r => r.id === 'DEPOSIT_REFUND_TIMELINE')!;
    expect(timeline.state).toBe('present');
    expect(timeline.evidence?.status).toBe('verified');
    expect(timeline.requestWording).toContain('15 days');
    expect(rows.find(r => r.id === 'LOCK_IN')!.evidence).toBeNull();
    expect(rows.find(r => r.id === 'SUBLET_GUESTS')!.state).toBe('unclear');
  });
});
