/**
 * India rental rule library (LEGAL_RULES.md §2) — pure functions, human-written text.
 *
 * Rules judge the agreement, never the interview: numbers come from `extract.ts` (the clause
 * text) with the model's verified findings as a fallback. When the protection checklist has not
 * been AI-checked (local/offline mode), checklist-based triggers use a conservative text test
 * instead of treating "unclear" as "missing" — otherwise every agreement would be flagged.
 */

import type { Clause, RuleHit, MatchRow, GapRow, NormalisedAnswers, Severity } from '../types.js';
import { extractFacts, periodDays } from './extract.js';

export interface RuleContext {
  clauses: Clause[];
  matches: MatchRow[];
  gaps: GapRow[];
  interview: NormalisedAnswers;
  /** True when `gaps` came from a model check; false in local/offline mode. */
  aiChecked: boolean;
  derived: Derived;
}

export interface Derived {
  /** Deposit in months of rent, as written in the agreement. */
  depositMonths: number | null;
  /** Monthly rent: the agreement's figure, else the user's (used only for the TDS note). */
  monthlyRent: number | null;
  lockInDays: number | null;
  noticeTenantDays: number | null;
  noticeLandlordDays: number | null;
  durationDays: number | null;
  /** Clauses the numbers above were read from, so rule cards can cite them. */
  sources: Partial<Record<'deposit' | 'lockIn' | 'notice' | 'duration', Clause>>;
}

export interface RentalRule {
  id: string;
  test: (ctx: RuleContext) => boolean;
  /** The clause that triggered the rule, when there is one to cite. */
  locate?: (ctx: RuleContext) => Clause | null | undefined;
  severity: (ctx: RuleContext) => Severity;
  title: string;
  message: string; // supports {{n}}, {{city}}, {{item}} tokens
  basis: string;
  questions: string[];
  lastReviewed: string;
  stateVariesNote: true;
}

type DerivedInput = Pick<RuleContext, 'clauses' | 'matches' | 'gaps' | 'interview'>;

/**
 * Numbers the rules need. The agreement text wins; a verified model finding is the fallback;
 * the interview is only used for the monthly rent behind the TDS note.
 */
export function buildDerived(ctx: DerivedInput): Derived {
  const facts = extractFacts(ctx.clauses);
  const fromMatch = (key: string): number | null => {
    const written = ctx.matches.find(
      m => m.key === key && m.written !== null && m.evidence?.status !== 'unverified'
    )?.written;
    return written ? periodDays(written) : null;
  };
  const landlordQuote = ctx.gaps.find(g => g.id === 'NOTICE_LANDLORD')?.evidence?.quote;

  const sources: Derived['sources'] = {};
  if (facts.deposit) sources.deposit = facts.deposit.clause;
  if (facts.lockInDays) sources.lockIn = facts.lockInDays.clause;
  if (facts.durationDays) sources.duration = facts.durationDays.clause;
  const noticeClause = facts.noticeTenantDays?.clause ?? facts.noticeLandlordDays?.clause;
  if (noticeClause) sources.notice = noticeClause;

  return {
    depositMonths: facts.deposit?.value.months ?? null,
    monthlyRent: facts.rent?.value ?? ctx.interview.monthlyRent,
    lockInDays: facts.lockInDays?.value ?? fromMatch('lockIn'),
    noticeTenantDays: facts.noticeTenantDays?.value ?? fromMatch('noticePeriod'),
    noticeLandlordDays:
      facts.noticeLandlordDays?.value ?? (landlordQuote ? periodDays(landlordQuote) : null),
    durationDays: facts.durationDays?.value ?? fromMatch('duration'),
    sources,
  };
}

function findClause(ctx: RuleContext, patterns: RegExp[]): Clause | null {
  return ctx.clauses.find(c => patterns.some(p => p.test(c.text))) ?? null;
}

const anyClause = (ctx: RuleContext, patterns: RegExp[]): boolean =>
  findClause(ctx, patterns) !== null;

/** Checklist state, or 'unknown' when the checklist was never AI-checked. */
function protection(ctx: RuleContext, id: string): GapRow['state'] | 'unknown' {
  if (!ctx.aiChecked) return 'unknown';
  return ctx.gaps.find(g => g.id === id)?.state ?? 'unclear';
}

