import { describe, expect, it } from 'vitest';
import { ui } from '../../i18n/en';
import { INTERVIEW_QUESTIONS, INITIAL_INTERVIEW_ANSWERS } from '../../core/interview/questions';
import { normaliseAnswers } from '../../core/interview/normalise';
import type { InterviewAnswers } from '../../core/types';
import {
  FOLLOW_UPS,
  chipLabel,
  displayAnswer,
  moneyEcho,
  optionLabel,
  parseTextAnswer,
  questionHint,
  questionLabel,
  questionPlaceholder,
  selectedOption,
} from './answerText';

const q = (key: keyof InterviewAnswers) => {
  const found = INTERVIEW_QUESTIONS.find(x => x.key === key);
  if (!found) throw new Error(key);
  return found;
};
const answers = (patch: Partial<InterviewAnswers>): InterviewAnswers => ({
  ...INITIAL_INTERVIEW_ANSWERS,
  ...patch,
});

describe('interview strings', () => {
  it('has an English string for every question, hint, option and chip', () => {
    const keys = Object.keys(ui);
    for (const question of INTERVIEW_QUESTIONS) {
      expect(keys).toContain(`q.${question.key}.label`);
      expect(keys).toContain(`q.${question.key}.hint`);
      for (const opt of question.options ?? [])
        expect(keys).toContain(`opt.${question.key}.${opt.value}`);
      for (const chip of question.chips ?? []) expect(keys).toContain(`chip.${chip}`);
    }
  });

  it('reads labels through t() and falls back to the core text for unknown keys', () => {
    expect(questionLabel(q('city'))).toBe(ui['q.city.label']);
    expect(questionHint(q('city'))).toBe(ui['q.city.hint']);
    expect(questionPlaceholder(q('monthlyRent'))).toBe(ui['q.monthlyRent.placeholder']);
    expect(questionPlaceholder(q('duration'))).toBeUndefined();
    expect(optionLabel(q('lockIn'), 'no')).toBe(ui['opt.lockIn.no']);
    expect(optionLabel(q('lockIn'), 'unknown')).toBe('unknown');
    expect(chipLabel('Pets allowed')).toBe('Pets allowed');
    expect(chipLabel('A new sofa')).toBe('A new sofa');
    const custom = {
      ...q('city'),
      key: 'zzz' as keyof InterviewAnswers,
      label: 'Fallback',
      hint: 'Hint',
    };
    expect(questionLabel(custom)).toBe('Fallback');
    expect(questionHint(custom)).toBe('Hint');
    expect(questionPlaceholder(custom)).toBe(q('city').placeholder);
  });

  it('falls back to the core option label when a translation is missing', () => {
    const custom = { ...q('lockIn'), key: 'zzz' as keyof InterviewAnswers };
    expect(optionLabel(custom, 'no')).toBe('No lock-in');
  });
});

describe('parseTextAnswer', () => {
  it('treats empty input as a skip', () => {
    expect(parseTextAnswer('monthlyRent', '   ')).toBeNull();
  });

  it('accepts the rent formats from the spec and rejects junk', () => {
    for (const s of ['40000', '40,000', '₹40k', 'Rs. 40000/-', 'INR 40,000']) {
      expect(parseTextAnswer('monthlyRent', s)).toEqual({ ok: true, value: s });
    }
    expect(parseTextAnswer('monthlyRent', 'lots')).toEqual({ ok: false, error: 'errMoney' });
  });

  it('accepts a deposit as an amount or in months', () => {
    expect(parseTextAnswer('deposit', '80000')).toEqual({ ok: true, value: '80000' });
    expect(parseTextAnswer('deposit', 'two months')).toEqual({ ok: true, value: 'two months' });
    expect(parseTextAnswer('deposit', 'a lot')).toEqual({ ok: false, error: 'errDeposit' });
  });

  it('keeps free text as typed for the city', () => {
    expect(parseTextAnswer('city', ' Pune ')).toEqual({ ok: true, value: 'Pune' });
  });
});

