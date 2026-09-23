/** Verdict logic — the heart of the product. Pure functions, 100% test coverage.
 * The model reports, the code judges.
 */

import type { InterviewAnswers, NormalisedAnswers, MatchRow, VerifiedQuote, Verdict, Severity } from '../types.js';
import { normaliseAnswers, formatDays } from './normalise.js';

/** Comparison result before quote verification */
interface RawMatch {
  key: keyof InterviewAnswers;
  agreed: string;
  written: string | null;
  verdict: Verdict;
  severity: Severity;
  evidence: VerifiedQuote | null;
  note: string;
  suggestedQuestion: string | null;
}

/** Compare a single interview answer against the model's finding */
export function compareAnswer(
  key: keyof InterviewAnswers,
  agreedValue: string,
  modelWritten: string | null,
  modelFound: boolean,
  evidence: VerifiedQuote | null,
  normalised: NormalisedAnswers
): RawMatch {
  // If user skipped this question, exclude entirely
  if (!agreedValue || agreedValue.trim() === '') {
    return {
      key,
      agreed: '',
      written: null,
      verdict: 'not_covered',
      severity: 'INFO',
      evidence: null,
      note: '',
      suggestedQuestion: null
    };
  }

  // If model found nothing in the agreement
  if (!modelFound || !modelWritten) {
    const question = getSuggestedQuestion(key);
    return {
      key,
      agreed: agreedValue,
      written: null,
      verdict: 'not_covered',
      severity: 'INFO',
      evidence: null,
      note: `Your agreement doesn't mention ${getTopicLabel(key)}.`,
      suggestedQuestion: question
    };
  }

  // If quote failed verification, demote to unclear
  if (evidence && evidence.status === 'unverified') {
    return {
      key,
      agreed: agreedValue,
      written: modelWritten,
      verdict: 'unclear',
      severity: 'INFO',
      evidence,
      note: `The agreement mentions ${getTopicLabel(key)} but we couldn't verify the exact wording.`,
      suggestedQuestion: getSuggestedQuestion(key)
    };
  }

  // Compare based on key type
  const { verdict, severity, note } = computeVerdict(key, agreedValue, modelWritten, normalised);

  return {
    key,
    agreed: agreedValue,
    written: modelWritten,
    verdict,
    severity,
    evidence,
    note,
    suggestedQuestion: verdict === 'differs' ? getSuggestedQuestion(key) : null
  };
}

