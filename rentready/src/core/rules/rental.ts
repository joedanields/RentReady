/** India rental rule library — pure functions, human-written text, 100% tested */

import type { Clause, RuleHit, MatchRow, GapRow, NormalisedAnswers } from '../types.js';

export interface RuleContext {
  clauses: Clause[];
  matches: MatchRow[];
  gaps: GapRow[];
  interview: NormalisedAnswers;
  derived: {
    depositMonths: number | null;
    monthlyRent: number | null;
    lockInDays: number | null;
    noticeTenantDays: number | null;
    noticeLandlordDays: number | null;
    durationDays: number | null;
  };
}

export interface RentalRule {
  id: string;
  test: (ctx: RuleContext) => boolean;
  severity: (ctx: RuleContext) => 'HIGH' | 'MEDIUM' | 'INFO';
  title: string;
  message: string; // supports {{n}}, {{city}}, {{item}} tokens
  basis: string;
  questions: string[];
  lastReviewed: string;
  stateVariesNote: true;
}

/** Build derived values for rule evaluation */
export function buildDerived(ctx: RuleContext): RuleContext['derived'] {
  const depositMonths = ctx.interview.deposit?.months ?? null;
  const monthlyRent = ctx.interview.monthlyRent ?? null;
  const lockInDays = ctx.interview.lockIn ?? null;

  let noticeTenantDays: number | null = null;
  let noticeLandlordDays: number | null = null;

  for (const m of ctx.matches) {
    if (m.key === 'noticePeriod' && m.written) {
      noticeTenantDays = parseNoticePeriod(m.written);
    }
  }

  for (const g of ctx.gaps) {
    if (g.id === 'NOTICE_LANDLORD' && g.evidence?.quote) {
      noticeLandlordDays = parseNoticePeriod(g.evidence.quote);
    }
  }

  return {
    depositMonths,
    monthlyRent,
    lockInDays,
    noticeTenantDays,
    noticeLandlordDays,
    durationDays: ctx.interview.duration ?? null
  };
}

function parseNoticePeriod(text: string): number | null {
  const cleaned = text.trim().toLowerCase();
  if (cleaned === '15 days') return 15;
  if (cleaned === '1 month') return 30;
  if (cleaned === '2 months') return 60;
  const dayMatch = cleaned.match(/(\d+)\s*days?/);
  if (dayMatch) return parseInt(dayMatch[1]!, 10);
  const monthMatch = cleaned.match(/(\d+)\s*months?/);
  if (monthMatch) return parseInt(monthMatch[1]!, 10) * 30;
  return null;
}

function findClauseText(ctx: RuleContext, patterns: RegExp[]): { clause: Clause; text: string } | null {
  for (const clause of ctx.clauses) {
    const text = clause.text.toLowerCase();
    if (patterns.some(p => p.test(text))) {
      return { clause, text: clause.text };
    }
  }
  return null;
}

function hasProtection(ctx: RuleContext, id: string): 'present' | 'absent' | 'unclear' {
  const gap = ctx.gaps.find(g => g.id === id);
  return gap?.state ?? 'unclear';
}

