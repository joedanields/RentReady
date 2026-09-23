/** Normalisation of interview answers — pure functions, 100% tested */

import type { InterviewAnswers, NormalisedAnswers } from '../types.js';

const NUMBER_WORDS: Record<string, number> = {
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
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
  hundred: 100,
  thousand: 1000,
  lakh: 100000,
};

export function parseMoney(input: string): number | null {
  if (!input || !input.trim()) return null;

  const cleaned = input
    .trim()
    .replace(/[₹$]/g, '')
    .replace(/rs\.?/gi, '')
    .replace(/inr/gi, '')
    .replace(/,/g, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();

  if (!cleaned) return null;

  // Handle word numbers like "two lakh" or "forty thousand"
  const wordMatch = cleaned.match(/^(\w+(?:\s+\w+)*)\s*(lakh|thousand)?$/);
  if (wordMatch && !/\d/.test(cleaned)) {
    const words = wordMatch[1]!.split(/\s+/);
    let value = 0;
    for (const word of words) {
      if (word === 'lakh') {
        value = (value || 1) * 100000;
      } else if (word === 'thousand') {
        value = (value || 1) * 1000;
      } else if (NUMBER_WORDS[word]) {
        value += NUMBER_WORDS[word];
      }
    }

    if (value > 0 && value <= 10_000_000) return value;
    return null;
  }

  // Handle numeric with k/K/lakh/L (lowercased input, so match any case)
  const numMatch = cleaned.match(/^(\d+(?:[.,]\d+)?)\s*(k|lakh|l)?$/i);
  if (numMatch) {
    let value = parseFloat(numMatch[1]!.replace(',', '.'));
    const suffix = numMatch[2];

    if (suffix) {
      if (suffix.toLowerCase() === 'k') value *= 1000;
      if (suffix.toLowerCase() === 'l' || suffix.toLowerCase() === 'lakh') value *= 100000;
    }

    if (value > 0 && value <= 10_000_000) return Math.round(value);
    return null;
  }

  // Try plain number
  const plainNum = parseFloat(cleaned.replace(/,/g, ''));
  if (!isNaN(plainNum) && plainNum > 0 && plainNum <= 10_000_000) return Math.round(plainNum);

  return null;
}

const MONTHS_RE = /^(\d+(?:\.\d+)?|[a-z]+)\s*months?\b/;

/**
 * Reads a deposit stated in months of rent ("2 months", "two months' rent", "1.5 months").
 * Must run before parseMoney: otherwise "two months" is read as the amount ₹2.
 */
export function parseMonthsCount(input: string): number | null {
  const m = MONTHS_RE.exec(input.trim().toLowerCase());
  if (!m) return null;
  const token = m[1]!;
  const n = /^\d/.test(token) ? parseFloat(token) : (NUMBER_WORDS[token] ?? null);
  return n !== null && n > 0 && n <= 24 ? n : null;
}

export function parseDuration(input: string): number | null {
  if (!input || !input.trim()) return null;

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

export function parseLockIn(input: string): number | null {
  if (!input || !input.trim()) return null;
  const cleaned = input.trim().toLowerCase();
  if (cleaned === 'no' || cleaned === 'not_sure') return null;

  const monthMatch = cleaned.match(/(\d+)\s*months?/);
  if (monthMatch) return parseInt(monthMatch[1]!, 10) * 30;

  return null;
}

export function parseNoticePeriod(input: string): number | null {
  if (!input || !input.trim()) return null;
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

export function parseIncrease(input: string): number | null {
  if (!input || !input.trim()) return null;
  const cleaned = input.trim().toLowerCase();
  if (cleaned === 'no' || cleaned === 'not_sure') return null;

  const pctMatch = cleaned.match(/(\d+(?:\.\d+)?)\s*%?/);
  if (pctMatch) return parseFloat(pctMatch[1]!);

  return null;
}

export function parseMaintenance(input: string): 'me' | 'owner' | 'split' | 'not_discussed' | null {
  if (!input) return null;
  const v = input.trim().toLowerCase();
  if (v === 'me' || v === 'owner' || v === 'split' || v === 'not_discussed') return v;
  return null;
}

export function parseRepairs(input: string): 'me' | 'owner' | 'split' | 'not_discussed' | null {
  if (!input) return null;
  const v = input.trim().toLowerCase();
  if (v === 'me' || v === 'owner' || v === 'split' || v === 'not_discussed') return v;
  return null;
}

export function normaliseAnswers(answers: InterviewAnswers): NormalisedAnswers {
  const monthlyRent = parseMoney(answers.monthlyRent ?? '');
  const depositText = (answers.deposit ?? '').trim();

  let depositAmount: number | null = null;
  let depositMonths: number | null = null;

  // Deposit expressed directly in months ("2 months of rent") takes precedence
  const months = parseMonthsCount(depositText);
  if (months !== null) {
    depositMonths = months;
  } else {
    const amount = parseMoney(depositText);
    depositAmount = amount;
    if (amount !== null && monthlyRent !== null && monthlyRent > 0) {
      depositMonths = Math.round((amount / monthlyRent) * 10) / 10;
    }
  }

  return {
    city: answers.city?.trim() || null,
    monthlyRent,
    deposit:
      depositAmount !== null || depositMonths !== null
        ? { amount: depositAmount, months: depositMonths }
        : null,
    duration: parseDuration(answers.duration ?? ''),
    lockIn: parseLockIn(answers.lockIn ?? ''),
    noticePeriod: parseNoticePeriod(answers.noticePeriod ?? ''),
    maintenance: parseMaintenance(answers.maintenance ?? ''),
    repairs: parseRepairs(answers.repairs ?? ''),
    increase: parseIncrease(answers.increase ?? ''),
    extras: answers.extras ?? [],
  };
}

export function formatMoney(amount: number | null): string {
  if (amount === null) return 'Not specified';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatMonths(months: number | null): string {
  if (months === null) return 'Not specified';
  return `${months} month${months !== 1 ? 's' : ''}`;
}

export function formatDays(days: number | null): string {
  if (days === null) return 'Not specified';
  if (days % 30 === 0) return `${days / 30} month${days / 30 !== 1 ? 's' : ''}`;
  if (days % 7 === 0) return `${days / 7} week${days / 7 !== 1 ? 's' : ''}`;
  return `${days} day${days !== 1 ? 's' : ''}`;
}