function computeVerdict(
  key: keyof InterviewAnswers,
  agreed: string,
  written: string,
  normalised: NormalisedAnswers
): { verdict: Verdict; severity: Severity; note: string } {
  switch (key) {
    case 'monthlyRent': {
      const agreedNum = parseMoney(agreed);
      const writtenNum = parseMoney(written);
      if (agreedNum === null || writtenNum === null) {
        return { verdict: 'unclear', severity: 'INFO', note: 'Could not compare rent amounts precisely.' };
      }
      const diff = Math.abs(agreedNum - writtenNum);
      if (diff <= 1) {
        return { verdict: 'matches', severity: 'INFO', note: 'The rent matches what you were told.' };
      }
      const worse = writtenNum > agreedNum;
      return {
        verdict: 'differs',
        severity: worse ? 'HIGH' : 'INFO',
        note: `You said ${formatMoney(agreedNum)}. The agreement says ${formatMoney(writtenNum)}.`
      };
    }

    case 'deposit': {
      const agreedNorm = parseMoney(agreed);
      const writtenNorm = parseMoney(written);
      const agreedMonths = normalised.deposit?.months;
      const writtenMonths = extractMonthsFromText(written, normalised.monthlyRent);

      let differs = false;

      // Months comparison takes precedence where both are derivable
      if (agreedMonths != null && writtenMonths != null) {
        const diff = Math.abs(agreedMonths - writtenMonths);
        if (diff > 0.1) differs = true;
      } else if (agreedNorm !== null && writtenNorm !== null) {
        const diff = Math.abs(agreedNorm - writtenNorm);
        if (diff > 1) differs = true;
      }

      if (!differs) {
        return { verdict: 'matches', severity: 'INFO', note: 'The deposit matches what you were told.' };
      }

      const agreedDisp = agreedNorm !== null ? formatMoney(agreedNorm) : agreed;
      const writtenDisp = writtenNorm !== null ? formatMoney(writtenNorm) : written;
      const worse = (agreedMonths != null && writtenMonths != null)
        ? writtenMonths > agreedMonths
        : worseAmount(agreedNorm, writtenNorm);

      return {
        verdict: 'differs',
        severity: worse ? 'HIGH' : 'INFO',
        note: `You said ${agreedDisp}${agreedMonths !== null ? ` (${agreedMonths} months)` : ''}. The agreement says ${writtenDisp}${writtenMonths !== null ? ` (${writtenMonths} months)` : ''}.`
      };
    }

    case 'duration': {
      const agreedDays = parseDuration(agreed);
      const writtenDays = parseDuration(written);
      if (agreedDays === null || writtenDays === null) {
        return { verdict: 'unclear', severity: 'INFO', note: 'Could not compare durations precisely.' };
      }
      const diff = Math.abs(agreedDays - writtenDays);
      if (diff <= 15) {
        return { verdict: 'matches', severity: 'INFO', note: 'The duration matches what you were told.' };
      }
      return {
        verdict: 'differs',
        severity: 'MEDIUM',
        note: `You said ${formatDays(agreedDays)}. The agreement says ${formatDays(writtenDays)}.`
      };
    }

    case 'lockIn': {
      const agreedDays = parseLockIn(agreed);
      const writtenDays = parseLockIn(written);

      if (agreedDays === null && writtenDays === null) {
        return { verdict: 'matches', severity: 'INFO', note: 'No lock-in mentioned, as you expected.' };
      }
      if (agreedDays === null && writtenDays !== null) {
        return {
          verdict: 'differs',
          severity: 'HIGH',
          note: `You were told no lock-in. The agreement has a ${formatDays(writtenDays)} lock-in.`
        };
      }
      if (agreedDays !== null && writtenDays !== null) {
        const diff = writtenDays - agreedDays;
        if (diff <= 15) {
          return { verdict: 'matches', severity: 'INFO', note: 'The lock-in period matches what you were told.' };
        }
        return {
          verdict: 'differs',
          severity: 'HIGH',
          note: `You were told ${formatDays(agreedDays)}. The agreement says ${formatDays(writtenDays)}.`
        };
      }
      return { verdict: 'unclear', severity: 'INFO', note: 'Could not compare lock-in periods precisely.' };
    }

    case 'noticePeriod': {
      const agreedDays = parseNoticePeriod(agreed);
      const writtenDays = parseNoticePeriod(written);
      if (agreedDays === null || writtenDays === null) {
        return { verdict: 'unclear', severity: 'INFO', note: 'Could not compare notice periods precisely.' };
      }
      if (writtenDays <= agreedDays) {
        return { verdict: 'matches', severity: 'INFO', note: 'The notice period matches or is better than what you were told.' };
      }
      return {
        verdict: 'differs',
        severity: 'HIGH',
        note: `You agreed to ${formatDays(agreedDays)} notice. The agreement requires ${formatDays(writtenDays)}.`
      };
    }

    case 'maintenance':
    case 'repairs': {
      const agreedEnum = key === 'maintenance' ? parseMaintenance(agreed) : parseRepairs(agreed);
      const writtenEnum = key === 'maintenance' ? parseMaintenance(written) : parseRepairs(written);

      if (agreedEnum === null || writtenEnum === null) {
        return { verdict: 'unclear', severity: 'INFO', note: `Could not determine who handles ${key === 'maintenance' ? 'maintenance' : 'repairs'} precisely.` };
      }
      if (agreedEnum === writtenEnum) {
        return { verdict: 'matches', severity: 'INFO', note: `The ${key === 'maintenance' ? 'maintenance' : 'repairs'} responsibility matches what you were told.` };
      }
      const worse = (agreedEnum === 'owner' && writtenEnum === 'me') ||
                    (agreedEnum === 'split' && writtenEnum === 'me');
      return {
        verdict: 'differs',
        severity: worse ? 'HIGH' : 'MEDIUM',
        note: `You were told ${formatParty(agreedEnum)}. The agreement says ${formatParty(writtenEnum)}.`
      };
    }

    case 'increase': {
      const agreedPct = parseIncrease(agreed);
      const writtenPct = parseIncrease(written);

      if (agreedPct === null && writtenPct === null) {
        return { verdict: 'matches', severity: 'INFO', note: 'No rent increase mentioned, as you expected.' };
      }
      if (agreedPct === null && writtenPct !== null) {
        return {
          verdict: 'differs',
          severity: 'HIGH',
          note: `You were told no increase. The agreement has a ${writtenPct}% increase clause.`
        };
      }
      if (agreedPct !== null && writtenPct !== null) {
        if (writtenPct <= agreedPct) {
          return { verdict: 'matches', severity: 'INFO', note: 'The rent increase matches or is better than what you were told.' };
        }
        return {
          verdict: 'differs',
          severity: 'HIGH',
          note: `You were told ${agreedPct}% increase. The agreement says ${writtenPct}%.`
        };
      }
      return { verdict: 'unclear', severity: 'INFO', note: 'Could not compare rent increase precisely.' };
    }

    case 'extras': {
      const agreedExtras = agreed.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
      const writtenLower = written.toLowerCase();
      const missing = agreedExtras.filter(e => !writtenLower.includes(e));

      if (missing.length === 0) {
        return { verdict: 'matches', severity: 'INFO', note: 'The extra items you mentioned are covered in the agreement.' };
      }
      return {
        verdict: 'differs',
        severity: 'MEDIUM',
        note: `You were promised: ${missing.join(', ')}. These are not mentioned in the agreement.`
      };
    }

    case 'city': {
      return { verdict: 'matches', severity: 'INFO', note: 'City noted for state-specific context.' };
    }

    default:
      return { verdict: 'unclear', severity: 'INFO', note: 'Could not compare this item.' };
  }
}