const DEPOSIT_CLAUSE = [/\b(security deposit|deposit of|refundable deposit)\b/i];
// [\s\S] rather than [^.]: "Rs. 50,000" puts a full stop in the middle of the sentence.
const REFUND_TIMELINE = [
  /\b(refund|return|repa)\w*\b[\s\S]{0,100}?\bwithin\s+\S+\s*(\(\s*\d+\s*\)\s*)?(days?|weeks?|months?)\b/i,
  /\bwithin\s+\S+\s*(\(\s*\d+\s*\)\s*)?(days?|weeks?)\b[\s\S]{0,100}?\b(refund|return|repa)\w*/i,
];
const DISCRETION = [
  /sole discretion/i,
  /as determined by the (owner|licensor|landlord)/i,
  /deemed (fit|necessary)/i,
];
const FORFEIT = [/forfeit[^.]*deposit/i, /deposit[^.]*forfeit/i, /lose[^.]*deposit/i];
const ENTRY = String.raw`(enter|entry|inspect\w*|visit\w*)`;
const ENTRY_ANYTIME = [
  new RegExp(String.raw`\b${ENTRY}\b[^.]{0,60}(at any time|without (any )?(prior )?notice)`, 'i'),
  new RegExp(String.raw`(at any time|without (any )?(prior )?notice)[^.]{0,60}\b${ENTRY}\b`, 'i'),
];
const ENTRY_WITH_NOTICE = [
  new RegExp(String.raw`\b${ENTRY}\b[^.]{0,100}\bnotice\b`, 'i'),
  new RegExp(String.raw`\bnotice\b[^.]{0,100}\b${ENTRY}\b`, 'i'),
];
const ESSENTIAL_CUTOFF = [
  /\b(disconnect|cut off|withhold|discontinue)\w*\b[^.]{0,40}\b(water|electricity|power|supply|supplies|amenities)\b/i,
];
const SELF_HELP_EVICTION =
  /\b(licensor|landlord|owner)\b[^.]{0,80}\b(re-?enter|take (back )?(the )?possession|lock (out|the premises)|remove[^.]{0,20}\b(goods|belongings|articles))/i;
const LEGAL_PROCESS =
  /\b(court|tribunal|rent authority|due process|process of law|in accordance with law)\b/i;
const REPAIRS_ON_TENANT = [
  /\b(tenant|licensee|lessee)\b[^.]{0,60}\bresponsible\b[^.]{0,60}\b(all repairs|structural|major)/i,
  /\ball repairs\b[^.]{0,60}\b(tenant|licensee|lessee)\b/i,
  /\b(structural|major) repairs?\b[^.]{0,60}\b(borne|paid|done) by the (tenant|licensee|lessee)\b/i,
];
const INCREASE_UNCAPPED = [
  /\b(revise|increase|escalate)\w*\b[^.]{0,40}\brent\b[^.]{0,60}\b(sole discretion|from time to time|as (decided|determined) by the (owner|licensor|landlord))/i,
  /\brent\b[^.]{0,40}\b(increase|revis)\w*\b[^.]{0,40}\bwithout (any )?limit/i,
];
const GUEST_RULES: Array<[RegExp, string]> = [
  [/\bno (visitors|guests)\b/i, 'visitors'],
  [/\bnot (permit|allow)\b[^.]{0,20}\b(visitors|guests)\b/i, 'visitors'],
  [/\b(visitors|guests)\b[^.]{0,40}\bafter\s+\d/i, 'visitors'],
  [/\bopposite sex\b/i, 'visitors of the opposite sex'],
  [/\bnon-?veg/i, 'non-vegetarian food'],
  [/\bunmarried\b/i, 'unmarried occupants'],
  [/\bpets?\b[^.]{0,30}\bnot (allowed|permitted)\b/i, 'pets'],
];
const SUBLET = [
  /\bsub-?let/i,
  /\bpart with possession\b/i,
  /\bshall not allow any other person\b/i,
];
const SALE_OF_PROPERTY = [
  /\b(sale|sell|sold|transfer)\b[^.]{0,60}\b(property|premises|flat|house)\b/i,
  /\b(property|premises|flat|house)\b[^.]{0,60}\b(sold|sale|transferred)\b/i,
];
const MAINTENANCE_WORDS = [
  /\bmaintenance charges?\b/i,
  /\boutgoings\b/i,
  /\bproperty tax\b/i,
  /\b(electricity|water) (charges|bills?)\b/i,
];
const DISPUTE_WORDS = [/\barbitrat/i, /\bjurisdiction\b/i, /\bcourts?\b/i, /\bdisputes?\b/i];
const POLICE = [/\bpolice verification\b/i];
const METROS = [
  'mumbai',
  'delhi',
  'bengaluru',
  'bangalore',
  'chennai',
  'kolkata',
  'hyderabad',
  'pune',
  'ahmedabad',
];