/** All rental rules — ordered by severity (HIGH first) */
export const RENTAL_RULES: RentalRule[] = [
  {
    id: 'IN-RENT-DEPOSIT-HIGH',
    test: (ctx) => ctx.derived.depositMonths !== null && ctx.derived.depositMonths >= 3,
    severity: () => 'HIGH',
    title: 'Deposit larger than the common norm',
    message: 'Your deposit is about {{n}} months of rent. The Model Tenancy Act, 2021 suggests a cap of two months\' rent for residential tenancies, and two to three months is the common practice in much of India, though some cities ask for more. A larger deposit means more of your money is locked with the owner, so it\'s worth negotiating or at least pinning down exactly how and when it comes back.',
    basis: 'Model Tenancy Act, 2021 (a model law — it applies only where a state has adopted it); local practice.',
    questions: ['Would you consider two months instead?', 'When exactly will the deposit be returned after I hand over the keys?'],
    lastReviewed: '2025-01-15',
    stateVariesNote: true
  },
  {
    id: 'IN-RENT-DEPOSIT-NO-TIMELINE',
    test: (ctx) => hasProtection(ctx, 'DEPOSIT_REFUND_TIMELINE') === 'absent' || hasProtection(ctx, 'DEPOSIT_REFUND_TIMELINE') === 'unclear',
    severity: () => 'HIGH',
    title: 'No deadline for returning the deposit',
    message: 'The agreement doesn\'t say *when* your deposit must be returned. This is the single most common source of rental disputes. Ask for a specific number of days after you hand over possession, written into the agreement.',
    basis: 'Model Tenancy Act, 2021 (deposit refundable at the time of taking vacant possession, after permitted deductions); contract terms.',
    questions: ['Can we write: the deposit will be refunded within 15 days of handing over the keys?'],
    lastReviewed: '2025-01-15',
    stateVariesNote: true
  },
  {
    id: 'IN-RENT-DEPOSIT-DISCRETION',
    test: (ctx) => {
      const found = findClauseText(ctx, [
        /sole discretion/,
        /as determined by the (owner|licensor|landlord)/i,
        /deemed (fit|necessary)/i
      ]);
      return found !== null && hasProtection(ctx, 'DEPOSIT_DEDUCTION_BASIS') !== 'present';
    },
    severity: () => 'HIGH',
    title: 'Deductions decided only by the owner',
    message: 'The agreement lets the owner decide deductions without a stated basis. Ask for deductions to be limited to unpaid rent, unpaid bills, and damage beyond normal wear and tear, supported by bills or photos.',
    basis: 'Contract terms; Model Tenancy Act, 2021 schedule of permitted deductions.',
    questions: ['Can deductions be limited to unpaid dues and actual damage, with receipts shared?'],
    lastReviewed: '2025-01-15',
    stateVariesNote: true
  },
  {
    id: 'IN-RENT-LOCKIN-LONG',
    test: (ctx) => {
      if (ctx.derived.lockInDays === null) return false;
      const lockInMonths = ctx.derived.lockInDays / 30;
      const durationMonths = ctx.derived.durationDays ? ctx.derived.durationDays / 30 : null;
      return lockInMonths >= 6 || (durationMonths !== null && lockInMonths >= durationMonths / 2);
    },
    severity: (ctx) => {
      // Check if penalty is full deposit forfeiture
      const found = findClauseText(ctx, [
        /forfeit.*deposit/i,
        /deposit.*forfeit/i,
        /lose.*deposit/i
      ]);
      return found ? 'HIGH' : 'MEDIUM';
    },
    title: 'Long minimum stay',
    message: 'A lock-in period means leaving early can cost you rent or part of your deposit even if you give notice. Check whether the lock-in applies to both sides, and what exactly you owe if you must leave early.',
    basis: 'Contract terms; consumer protection principles.',
    questions: ['Does the lock-in apply to the owner too?', 'If I leave early, is it the remaining rent or a fixed amount?'],
    lastReviewed: '2025-01-15',
    stateVariesNote: true
  },
  {
    id: 'IN-RENT-NOTICE-ASYMMETRIC',
    test: (ctx) => {
      const tenant = ctx.derived.noticeTenantDays;
      const landlord = ctx.derived.noticeLandlordDays;
      return tenant !== null && landlord !== null && tenant > landlord;
    },
    severity: () => 'MEDIUM',
    title: 'Unequal notice periods',
    message: 'You must give more notice than the owner. Where an agreement is silent, the Transfer of Property Act, 1882 provides a 15-day notice for month-to-month tenancies, but a written agreement usually overrides that. Equal notice on both sides is a reasonable thing to ask for.',
    basis: 'Transfer of Property Act, 1882, s.106; contract terms.',
    questions: ['Can we make the notice period the same for both of us?'],
    lastReviewed: '2025-01-15',
    stateVariesNote: true
  },
  {
    id: 'IN-RENT-ENTRY-NO-NOTICE',
    test: (ctx) => {
      const entryNoticeState = hasProtection(ctx, 'ENTRY_NOTICE');
      if (entryNoticeState === 'absent') return true;

      const found = findClauseText(ctx, [
        /at any time/i,
        /without prior notice/i,
        /no notice/i
      ]);
      return found !== null;
    },
    severity: () => 'HIGH',
    title: 'Owner can enter without notice',
    message: 'The agreement doesn\'t require the owner to give notice before entering. The Model Tenancy Act, 2021 provides for at least 24 hours\' written notice before entry, and that is a fair benchmark to ask for even where the Act hasn\'t been adopted.',
    basis: 'Model Tenancy Act, 2021.',
    questions: ['Can we add 24 hours\' written notice before any visit, except emergencies?'],
    lastReviewed: '2025-01-15',
    stateVariesNote: true
  },
  {
    id: 'IN-RENT-ESSENTIAL-SERVICES',
    test: (ctx) => findClauseText(ctx, [
      /disconnect.*(water|electricity|power|supply|amenities)/i,
      /cut off.*(water|electricity|power|supply)/i,
      /withhold.*(water|electricity|power|supply)/i,
      /discontinue.*(water|electricity|power|supply)/i
    ]) !== null,
    severity: () => 'HIGH',
    title: 'Cutting water or power as a remedy',
    message: 'This clause suggests the owner may cut essential supplies if there\'s a dispute. The Model Tenancy Act, 2021 specifically bars withholding essential supplies, and this is widely treated as unacceptable. Ask for it to be removed, and speak to a lawyer if it ever happens.',
    basis: 'Model Tenancy Act, 2021.',
    questions: ['Can this clause be removed?'],
    lastReviewed: '2025-01-15',
    stateVariesNote: true
  },
  {
    id: 'IN-RENT-EVICTION-SELF-HELP',
    test: (ctx) => findClauseText(ctx, [
      /re-?enter.*(without|not).*(court|tribunal|rent authorit)/i,
      /take possession.*(without|not).*(court|tribunal|rent authorit)/i,
      /lock.*(out|the premises).*(without|not).*(court|tribunal)/i,
      /remove.*(goods|belongings|articles).*(without|not).*(court|tribunal)/i
    ]) !== null,
    severity: () => 'HIGH',
    title: 'Locking out or removing belongings',
    message: 'The agreement appears to allow the owner to take back possession directly. Eviction in India generally has to follow a legal process through the appropriate court, tribunal or rent authority. If you ever face a lock-out, get legal help immediately.',
    basis: 'State rent control legislation; Model Tenancy Act, 2021 (rent authority/tribunal process).',
    questions: ['Can we state that possession will be taken back only through the process allowed by law?'],
    lastReviewed: '2025-01-15',
    stateVariesNote: true
  },
  {
    id: 'IN-RENT-REPAIRS-ON-TENANT',
    test: (ctx) => findClauseText(ctx, [
      /tenant.*responsible.*(all repairs|structural|major)/i,
      /licensee.*responsible.*(all repairs|structural|major)/i,
      /all repairs.*tenant/i,
      /structural.*tenant/i,
      /major.*repairs.*tenant/i
    ]) !== null,
    severity: () => 'MEDIUM',
    title: 'All repairs pushed to the renter',
    message: 'Normally structural and major repairs (walls, roof, plumbing, wiring) stay with the owner, while the renter handles small day-to-day fixes. This agreement shifts more to you. Ask for a split with a rupee threshold.',
    basis: 'Transfer of Property Act, 1882, s.108 (rights and liabilities in the absence of contract); Model Tenancy Act, 2021 (schedule of repair responsibilities).',
    questions: ['Can repairs above ₹2,000 be the owner\'s responsibility?'],
    lastReviewed: '2025-01-15',
    stateVariesNote: true
  },
  {
    id: 'IN-RENT-INCREASE-UNCAPPED',
    test: (ctx) => findClauseText(ctx, [
      /revise.*rent.*sole discretion/i,
      /increase.*rent.*from time to time/i,
      /escalate.*rent.*as decided by the owner/i,
      /rent.*increase.*without limit/i
    ]) !== null,
    severity: () => 'MEDIUM',
    title: 'Rent can be raised at will',
    message: 'The agreement lets rent be raised without a fixed limit. A stated percentage on renewal (commonly around 5–10% a year in many cities) makes your costs predictable.',
    basis: 'Contract terms; local practice.',
    questions: ['Can we fix the increase at a specific percentage on renewal?'],
    lastReviewed: '2025-01-15',
    stateVariesNote: true
  },
  {
    id: 'IN-RENT-MAINTENANCE-UNCLEAR',
    test: (ctx) => {
      const state = hasProtection(ctx, 'MAINTENANCE_CHARGES');
      if (state === 'absent' || state === 'unclear') return true;

      const found = findClauseText(ctx, [
        /society maintenance.*owner/i,
        /property tax.*owner/i,
        /maintenance charges.*tenant/i
      ]);
      return found === null;
    },
    severity: () => 'MEDIUM',
    title: 'Maintenance and bills not split clearly',
    message: 'The agreement doesn\'t clearly say who pays society maintenance, water, electricity or property tax. This can lead to surprise monthly costs.',
    basis: 'Contract terms.',
    questions: ['Who pays society maintenance, water, electricity and property tax? Can we list each one?'],
    lastReviewed: '2025-01-15',
    stateVariesNote: true
  },
  {
    id: 'IN-RENT-REGISTRATION',
    test: (ctx) => {
      const durationMonths = ctx.derived.durationDays ? ctx.derived.durationDays / 30 : null;
      const regState = hasProtection(ctx, 'REGISTRATION_STAMPING');
      return (durationMonths !== null && durationMonths <= 11) || regState === 'absent';
    },
    severity: () => 'INFO',
    title: '11 months, registration and stamping',
    message: 'Agreements are often written for 11 months because, under the Registration Act, 1908, leases from year to year or for a term exceeding one year generally must be registered. Registration and stamp duty rules differ by state, and some states require registration of leave-and-licence agreements regardless of term. A registered or properly stamped agreement is far easier to rely on if there\'s ever a dispute.',
    basis: 'Registration Act, 1908, s.17; Indian Stamp Act and state stamp laws; state-specific leave-and-licence rules.',
    questions: ['Will the agreement be registered, and who pays the stamp duty and registration fee?'],
    lastReviewed: '2025-01-15',
    stateVariesNote: true
  },
  {
    id: 'IN-RENT-GUEST-RESTRICTION',
    test: (ctx) => findClauseText(ctx, [
      /no (visitors|guests)/i,
      /opposite sex/i,
      /non-?veg/i,
      /unmarried/i,
      /pets.*not allowed/i
    ]) !== null,
    severity: () => 'MEDIUM',
    title: 'Limits on guests, visitors or lifestyle',
    message: 'The agreement restricts who can visit or how you live in the home. These terms are common in practice but can be intrusive, and some kinds of restrictions raise fairness concerns. If a term would be hard for you to live with, raise it before signing rather than after.',
    basis: 'Contract terms; fairness principles.',
    questions: ['Can the restriction on {{item}} be removed or limited to overnight stays beyond a week?'],
    lastReviewed: '2025-01-15',
    stateVariesNote: true
  },
  {
    id: 'IN-RENT-SUBLET-SHARING',
    test: (ctx) => findClauseText(ctx, [
      /sub-?let/i,
      /part with possession/i,
      /shall not allow any other person/i
    ]) !== null,
    severity: (ctx) => {
      const hasFlatmates = ctx.interview.extras.some(e => e.toLowerCase().includes('flatmate') || e.toLowerCase().includes('sharing'));
      return hasFlatmates ? 'MEDIUM' : 'INFO';
    },
    title: 'Sharing the flat with flatmates',
    message: 'The agreement restricts subletting or sharing possession. If you plan to have flatmates, check whether they need to be named.',
    basis: 'Contract terms.',
    questions: ['Are my named flatmates allowed under this clause?', 'What if one flatmate moves out and another joins?'],
    lastReviewed: '2025-01-15',
    stateVariesNote: true
  },
  {
    id: 'IN-RENT-SALE-OF-PROPERTY',
    test: (ctx) => hasProtection(ctx, 'SALE_OF_PROPERTY') === 'absent',
    severity: () => 'MEDIUM',
    title: 'If the owner sells the property',
    message: 'The agreement doesn\'t say what happens if the property is sold during your tenancy. Ask for a line saying the agreement continues with the new owner for the remaining term.',
    basis: 'Transfer of Property Act, 1882, s.109; contract terms.',
    questions: ['If the flat is sold, does my agreement continue with the new owner?'],
    lastReviewed: '2025-01-15',
    stateVariesNote: true
  },
  {
    id: 'IN-RENT-TDS',
    test: (ctx) => ctx.derived.monthlyRent !== null && ctx.derived.monthlyRent > 50000,
    severity: () => 'INFO',
    title: 'Tax deduction when rent is high',
    message: 'Where monthly rent crosses ₹50,000, income-tax rules can require the tenant to deduct tax at source when paying rent. Rates and procedures change, so confirm the current position with a tax professional or the Income Tax portal, and check whether the agreement says who handles it.',
    basis: 'Income-tax Act, 1961, s.194-IB (verify the current rate and threshold before release).',
    questions: ['Who will handle TDS, and do you have a PAN to share for it?'],
    lastReviewed: '2025-01-15',
    stateVariesNote: true
  },
  {
    id: 'IN-RENT-POLICE-VERIFICATION',
    test: (ctx) => {
      const hasClause = findClauseText(ctx, [/police verification/i]) !== null;
      const isMetro = ['mumbai', 'delhi', 'bengaluru', 'chennai', 'kolkata', 'hyderabad', 'pune', 'ahmedabad'].some(c =>
        ctx.interview.city?.toLowerCase().includes(c)
      );
      return hasClause || (isMetro && hasProtection(ctx, 'DISPUTE_RESOLUTION') === 'absent');
    },
    severity: () => 'INFO',
    title: 'Tenant verification',
    message: 'Many states require tenant verification with the local police. It\'s usually the owner\'s responsibility to file it, with documents from you.',
    basis: 'State police acts and local rules.',
    questions: ['Will you complete the police verification, and what documents do you need from me?'],
    lastReviewed: '2025-01-15',
    stateVariesNote: true
  },
  {
    id: 'IN-RENT-DISPUTE',
    test: (ctx) => hasProtection(ctx, 'DISPUTE_RESOLUTION') !== 'present',
    severity: () => 'INFO',
    title: 'Where disputes go',
    message: 'The agreement doesn\'t specify where disputes will be decided. This affects cost and convenience if something goes wrong.',
    basis: 'Arbitration and Conciliation Act, 1996; state rent authority rules.',
    questions: ['If we ever disagree, where is it decided, and who pays the cost?'],
    lastReviewed: '2025-01-15',
    stateVariesNote: true
  }
];

/** Run all rules and return hits */
export function runRules(ctx: RuleContext): RuleHit[] {
  const derived = buildDerived(ctx);
  const fullCtx = { ...ctx, derived };
  const hits: RuleHit[] = [];

  for (const rule of RENTAL_RULES) {
    if (rule.test(fullCtx)) {
      hits.push({
        ruleId: rule.id,
        clauseId: null, // Could be enhanced to find specific clause
        severity: rule.severity(fullCtx),
        title: rule.title,
        message: rule.message
          .replace('{{n}}', ctx.derived.depositMonths?.toString() ?? '')
          .replace('{{city}}', ctx.interview.city ?? 'your city')
          .replace('{{item}}', 'guests'), // Would be enhanced with actual matched item
        basis: rule.basis,
        questions: rule.questions,
        lastReviewed: rule.lastReviewed
      });
    }
  }

  return hits;
}