/** True when the written amount exceeds the agreed one, treating a missing amount as zero. */
export function worseAmount(agreed: number | null, written: number | null): boolean {
  return (written ?? 0) > (agreed ?? 0);
}

function extractMonthsFromText(text: string, monthlyRent: number | null): number | null {
  const monthsMatch = text.match(/(\d+(?:\.\d+)?)\s*months?/i);
  if (monthsMatch) return parseFloat(monthsMatch[1]!);

  if (monthlyRent && monthlyRent > 0) {
    const amountMatch = text.match(/₹?\s*(\d[\d,]*)/);
    if (amountMatch) {
      const amount = parseInt(amountMatch[1]!.replace(/,/g, ''), 10);
      return Math.round((amount / monthlyRent) * 10) / 10;
    }
  }
  return null;
}

function getTopicLabel(key: keyof InterviewAnswers): string {
  const labels: Record<keyof InterviewAnswers, string> = {
    city: 'the city',
    monthlyRent: 'monthly rent',
    deposit: 'security deposit',
    duration: 'agreement duration',
    lockIn: 'lock-in period',
    noticePeriod: 'notice period',
    maintenance: 'maintenance charges',
    repairs: 'repairs',
    increase: 'rent increase',
    extras: 'extra promises'
  };
  return labels[key];
}

function getSuggestedQuestion(key: keyof InterviewAnswers): string {
  const questions: Record<keyof InterviewAnswers, string> = {
    city: 'Which state does this property fall under?',
    monthlyRent: 'What is the exact monthly rent in the agreement?',
    deposit: 'What is the deposit amount and when is it refunded?',
    duration: 'What is the exact term of the agreement?',
    lockIn: 'Is there a minimum stay period, and what is the penalty for leaving early?',
    noticePeriod: 'How much notice must I give, and how much must the owner give?',
    maintenance: 'Who pays society maintenance, water, electricity and property tax?',
    repairs: 'Who handles major repairs vs. small day-to-day fixes?',
    increase: 'Is there a fixed percentage for rent increase on renewal?',
    extras: 'Can the promised extras be added as a schedule to the agreement?'
  };
  return questions[key];
}

function formatParty(value: 'me' | 'owner' | 'split' | 'not_discussed'): string {
  switch (value) {
    case 'me': return 'you (tenant)';
    case 'owner': return 'the owner';
    case 'split': return 'both (split)';
    case 'not_discussed': return 'not specified';
  }
}

