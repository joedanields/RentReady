/**
 * Negotiation pack, built locally (no AI): a short, polite message plus suggested wording per
 * item (AI_PIPELINE §6 shape). Items can come from mismatches (`match-<key>`), missing
 * protections (`gap-<id>`) and rule findings (`rule-<id>`), so an offline report can still
 * produce a message. Clauses are named the way the agreement numbers them, never by internal id.
 */

import type {
  Clause,
  GapRow,
  InterviewAnswers,
  MatchRow,
  NegotiationItem,
  NegotiationResult,
  RuleHit,
} from '../types.js';
import { formatMoney, parseMoney } from '../interview/normalise.js';

export interface NegotiationInput {
  matches: MatchRow[];
  gaps: GapRow[];
  rules?: RuleHit[];
  clauses?: Clause[];
  selectedRowIds: string[];
  tone: 'polite' | 'direct';
  channel: 'whatsapp' | 'email';
}

const TOPIC: Record<keyof InterviewAnswers, string> = {
  city: 'city',
  monthlyRent: 'monthly rent',
  deposit: 'security deposit',
  duration: 'agreement duration',
  lockIn: 'lock-in period',
  noticePeriod: 'notice period',
  maintenance: 'maintenance charges',
  repairs: 'repairs responsibility',
  increase: 'rent increase',
  extras: 'the other promises',
};

/** Wording to request for rule findings, in the same neutral style as the protection list. */
const RULE_WORDING: Record<string, string> = {
  'IN-RENT-DEPOSIT-HIGH': "The Security Deposit is ₹____ (two months' rent).",
  'IN-RENT-DEPOSIT-NO-TIMELINE':
    'The deposit shall be refunded within 15 days of handing over vacant possession.',
  'IN-RENT-DEPOSIT-DISCRETION':
    'Deductions are limited to unpaid rent, unpaid utility bills and damage beyond normal wear and tear, supported by bills.',
  'IN-RENT-LOCKIN-LONG': 'Lock-in period: ____ months, applicable to both parties.',
  'IN-RENT-NOTICE-ASYMMETRIC': 'Either party shall give ____ days’ written notice.',
  'IN-RENT-ENTRY-NO-NOTICE':
    "The Owner shall give at least 24 hours' written notice before entry, except in an emergency.",
  'IN-RENT-ESSENTIAL-SERVICES': 'Essential supplies shall not be withheld under any circumstances.',
  'IN-RENT-EVICTION-SELF-HELP':
    'Possession shall be taken back only through the process allowed by law.',
  'IN-RENT-REPAIRS-ON-TENANT':
    "Minor repairs up to ₹2,000 per instance are the Tenant's responsibility; structural and major repairs are the Owner's.",
  'IN-RENT-INCREASE-UNCAPPED': 'Rent may be increased by not more than ____% on renewal.',
  'IN-RENT-MAINTENANCE-UNCLEAR':
    'Society maintenance and property tax: Owner. Electricity and water usage: Tenant.',
  'IN-RENT-SALE-OF-PROPERTY':
    'This agreement shall continue to bind any new owner for the remaining term.',
  'IN-RENT-GUEST-RESTRICTION':
    'The Tenant may receive visitors; overnight stays beyond a week need the Owner’s consent.',
};

/** "Clause 5" as printed in the agreement, or null when there is nothing sensible to cite. */
export function clauseRef(clauses: Clause[], clauseId: string | null | undefined): string | null {
  const clause = clauses.find(c => c.id === clauseId);
  if (!clause) return null;
  const label = clause.label ?? clause.heading;
  return label ? `Clause ${label}` : null;
}

const cite = (ref: string | null) => (ref ? ` (${ref})` : '');

function matchItem(row: MatchRow, rowId: string, input: NegotiationInput): NegotiationItem | null {
  if (row.verdict !== 'differs' && row.verdict !== 'not_covered') return null;
  const topic = TOPIC[row.key] ?? String(row.key);
  const ref = cite(clauseRef(input.clauses ?? [], row.evidence?.clauseId));
  const polite = input.tone === 'polite';
  let ask: string;
  if (row.verdict === 'not_covered') {
    ask = polite
      ? `We agreed on ${topic} as "${row.agreed}", but the agreement doesn't mention it. Could we add it in writing?`
      : `${topic}: agreed "${row.agreed}", not in the agreement. Please add it.`;
  } else if (row.severity === 'INFO') {
    ask = polite
      ? `On ${topic}, the agreement says "${row.written}"${ref}, which is better than the "${row.agreed}" we discussed. Just confirming this is intended.`
      : `${topic}: agreement says "${row.written}"${ref}, better than agreed "${row.agreed}". Confirming.`;
  } else {
    ask = polite
      ? `On ${topic}, we agreed on "${row.agreed}" but the agreement says "${row.written}"${ref}. Could we align it with what we discussed?`
      : `${topic}: agreed "${row.agreed}", agreement says "${row.written}"${ref}. Please correct.`;
  }
  return { rowId, ask, reason: row.note, suggestedWording: wordingForMatch(row) };
}

