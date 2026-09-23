/**
 * Interview UI logic that isn't rendering: labels via t(), validation, the live normalised echo,
 * follow-up questions ("Yes → how many months?") and the summary text. Stored answers are the
 * strings `src/core/interview/normalise.ts` already understands, so the UI can never invent a
 * format the verdict code doesn't parse.
 */

import { t, type UiKey } from '../../i18n';
import { ui } from '../../i18n/en';
import type { InterviewAnswers } from '../../core/types';
import type { InterviewQuestion } from '../../core/interview/questions';
import {
  formatMoney,
  parseDuration,
  parseMoney,
  parseMonthsCount,
  parseNoticePeriod,
} from '../../core/interview/normalise';

export type AnswerKey = keyof InterviewAnswers;

/** Option values that mean "no promise was made" — stored as a skip (INTERVIEW_SPEC). */
export const NO_PROMISE_VALUES: ReadonlySet<string> = new Set(['not_sure', 'not_discussed']);

function isUiKey(key: string): key is UiKey {
  return Object.prototype.hasOwnProperty.call(ui, key);
}

/** Translate a computed key, falling back to the given English text if the key is missing. */
function tOr(key: string, fallback: string): string {
  return isUiKey(key) ? t(key) : fallback;
}

export function questionLabel(q: InterviewQuestion): string {
  return tOr(`q.${q.key}.label`, q.label);
}

export function questionHint(q: InterviewQuestion): string {
  return tOr(`q.${q.key}.hint`, q.hint);
}

export function questionPlaceholder(q: InterviewQuestion): string | undefined {
  return tOr(`q.${q.key}.placeholder`, q.placeholder ?? '') || undefined;
}

export function optionLabel(q: InterviewQuestion, value: string): string {
  const fallback = q.options?.find(o => o.value === value)?.label ?? value;
  return tOr(`opt.${q.key}.${value}`, fallback);
}

export function chipLabel(chip: string): string {
  return tOr(`chip.${chip}`, chip);
}

/** A second input shown when a particular option is chosen (e.g. lock-in "Yes" → months). */
export interface FollowUp {
  trigger: string;
  label: UiKey;
  placeholder: UiKey;
  error: UiKey;
  inputMode: 'numeric' | 'decimal' | 'text';
  /** Stored answer string for a valid input, or null if the input can't be used. */
  compose: (input: string) => string | null;
  /** Recovers the input text from a stored answer, for editing. */
  decompose: (answer: string) => string;
}

function wholeNumberIn(input: string, min: number, max: number): number | null {
  const s = input.trim();
  if (!/^\d+$/.test(s)) return null;
  const n = parseInt(s, 10);
  return n >= min && n <= max ? n : null;
}

export const FOLLOW_UPS: Partial<Record<AnswerKey, FollowUp>> = {
  duration: {
    trigger: 'other',
    label: 'followUp.duration',
    placeholder: 'followUp.duration.placeholder',
    error: 'errDuration',
    inputMode: 'text',
    compose: input => (parseDuration(input) !== null ? input.trim() : null),
    decompose: answer => answer,
  },
  lockIn: {
    trigger: 'yes',
    label: 'followUp.lockIn',
    placeholder: 'followUp.lockIn.placeholder',
    error: 'errLockInMonths',
    inputMode: 'numeric',
    compose: input => {
      const n = wholeNumberIn(input, 1, 60);
      return n === null ? null : `${n} months`;
    },
    decompose: answer => /^(\d+)/.exec(answer)?.[1] ?? '',
  },
  noticePeriod: {
    trigger: 'other',
    label: 'followUp.noticePeriod',
    placeholder: 'followUp.noticePeriod.placeholder',
    error: 'errNotice',
    inputMode: 'text',
    compose: input => (parseNoticePeriod(input) !== null ? input.trim() : null),
    decompose: answer => answer,
  },
  increase: {
    trigger: 'yes',
    label: 'followUp.increase',
    placeholder: 'followUp.increase.placeholder',
    error: 'errIncreasePct',
    inputMode: 'decimal',
    compose: input => {
      const s = input.trim().replace(/%$/, '').trim();
      if (!/^\d+(\.\d+)?$/.test(s)) return null;
      const n = parseFloat(s);
      return n <= 100 ? `${n}%` : null;
    },
    decompose: answer => answer.replace(/%$/, ''),
  },
};

/** Which option a stored answer corresponds to (a follow-up answer maps to its trigger). */
export function selectedOption(q: InterviewQuestion, answer: string | null): string | null {
  if (!answer) return null;
  if (q.options?.some(o => o.value === answer)) return answer;
  return FOLLOW_UPS[q.key]?.trigger ?? null;
}

export type Parsed = { ok: true; value: string } | { ok: false; error: UiKey };

/** Validates a free-text answer (city, rent, deposit). Empty input is a skip, not an error. */
export function parseTextAnswer(key: AnswerKey, input: string): Parsed | null {
  const value = input.trim();
  if (!value) return null;
  if (key === 'monthlyRent') {
    return parseMoney(value) !== null ? { ok: true, value } : { ok: false, error: 'errMoney' };
  }
  if (key === 'deposit') {
    const readable = parseMonthsCount(value) !== null || parseMoney(value) !== null;
    return readable ? { ok: true, value } : { ok: false, error: 'errDeposit' };
  }
  return { ok: true, value };
}

function roundTo1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * The live "₹40,000 — about 2 months' rent" line under money inputs, so the user sees how
 * their answer was understood before it's compared against the agreement.
 */
export function moneyEcho(key: AnswerKey, input: string, rentAnswer: string | null): string | null {
  const value = input.trim();
  if (!value) return null;
  const rent = rentAnswer ? parseMoney(rentAnswer) : null;
  if (key === 'deposit') {
    const months = parseMonthsCount(value);
    if (months !== null) {
      return rent
        ? t('echoDepositMonthsAmount', { months, amount: formatMoney(Math.round(months * rent)) })
        : t('echoDepositMonths', { months });
    }
  }
  if (key !== 'monthlyRent' && key !== 'deposit') return null;
  const amount = parseMoney(value);
  if (amount === null) return null;
  if (key === 'deposit' && rent) {
    return t('echoRentMonths', { amount: formatMoney(amount), months: roundTo1(amount / rent) });
  }
  return t('echoMoney', { amount: formatMoney(amount) });
}

/** How an answer reads on the summary card, or null when the question was skipped. */
export function displayAnswer(q: InterviewQuestion, answers: InterviewAnswers): string | null {
  if (q.key === 'extras') {
    return answers.extras.length ? answers.extras.map(chipLabel).join(', ') : null;
  }
  const answer = answers[q.key];
  if (!answer) return null;
  if (q.key === 'monthlyRent' || q.key === 'deposit') {
    return moneyEcho(q.key, answer, answers.monthlyRent) ?? answer;
  }
  if (q.type !== 'select') return answer;
  const choice = selectedOption(q, answer);
  if (choice === null) return answer;
  if (choice === answer) return optionLabel(q, choice);
  const detail =
    q.key === 'lockIn'
      ? t('monthsUnit', { n: FOLLOW_UPS.lockIn?.decompose(answer) ?? answer })
      : q.key === 'increase'
        ? t('percentUnit', { n: FOLLOW_UPS.increase?.decompose(answer) ?? answer })
        : answer;
  return t('withDetail', { choice: optionLabel(q, choice), detail });
}