function parseMoney(input: string): number | null {
  const cleaned = input.trim()
    .replace(/[₹$]/g, '')
    .replace(/rs\.?/gi, '')
    .replace(/inr/gi, '')
    .replace(/,/g, '')
    .toLowerCase();

  const numMatch = cleaned.match(/^(\d+(?:[.,]\d+)?)\s*(k|lakh|l)?$/i);
  if (numMatch) {
    let value = parseFloat(numMatch[1]!.replace(',', '.'));
    const suffix = numMatch[2];
    if (suffix) {
      if (suffix.toLowerCase() === 'k') value *= 1000;
      if (suffix.toLowerCase() === 'l' || suffix.toLowerCase() === 'lakh') value *= 100000;
    }
    return Math.round(value);
  }
  return null;
}

function parseDuration(input: string): number | null {
  const cleaned = input.trim().toLowerCase();
  if (cleaned === '11 months') return 330;
  if (cleaned === '1 year' || cleaned === '12 months') return 365;
  if (cleaned === '2 years' || cleaned === '24 months') return 730;
  const monthMatch = cleaned.match(/(\d+(?:\.\d+)?)\s*months?/);
  if (monthMatch) return Math.round(parseFloat(monthMatch[1]!) * 30);
  const yearMatch = cleaned.match(/(\d+(?:\.\d+)?)\s*years?/);
  if (yearMatch) return Math.round(parseFloat(yearMatch[1]!) * 365);
  const dayMatch = cleaned.match(/(\d+)\s*days?/);
  if (dayMatch) return parseInt(dayMatch[1]!, 10);
  return null;
}

function parseLockIn(input: string): number | null {
  const cleaned = input.trim().toLowerCase();
  if (cleaned === 'no' || cleaned === 'not_sure') return null;
  const monthMatch = cleaned.match(/(\d+)\s*months?/);
  if (monthMatch) return parseInt(monthMatch[1]!, 10) * 30;
  return null;
}

function parseNoticePeriod(input: string): number | null {
  const cleaned = input.trim().toLowerCase();
  if (cleaned === 'not_sure') return null;
  if (cleaned === '15 days') return 15;
  if (cleaned === '1 month') return 30;
  if (cleaned === '2 months') return 60;
  const dayMatch = cleaned.match(/(\d+)\s*days?/);
  if (dayMatch) return parseInt(dayMatch[1]!, 10);
  const monthMatch = cleaned.match(/(\d+)\s*months?/);
  if (monthMatch) return parseInt(monthMatch[1]!, 10) * 30;
  return null;
}

function parseIncrease(input: string): number | null {
  const cleaned = input.trim().toLowerCase();
  if (cleaned === 'no' || cleaned === 'not_sure') return null;
  const pctMatch = cleaned.match(/(\d+(?:\.\d+)?)\s*%?/);
  if (pctMatch) return parseFloat(pctMatch[1]!);
  return null;
}

function parseMaintenance(input: string): 'me' | 'owner' | 'split' | 'not_discussed' | null {
  const v = input.trim().toLowerCase();
  if (v === 'me' || v === 'owner' || v === 'split' || v === 'not_discussed') return v;
  return null;
}

function parseRepairs(input: string): 'me' | 'owner' | 'split' | 'not_discussed' | null {
  const v = input.trim().toLowerCase();
  if (v === 'me' || v === 'owner' || v === 'split' || v === 'not_discussed') return v;
  return null;
}

function formatMoney(amount: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
}

/** Main entry: build match rows from interview answers and model findings */
export function buildMatchRows(
  answers: InterviewAnswers,
  modelFindings: Array<{
    key: string;
    found: boolean;
    writtenValue: string | null;
    clauseId: string | null;
    quote: string | null;
    ambiguity: string | null;
  }>,
  verifiedQuotes: Map<string, VerifiedQuote | null>
): MatchRow[] {
  const normalised = normaliseAnswers(answers);
  const rows: MatchRow[] = [];

  for (const answerKey of Object.keys(answers) as Array<keyof InterviewAnswers>) {
    const agreedValue = answers[answerKey];
    if (!agreedValue || (Array.isArray(agreedValue) && agreedValue.length === 0)) continue;

    const finding = modelFindings.find(f => f.key === answerKey);
    const evidence = finding?.clauseId ? verifiedQuotes.get(finding.clauseId) ?? null : null;

    const raw = compareAnswer(
      answerKey,
      Array.isArray(agreedValue) ? agreedValue.join(', ') : agreedValue,
      finding?.writtenValue ?? null,
      finding?.found ?? false,
      evidence,
      normalised
    );

    // Only include rows where user gave an answer
    if (raw.agreed) {
      rows.push(raw);
    }
  }

  return rows;
}