function wordingForMatch(row: MatchRow): string {
  switch (row.key) {
    case 'monthlyRent': {
      const amount = parseMoney(row.agreed);
      return `Monthly rent: ${amount !== null ? formatMoney(amount) : row.agreed} (as agreed).`;
    }
    case 'deposit':
      return `Security deposit: ${row.agreed} (as agreed), refundable within 15 days of handing over vacant possession.`;
    case 'duration':
      return `Term: ${row.agreed} (as agreed).`;
    case 'lockIn':
      return `Lock-in period: ${row.agreed === 'no' ? 'none' : row.agreed}, applicable to both parties.`;
    case 'noticePeriod':
      return `Notice period: ${row.agreed} for both tenant and owner.`;
    case 'maintenance':
      return 'Society maintenance and property tax: Owner. Electricity and water usage: Tenant.';
    case 'repairs':
      return 'Minor repairs up to ₹2,000 per instance: Tenant. Structural and major repairs: Owner.';
    case 'increase':
      return row.agreed === 'no'
        ? 'Rent shall not be increased during this term.'
        : `Rent may be increased by not more than ${row.agreed.replace(/%$/, '')}% on renewal.`;
    default:
      return `As agreed: ${row.agreed}.`;
  }
}

function gapItem(row: GapRow, rowId: string, tone: 'polite' | 'direct'): NegotiationItem | null {
  if (row.state !== 'absent') return null;
  const title = row.title.toLowerCase();
  return {
    rowId,
    ask:
      tone === 'polite'
        ? `The agreement doesn't cover ${title}. Could we add a line for this?`
        : `Missing: ${row.title}. Please add.`,
    reason: row.whyItMatters,
    suggestedWording: row.requestWording ?? 'Please add a clause covering this.',
  };
}

function ruleItem(rule: RuleHit, rowId: string, input: NegotiationInput): NegotiationItem {
  const ref = cite(clauseRef(input.clauses ?? [], rule.clauseId));
  const question = rule.questions[0] ?? 'Could we discuss this?';
  return {
    rowId,
    ask:
      input.tone === 'polite'
        ? `${rule.title}${ref}: ${question}`
        : `${rule.title}${ref}. ${question}`,
    reason: rule.title,
    suggestedWording: RULE_WORDING[rule.ruleId] ?? 'Please add a clause covering this.',
  };
}

/** Build the negotiation message and suggested wording locally (no AI). */
export function buildNegotiationLocal(input: NegotiationInput): NegotiationResult {
  const items: NegotiationItem[] = [];
  for (const rowId of input.selectedRowIds) {
    const [kind, ...rest] = rowId.split('-');
    const id = rest.join('-');
    let item: NegotiationItem | null = null;
    if (kind === 'match') {
      const row = input.matches.find(m => m.key === id);
      item = row ? matchItem(row, rowId, input) : null;
    } else if (kind === 'gap') {
      const row = input.gaps.find(g => g.id === id);
      item = row ? gapItem(row, rowId, input.tone) : null;
    } else if (kind === 'rule') {
      const rule = input.rules?.find(r => r.ruleId === id);
      item = rule ? ruleItem(rule, rowId, input) : null;
    }
    if (item) items.push(item);
  }
  return { message: buildMessage(items, input.tone, input.channel), items };
}

function buildMessage(
  items: NegotiationItem[],
  tone: 'polite' | 'direct',
  channel: 'whatsapp' | 'email'
): string {
  if (items.length === 0) return '';
  const email = channel === 'email';
  const opening =
    tone === 'polite'
      ? 'Thank you for sharing the agreement. Before signing, I would like to sort out a few points:'
      : 'I have reviewed the agreement. These points need to change before I sign:';
  const greeting = email ? 'Dear [Owner/Broker],' : 'Hi,';
  const closing = email
    ? tone === 'polite'
      ? 'Thank you for your time.\n\nBest regards,\n[Your Name]'
      : 'Regards,\n[Your Name]'
    : tone === 'polite'
      ? 'Thanks for your time!'
      : 'Thanks.';
  const body = items.map((item, i) => `${i + 1}. ${item.ask}`).join('\n');
  const gap = email ? '\n\n' : '\n';
  return [greeting, opening, body, closing].join(gap);
}