describe('moneyEcho', () => {
  it('echoes the normalised rent', () => {
    expect(moneyEcho('monthlyRent', '₹40k', null)).toBe('₹40,000');
    expect(moneyEcho('monthlyRent', 'nonsense', null)).toBeNull();
    expect(moneyEcho('monthlyRent', '', null)).toBeNull();
  });

  it('relates a deposit amount to the rent when the rent is known', () => {
    expect(moneyEcho('deposit', '80000', '40000')).toBe("₹80,000 — about 2 months' rent");
    expect(moneyEcho('deposit', '100000', '40000')).toBe("₹1,00,000 — about 2.5 months' rent");
    expect(moneyEcho('deposit', '80000', null)).toBe('₹80,000');
  });

  it('turns a deposit in months into rupees when the rent is known', () => {
    expect(moneyEcho('deposit', 'two months', '40000')).toBe("2 months' rent — about ₹80,000");
    expect(moneyEcho('deposit', '3 months', null)).toBe("3 months' rent");
  });

  it('never echoes for non-money questions', () => {
    expect(moneyEcho('city', '40000', null)).toBeNull();
  });
});

describe('follow-ups', () => {
  it('composes lock-in months that normalise.ts can read', () => {
    const f = FOLLOW_UPS.lockIn!;
    expect(f.compose('6')).toBe('6 months');
    expect(normaliseAnswers(answers({ lockIn: f.compose('6') })).lockIn).toBe(180);
    expect(f.compose('0')).toBeNull();
    expect(f.compose('61')).toBeNull();
    expect(f.compose('six')).toBeNull();
    expect(f.decompose('6 months')).toBe('6');
    expect(f.decompose('weird')).toBe('');
  });

  it('composes an increase percentage that normalise.ts can read', () => {
    const f = FOLLOW_UPS.increase!;
    expect(f.compose('7.5')).toBe('7.5%');
    expect(f.compose('10%')).toBe('10%');
    expect(normaliseAnswers(answers({ increase: f.compose('10') })).increase).toBe(10);
    expect(f.compose('150')).toBeNull();
    expect(f.compose('ten')).toBeNull();
    expect(f.decompose('10%')).toBe('10');
  });

  it('keeps "other" durations and notice periods only when they parse', () => {
    expect(FOLLOW_UPS.duration!.compose(' 3 years ')).toBe('3 years');
    expect(FOLLOW_UPS.duration!.compose('a while')).toBeNull();
    expect(FOLLOW_UPS.duration!.decompose('3 years')).toBe('3 years');
    expect(FOLLOW_UPS.noticePeriod!.compose('45 days')).toBe('45 days');
    expect(FOLLOW_UPS.noticePeriod!.compose('soon')).toBeNull();
    expect(FOLLOW_UPS.noticePeriod!.decompose('45 days')).toBe('45 days');
  });
});

describe('selectedOption', () => {
  it('maps stored answers back to the option that produced them', () => {
    expect(selectedOption(q('lockIn'), null)).toBeNull();
    expect(selectedOption(q('lockIn'), 'no')).toBe('no');
    expect(selectedOption(q('lockIn'), '6 months')).toBe('yes');
    expect(selectedOption(q('duration'), '3 years')).toBe('other');
    expect(selectedOption(q('maintenance'), 'garbage')).toBeNull();
  });
});

describe('displayAnswer', () => {
  it('shows skipped questions as null', () => {
    expect(displayAnswer(q('city'), answers({}))).toBeNull();
    expect(displayAnswer(q('extras'), answers({}))).toBeNull();
  });

  it('formats money, options and follow-up details', () => {
    const a = answers({
      city: 'Pune',
      monthlyRent: '40k',
      deposit: '80000',
      duration: '11 months',
      lockIn: '6 months',
      increase: '10%',
      noticePeriod: '45 days',
      maintenance: 'owner',
      extras: ['Pets allowed', 'New mattress'],
    });
    expect(displayAnswer(q('city'), a)).toBe('Pune');
    expect(displayAnswer(q('monthlyRent'), a)).toBe('₹40,000');
    expect(displayAnswer(q('deposit'), a)).toBe("₹80,000 — about 2 months' rent");
    expect(displayAnswer(q('duration'), a)).toBe('11 months');
    expect(displayAnswer(q('lockIn'), a)).toBe('Yes, a minimum stay — 6 months');
    expect(displayAnswer(q('increase'), a)).toBe('Yes, a yearly increase — 10% a year');
    expect(displayAnswer(q('noticePeriod'), a)).toBe('Something else — 45 days');
    expect(displayAnswer(q('maintenance'), a)).toBe('The owner');
    expect(displayAnswer(q('extras'), a)).toBe('Pets allowed, New mattress');
  });

  it('shows unreadable stored values as typed rather than hiding them', () => {
    expect(displayAnswer(q('monthlyRent'), answers({ monthlyRent: 'lots' }))).toBe('lots');
    expect(displayAnswer(q('maintenance'), answers({ maintenance: 'garbage' }))).toBe('garbage');
  });
});