function guestHit(ctx: RuleContext): { clause: Clause; item: string } | null {
  for (const clause of ctx.clauses) {
    const hit = GUEST_RULES.find(([re]) => re.test(clause.text));
    if (hit) return { clause, item: hit[1] };
  }
  return null;
}

function selfHelpClause(ctx: RuleContext): Clause | null {
  return (
    ctx.clauses.find(c => SELF_HELP_EVICTION.test(c.text) && !LEGAL_PROCESS.test(c.text)) ?? null
  );
}

/** All rental rules — ordered by severity (HIGH first) */
export const RENTAL_RULES: RentalRule[] = [
  {
    id: 'IN-RENT-DEPOSIT-HIGH',
    test: ctx => ctx.derived.depositMonths !== null && ctx.derived.depositMonths >= 3,
    locate: ctx => ctx.derived.sources.deposit,
    severity: () => 'HIGH',
    title: 'Deposit larger than the common norm',
    message:
      "Your deposit is about {{n}} months of rent. The Model Tenancy Act, 2021 suggests a cap of two months' rent for residential tenancies, and two to three months is the common practice in much of India, though some cities ask for more. A larger deposit means more of your money is locked with the owner, so it's worth negotiating or at least pinning down exactly how and when it comes back.",
    basis:
      'Model Tenancy Act, 2021 (a model law — it applies only where a state has adopted it); local practice.',
    questions: [
      'Would you consider two months instead?',
      'When exactly will the deposit be returned after I hand over the keys?',
    ],
    lastReviewed: '2025-01-15',
    stateVariesNote: true,
  },
  {
    id: 'IN-RENT-DEPOSIT-NO-TIMELINE',
    test: ctx => {
      const state = protection(ctx, 'DEPOSIT_REFUND_TIMELINE');
      if (state !== 'unknown') return state === 'absent' || state === 'unclear';
      return anyClause(ctx, DEPOSIT_CLAUSE) && !anyClause(ctx, REFUND_TIMELINE);
    },
    locate: ctx => findClause(ctx, DEPOSIT_CLAUSE),
    severity: () => 'HIGH',
    title: 'No deadline for returning the deposit',
    message:
      "The agreement doesn't say *when* your deposit must be returned. This is the single most common source of rental disputes. Ask for a specific number of days after you hand over possession, written into the agreement.",
    basis:
      'Model Tenancy Act, 2021 (deposit refundable at the time of taking vacant possession, after permitted deductions); contract terms.',
    questions: [
      'Can we write: the deposit will be refunded within 15 days of handing over the keys?',
    ],
    lastReviewed: '2025-01-15',
    stateVariesNote: true,
  },
  {
    id: 'IN-RENT-DEPOSIT-DISCRETION',
    test: ctx =>
      anyClause(ctx, DISCRETION) && protection(ctx, 'DEPOSIT_DEDUCTION_BASIS') !== 'present',
    locate: ctx => findClause(ctx, DISCRETION),
    severity: () => 'HIGH',
    title: 'Deductions decided only by the owner',
    message:
      'The agreement lets the owner decide deductions without a stated basis. Ask for deductions to be limited to unpaid rent, unpaid bills, and damage beyond normal wear and tear, supported by bills or photos.',
    basis: 'Contract terms; Model Tenancy Act, 2021 schedule of permitted deductions.',
    questions: [
      'Can deductions be limited to unpaid dues and actual damage, with receipts shared?',
    ],
    lastReviewed: '2025-01-15',
    stateVariesNote: true,
  },
  {
    id: 'IN-RENT-LOCKIN-LONG',
    test: ctx => {
      const { lockInDays, durationDays } = ctx.derived;
      if (lockInDays === null) return false;
      return lockInDays >= 180 || (durationDays !== null && lockInDays >= durationDays / 2);
    },
    locate: ctx => ctx.derived.sources.lockIn,
    severity: ctx => (anyClause(ctx, FORFEIT) ? 'HIGH' : 'MEDIUM'),
    title: 'Long minimum stay',
    message:
      'A lock-in period means leaving early can cost you rent or part of your deposit even if you give notice. Check whether the lock-in applies to both sides, and what exactly you owe if you must leave early.',
    basis: 'Contract terms; consumer protection principles.',
    questions: [
      'Does the lock-in apply to the owner too?',
      'If I leave early, is it the remaining rent or a fixed amount?',
    ],
    lastReviewed: '2025-01-15',
    stateVariesNote: true,
  },
  {
    id: 'IN-RENT-NOTICE-ASYMMETRIC',
    test: ctx => {
      const { noticeTenantDays: tenant, noticeLandlordDays: landlord } = ctx.derived;
      return tenant !== null && landlord !== null && tenant > landlord;
    },
    locate: ctx => ctx.derived.sources.notice,
    severity: () => 'MEDIUM',
    title: 'Unequal notice periods',
    message:
      'You must give more notice than the owner. Where an agreement is silent, the Transfer of Property Act, 1882 provides a 15-day notice for month-to-month tenancies, but a written agreement usually overrides that. Equal notice on both sides is a reasonable thing to ask for.',
    basis: 'Transfer of Property Act, 1882, s.106; contract terms.',
    questions: ['Can we make the notice period the same for both of us?'],
    lastReviewed: '2025-01-15',
    stateVariesNote: true,
  },
  {
    id: 'IN-RENT-ENTRY-NO-NOTICE',
    test: ctx => {
      if (anyClause(ctx, ENTRY_ANYTIME)) return true;
      const state = protection(ctx, 'ENTRY_NOTICE');
      return state === 'unknown' ? !anyClause(ctx, ENTRY_WITH_NOTICE) : state === 'absent';
    },
    locate: ctx => findClause(ctx, ENTRY_ANYTIME),
    severity: () => 'HIGH',
    title: 'Owner can enter without notice',
    message:
      "The agreement doesn't require the owner to give notice before entering. The Model Tenancy Act, 2021 provides for at least 24 hours' written notice before entry, and that is a fair benchmark to ask for even where the Act hasn't been adopted.",
    basis: 'Model Tenancy Act, 2021.',
    questions: ["Can we add 24 hours' written notice before any visit, except emergencies?"],
    lastReviewed: '2025-01-15',
    stateVariesNote: true,
  },
  {
    id: 'IN-RENT-ESSENTIAL-SERVICES',
    test: ctx => anyClause(ctx, ESSENTIAL_CUTOFF),
    locate: ctx => findClause(ctx, ESSENTIAL_CUTOFF),
    severity: () => 'HIGH',
    title: 'Cutting water or power as a remedy',
    message:
      "This clause suggests the owner may cut essential supplies if there's a dispute. The Model Tenancy Act, 2021 specifically bars withholding essential supplies, and this is widely treated as unacceptable. Ask for it to be removed, and speak to a lawyer if it ever happens.",
    basis: 'Model Tenancy Act, 2021.',
    questions: ['Can this clause be removed?'],
    lastReviewed: '2025-01-15',
    stateVariesNote: true,
  },
  {
    id: 'IN-RENT-EVICTION-SELF-HELP',
    test: ctx => selfHelpClause(ctx) !== null,
    locate: selfHelpClause,
    severity: () => 'HIGH',
    title: 'Locking out or removing belongings',
    message:
      'The agreement appears to allow the owner to take back possession directly. Eviction in India generally has to follow a legal process through the appropriate court, tribunal or rent authority. If you ever face a lock-out, get legal help immediately.',
    basis:
      'State rent control legislation; Model Tenancy Act, 2021 (rent authority/tribunal process).',
    questions: [
      'Can we state that possession will be taken back only through the process allowed by law?',
    ],
    lastReviewed: '2025-01-15',
    stateVariesNote: true,
  },
  {
    id: 'IN-RENT-REPAIRS-ON-TENANT',
    test: ctx => anyClause(ctx, REPAIRS_ON_TENANT),
    locate: ctx => findClause(ctx, REPAIRS_ON_TENANT),
    severity: () => 'MEDIUM',
    title: 'All repairs pushed to the renter',
    message:
      'Normally structural and major repairs (walls, roof, plumbing, wiring) stay with the owner, while the renter handles small day-to-day fixes. This agreement shifts more to you. Ask for a split with a rupee threshold.',
    basis:
      'Transfer of Property Act, 1882, s.108 (rights and liabilities in the absence of contract); Model Tenancy Act, 2021 (schedule of repair responsibilities).',
    questions: ["Can repairs above ₹2,000 be the owner's responsibility?"],
    lastReviewed: '2025-01-15',
    stateVariesNote: true,
  },
  {
    id: 'IN-RENT-INCREASE-UNCAPPED',
    test: ctx => anyClause(ctx, INCREASE_UNCAPPED),
    locate: ctx => findClause(ctx, INCREASE_UNCAPPED),
    severity: () => 'MEDIUM',
    title: 'Rent can be raised at will',
    message:
      'The agreement lets rent be raised without a fixed limit. A stated percentage on renewal (commonly around 5–10% a year in many cities) makes your costs predictable.',
    basis: 'Contract terms; local practice.',
    questions: ['Can we fix the increase at a specific percentage on renewal?'],
    lastReviewed: '2025-01-15',
    stateVariesNote: true,
  },
  {
    id: 'IN-RENT-MAINTENANCE-UNCLEAR',
    test: ctx => {
      const state = protection(ctx, 'MAINTENANCE_CHARGES');
      return state === 'unknown'
        ? !anyClause(ctx, MAINTENANCE_WORDS)
        : state === 'absent' || state === 'unclear';
    },
    severity: () => 'MEDIUM',
    title: 'Maintenance and bills not split clearly',
    message:
      "The agreement doesn't clearly say who pays society maintenance, water, electricity or property tax. This can lead to surprise monthly costs.",
    basis: 'Contract terms.',
    questions: [
      'Who pays society maintenance, water, electricity and property tax? Can we list each one?',
    ],
    lastReviewed: '2025-01-15',
    stateVariesNote: true,
  },
  {
    id: 'IN-RENT-REGISTRATION',
    test: ctx => {
      const { durationDays } = ctx.derived;
      return (
        (durationDays !== null && durationDays <= 330) ||
        protection(ctx, 'REGISTRATION_STAMPING') === 'absent'
      );
    },
    locate: ctx => ctx.derived.sources.duration,
    severity: () => 'INFO',
    title: '11 months, registration and stamping',
    message:
      "Agreements are often written for 11 months because, under the Registration Act, 1908, leases from year to year or for a term exceeding one year generally must be registered. Registration and stamp duty rules differ by state, and some states require registration of leave-and-licence agreements regardless of term. A registered or properly stamped agreement is far easier to rely on if there's ever a dispute.",
    basis:
      'Registration Act, 1908, s.17; Indian Stamp Act and state stamp laws; state-specific leave-and-licence rules.',
    questions: [
      'Will the agreement be registered, and who pays the stamp duty and registration fee?',
    ],
    lastReviewed: '2025-01-15',
    stateVariesNote: true,
  },
  {
    id: 'IN-RENT-GUEST-RESTRICTION',
    test: ctx => guestHit(ctx) !== null,
    locate: ctx => guestHit(ctx)?.clause,
    severity: () => 'MEDIUM',
    title: 'Limits on guests, visitors or lifestyle',
    message:
      'The agreement restricts who can visit or how you live in the home. These terms are common in practice but can be intrusive, and some kinds of restrictions raise fairness concerns. If a term would be hard for you to live with, raise it before signing rather than after.',
    basis: 'Contract terms; fairness principles.',
    questions: [
      'Can the restriction on {{item}} be removed or limited to overnight stays beyond a week?',
    ],
    lastReviewed: '2025-01-15',
    stateVariesNote: true,
  },
  {
    id: 'IN-RENT-SUBLET-SHARING',
    test: ctx => anyClause(ctx, SUBLET),
    locate: ctx => findClause(ctx, SUBLET),
    severity: ctx =>
      ctx.interview.extras.some(e => /flatmate|sharing/i.test(e)) ? 'MEDIUM' : 'INFO',
    title: 'Sharing the flat with flatmates',
    message:
      'The agreement restricts subletting or sharing possession. If you plan to have flatmates, check whether they need to be named.',
    basis: 'Contract terms.',
    questions: [
      'Are my named flatmates allowed under this clause?',
      'What if one flatmate moves out and another joins?',
    ],
    lastReviewed: '2025-01-15',
    stateVariesNote: true,
  },
  {
    id: 'IN-RENT-SALE-OF-PROPERTY',
    test: ctx => {
      const state = protection(ctx, 'SALE_OF_PROPERTY');
      return state === 'unknown' ? !anyClause(ctx, SALE_OF_PROPERTY) : state === 'absent';
    },
    severity: () => 'MEDIUM',
    title: 'If the owner sells the property',
    message:
      "The agreement doesn't say what happens if the property is sold during your tenancy. Ask for a line saying the agreement continues with the new owner for the remaining term.",
    basis: 'Transfer of Property Act, 1882, s.109; contract terms.',
    questions: ['If the flat is sold, does my agreement continue with the new owner?'],
    lastReviewed: '2025-01-15',
    stateVariesNote: true,
  },
  {
    id: 'IN-RENT-TDS',
    test: ctx => ctx.derived.monthlyRent !== null && ctx.derived.monthlyRent > 50000,
    severity: () => 'INFO',
    title: 'Tax deduction when rent is high',
    message:
      'Where monthly rent crosses ₹50,000, income-tax rules can require the tenant to deduct tax at source when paying rent. Rates and procedures change, so confirm the current position with a tax professional or the Income Tax portal, and check whether the agreement says who handles it.',
    basis: 'Income-tax Act, 1961, s.194-IB (verify the current rate and threshold before release).',
    questions: ['Who will handle TDS, and do you have a PAN to share for it?'],
    lastReviewed: '2025-01-15',
    stateVariesNote: true,
  },
  {
    id: 'IN-RENT-POLICE-VERIFICATION',
    test: ctx => {
      const city = ctx.interview.city?.toLowerCase() ?? '';
      return anyClause(ctx, POLICE) || METROS.some(m => city.includes(m));
    },
    locate: ctx => findClause(ctx, POLICE),
    severity: () => 'INFO',
    title: 'Tenant verification',
    message:
      "Many states require tenant verification with the local police. It's usually the owner's responsibility to file it, with documents from you.",
    basis: 'State police acts and local rules.',
    questions: [
      'Will you complete the police verification, and what documents do you need from me?',
    ],
    lastReviewed: '2025-01-15',
    stateVariesNote: true,
  },
  {
    id: 'IN-RENT-DISPUTE',
    test: ctx => {
      const state = protection(ctx, 'DISPUTE_RESOLUTION');
      return state === 'unknown' ? !anyClause(ctx, DISPUTE_WORDS) : state !== 'present';
    },
    severity: () => 'INFO',
    title: 'Where disputes go',
    message:
      "The agreement doesn't specify where disputes will be decided. This affects cost and convenience if something goes wrong.",
    basis: 'Arbitration and Conciliation Act, 1996; state rent authority rules.',
    questions: ['If we ever disagree, where is it decided, and who pays the cost?'],
    lastReviewed: '2025-01-15',
    stateVariesNote: true,
  },
];

/** Fills {{n}}, {{city}} and {{item}} everywhere they appear. */
function fill(text: string, tokens: Record<'n' | 'city' | 'item', string>): string {
  return text.replace(/\{\{(n|city|item)\}\}/g, (_, name: 'n' | 'city' | 'item') => tokens[name]);
}

/** Run all rules and return hits, each citing its clause when one triggered it. */
export function runRules(ctx: Omit<RuleContext, 'derived'>): RuleHit[] {
  const full: RuleContext = { ...ctx, derived: buildDerived(ctx) };
  const tokens = {
    n: full.derived.depositMonths?.toString() ?? '',
    city: full.interview.city ?? 'your city',
    item: guestHit(full)?.item ?? 'guests',
  };
  return RENTAL_RULES.filter(rule => rule.test(full)).map(rule => ({
    ruleId: rule.id,
    clauseId: rule.locate?.(full)?.id ?? null,
    severity: rule.severity(full),
    title: rule.title,
    message: fill(rule.message, tokens),
    basis: rule.basis,
    questions: rule.questions.map(q => fill(q, tokens)),
    lastReviewed: rule.lastReviewed,
  }));
}
