/**
 * Deterministic facts read from the agreement text itself — rent, deposit, lock-in, term, notice.
 * Rules judge what the *agreement* says (LEGAL_RULES §2), so these never look at the interview.
 * They work offline, so the local report can flag a 3-month deposit or a 6-month lock-in with
 * no AI at all. Every value comes with the clause it was read from, so rule cards can cite it.
 */

import type { Clause } from '../types.js';

const WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  fifteen: 15,
  twenty: 20,
  thirty: 30,
  sixty: 60,
  ninety: 90,
};

const UNIT_DAYS: Record<string, number> = { day: 1, week: 7, month: 30, year: 365 };

// "six (6) months", "11 months", "two months'", "1 year", "30 days", "1.5 months"
const PERIOD_RE = new RegExp(
  String.raw`\b(\d+(?:\.\d+)?|${Object.keys(WORDS).join('|')})\s*(?:\(\s*(\d+)\s*\)\s*)?(day|week|month|year)s?\b`,
  'i'
);

/** The first period in `text`, in days (months count as 30, years as 365), or null. */
export function periodDays(text: string): number | null {
  const m = PERIOD_RE.exec(text);
  if (!m) return null;
  const raw = m[2] ?? m[1]!;
  const n = /^\d/.test(raw) ? parseFloat(raw) : WORDS[raw.toLowerCase()]!;
  return Math.round(n * UNIT_DAYS[m[3]!.toLowerCase()]!);
}

/** The first rupee amount written as "Rs. 40,000", "INR 40000" or "₹40,000", or null. */
export function rupeesIn(text: string): number | null {
  const m = /(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d+)?)/i.exec(text);
  if (!m) return null;
  const n = parseFloat(m[1]!.replace(/,/g, ''));
  return n > 0 ? n : null;
}

/** Text from the first match of `re` onwards, so a period is read near its keyword. */
function after(text: string, re: RegExp): string | null {
  const m = re.exec(text);
  return m ? text.slice(m.index) : null;
}

export interface Fact<T> {
  value: T;
  clause: Clause;
}

export interface AgreementFacts {
  rent: Fact<number> | null;
  deposit: Fact<DepositValue> | null;
  lockInDays: Fact<number> | null;
  durationDays: Fact<number> | null;
  /** Notice the tenant must give / the owner must give, in days. */
  noticeTenantDays: Fact<number> | null;
  noticeLandlordDays: Fact<number> | null;
}

const RENT_RE = /\b(monthly rent|rent of|licen[cs]e fee|monthly compensation)\b/i;
const DEPOSIT_RE = /\b(security deposit|deposit of|refundable deposit)\b/i;
const LOCK_IN_RE = /\b(lock-?in|shall not vacate[\s\S]{0,40}?before|minimum (period|stay) of)\b/i;
const TERM_RE = /\b(period|term) of\b/i;
const DEPOSIT_MONTHS_RE = new RegExp(
  String.raw`\b(\d+(?:\.\d+)?|${Object.keys(WORDS).join('|')})\s*(?:\(\s*(\d+)\s*\)\s*)?months?'?\s*(?:of\s+)?(?:the\s+)?(?:monthly\s+)?rent`,
  'i'
);

type DepositValue = { amount: number | null; months: number | null };

function readDeposit(text: string, rent: number | null): DepositValue | null {
  const tail = after(text, DEPOSIT_RE);
  if (!tail) return null;
  const m = DEPOSIT_MONTHS_RE.exec(tail);
  const raw = m ? (m[2] ?? m[1]!) : null;
  const stated = raw ? (/^\d/.test(raw) ? parseFloat(raw) : WORDS[raw.toLowerCase()]!) : null;
  const amount = rupeesIn(tail);
  const months = stated ?? (amount !== null && rent ? Math.round((amount / rent) * 10) / 10 : null);
  return amount === null && months === null ? null : { amount, months };
}

function first<T>(clauses: Clause[], read: (c: Clause) => T | null): Fact<T> | null {
  for (const clause of clauses) {
    const value = read(clause);
    if (value !== null) return { value, clause };
  }
  return null;
}

/** Reads the agreement's key numbers. Missing facts are null — never guessed. */
export function extractFacts(clauses: Clause[]): AgreementFacts {
  const rent = first(clauses, c =>
    RENT_RE.test(c.text) && !DEPOSIT_RE.test(c.text) ? rupeesIn(c.text) : null
  );

  // A clause that states the deposit in months of rent beats one that only gives an amount.
  const deposits: Array<Fact<DepositValue>> = [];
  for (const clause of clauses) {
    const value = readDeposit(clause.text, rent?.value ?? null);
    if (value) deposits.push({ value, clause });
  }
  const deposit = deposits.find(d => d.value.months !== null) ?? deposits[0] ?? null;

  const lockInDays = first(clauses, c => {
    const tail = after(c.text, LOCK_IN_RE);
    return tail ? periodDays(tail) : null;
  });

  const durationDays = first(clauses, c => {
    if (LOCK_IN_RE.test(c.text)) return null;
    const tail = after(c.text, TERM_RE);
    return tail ? periodDays(tail) : null;
  });

  const noticeFor = (role: 'tenant' | 'landlord') =>
    first(clauses, c => {
      // Who *gives* the notice decides whose notice it is: "the Owner shall give the Tenant
      // 30 days' notice" is the owner's notice even though it names the tenant.
      for (const m of c.text.matchAll(NOTICE_GIVER_RE)) {
        const giver = partyRole(m[1]!);
        if (giver === role || giver === 'both') {
          const days = periodDays(m[0]);
          if (days !== null) return days;
        }
      }
      return null;
    });

  return {
    rent,
    deposit,
    lockInDays,
    durationDays,
    noticeTenantDays: noticeFor('tenant'),
    noticeLandlordDays: noticeFor('landlord'),
  };
}

const NOTICE_GIVER_RE =
  /\b(either party|both parties|each party|licensee|tenant|lessee|licensor|landlord|owner|lessor)\b[^.]{0,60}?\b(?:shall|must|will|may|agrees to)\s+(?:give|serve|provide)\b[^.]{0,80}?\bnotice\b/gi;

function partyRole(party: string): 'tenant' | 'landlord' | 'both' {
  const p = party.toLowerCase();
  if (/either|both|each/.test(p)) return 'both';
  return /licensee|tenant|lessee/.test(p) ? 'tenant' : 'landlord';
}
