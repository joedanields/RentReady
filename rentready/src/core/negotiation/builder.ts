/** Negotiation message builder — pure functions */

import type {
  InterviewAnswers,
  MatchRow,
  GapRow,
  NegotiationResult,
  NegotiationItem,
} from '../types.js';

export interface NegotiationInput {
  matches: MatchRow[];
  gaps: GapRow[];
  selectedRowIds: string[];
  tone: 'polite' | 'direct';
  channel: 'whatsapp' | 'email';
}

function getRowById(matches: MatchRow[], gaps: GapRow[], id: string): MatchRow | GapRow | null {
  if (id.startsWith('match-')) {
    const key = id.replace('match-', '') as keyof InterviewAnswers;
    return matches.find(m => m.key === key) ?? null;
  }
  if (id.startsWith('gap-')) {
    const gapId = id.replace('gap-', '');
    return gaps.find(g => g.id === gapId) ?? null;
  }
  return null;
}

/** Build the negotiation message and suggested wording locally (no AI) */
export function buildNegotiationLocal(input: NegotiationInput): NegotiationResult {
  const { matches, gaps, selectedRowIds, tone, channel } = input;
  const items: NegotiationItem[] = [];

  for (const rowId of selectedRowIds) {
    const row = getRowById(matches, gaps, rowId);
    if (!row) continue;

    if ('key' in row) {
      // MatchRow - mismatch
      const matchRow = row as MatchRow;
      if (matchRow.verdict !== 'differs') continue;

      items.push({
        rowId,
        ask: buildAskFromMatch(matchRow, tone),
        reason: buildReasonFromMatch(matchRow),
        suggestedWording: buildWordingFromMatch(matchRow),
      });
    } else {
      // GapRow - absent protection
      const gapRow = row as GapRow;
      if (gapRow.state !== 'absent') continue;

      items.push({
        rowId,
        ask: buildAskFromGap(gapRow, tone),
        reason: gapRow.whyItMatters,
        suggestedWording: gapRow.requestWording ?? 'Please add a clause covering this.',
      });
    }
  }

  const message = buildMessage(items, tone, channel);
  return { message, items };
}

function buildAskFromMatch(row: MatchRow, tone: 'polite' | 'direct'): string {
  const topic = getTopicLabel(row.key);
  const isBetter = row.severity === 'INFO';

  if (isBetter) {
    return tone === 'polite'
      ? `The agreement is actually better than what we discussed on ${topic} (${row.written} vs ${row.agreed}). Just confirming this is intentional.`
      : `Agreement improves on ${topic}: ${row.written} vs agreed ${row.agreed}. Confirming.`;
  }

  return tone === 'polite'
    ? `On ${topic}, we agreed on "${row.agreed}" but the agreement says "${row.written}" (Clause ${row.evidence?.clauseId}). Could we align the agreement with what we discussed?`
    : `${topic}: agreed "${row.agreed}", agreement says "${row.written}" (Clause ${row.evidence?.clauseId}). Please correct.`;
}

function buildAskFromGap(row: GapRow, tone: 'polite' | 'direct'): string {
  if (tone === 'polite') {
    return `The agreement doesn't cover ${row.title.toLowerCase()}. ${row.whyItMatters} Could we add a clause for this?`;
  }
  return `Missing: ${row.title}. ${row.whyItMatters} Please add.`;
}

function buildReasonFromMatch(row: MatchRow): string {
  return row.note;
}

function buildWordingFromMatch(row: MatchRow): string {
  switch (row.key) {
    case 'monthlyRent':
      return `Monthly rent: ₹${row.agreed.replace(/[^0-9]/g, '')} (as agreed).`;
    case 'deposit':
      return `Security deposit: ${row.agreed} (as agreed), refundable within 15 days of handing over vacant possession.`;
    case 'duration':
      return `Term: ${row.agreed} (as agreed).`;
    case 'lockIn':
      return `Lock-in period: ${row.agreed}, applicable to both parties.`;
    case 'noticePeriod':
      return `Notice period: ${row.agreed} for both tenant and owner.`;
    case 'maintenance':
      return `Society maintenance and property tax: Owner. Electricity and water usage: Tenant.`;
    case 'repairs':
      return `Minor repairs up to ₹2,000 per instance: Tenant. Structural and major repairs: Owner.`;
    case 'increase':
      return `Rent may be increased by not more than ${row.agreed}% on renewal.`;
    default:
      return `As agreed: ${row.agreed}.`;
  }
}

function getTopicLabel(key: string): string {
  const labels: Record<string, string> = {
    monthlyRent: 'monthly rent',
    deposit: 'security deposit',
    duration: 'agreement duration',
    lockIn: 'lock-in period',
    noticePeriod: 'notice period',
    maintenance: 'maintenance charges',
    repairs: 'repairs responsibility',
    increase: 'rent increase',
    extras: 'extra promises',
  };
  return labels[key] || key;
}

function buildMessage(
  items: NegotiationItem[],
  tone: 'polite' | 'direct',
  channel: 'whatsapp' | 'email'
): string {
  if (items.length === 0) return '';

  const isWhatsApp = channel === 'whatsapp';
  const greeting =
    tone === 'polite'
      ? isWhatsApp
        ? 'Hi, '
        : 'Dear [Owner/Broker],\n\n'
      : isWhatsApp
        ? 'Hi, '
        : 'Dear [Owner/Broker],\n\n';

  const closing =
    tone === 'polite'
      ? isWhatsApp
        ? '\n\nThanks for your time!'
        : '\n\nThank you for your time.\n\nBest regards,\n[Your Name]'
      : isWhatsApp
        ? '\n\nThanks.'
        : '\n\nRegards,\n[Your Name]';

  const body = items.map((item, i) => `${i + 1}. ${item.ask}`).join('\n');

  let message = `${greeting}${body}${closing}`;

  if (isWhatsApp) {
    message = message.replace(/\n\n/g, '\n').trim();
  }

  return message;
}
