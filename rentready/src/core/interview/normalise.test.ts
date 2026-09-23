import { describe, it, expect } from 'vitest';
import {
  parseMoney,
  parseDuration,
  parseLockIn,
  parseNoticePeriod,
  parseIncrease,
  parseMaintenance,
  parseRepairs,
  normaliseAnswers,
  formatMoney,
  formatMonths,
  formatDays
} from './normalise';

describe('parseMoney', () => {
  it('returns null for empty or whitespace input', () => {
    expect(parseMoney('')).toBeNull();
    expect(parseMoney('   ')).toBeNull();
    expect(parseMoney('  ')).toBeNull();
  });

  it('returns null after symbols are stripped away', () => {
    expect(parseMoney('₹')).toBeNull();
    expect(parseMoney('Rs.')).toBeNull();
    expect(parseMoney('INR')).toBeNull();
  });

  it('parses plain numbers with Indian grouping', () => {
    expect(parseMoney('40000')).toBe(40000);
    expect(parseMoney('40,000')).toBe(40000);
    expect(parseMoney('120000')).toBe(120000);
  });

  it('parses currency prefixes and suffixes', () => {
    expect(parseMoney('₹40k')).toBe(40000);
    expect(parseMoney('40k')).toBe(40000);
    expect(parseMoney('Rs. 40000/-')).toBe(40000);
    expect(parseMoney('INR 40,000')).toBe(40000);
    expect(parseMoney('2 lakh')).toBe(200000);
    expect(parseMoney('1.5L')).toBe(150000);
  });

  it('parses word numbers', () => {
    expect(parseMoney('two lakh')).toBe(200000);
    expect(parseMoney('forty thousand')).toBe(40000);
    expect(parseMoney('one hundred')).toBe(101);
    expect(parseMoney('five')).toBe(5);
    expect(parseMoney('lakh')).toBe(100000);
    expect(parseMoney('thousand')).toBe(1000);
  });

  it('rejects out-of-range and junk values', () => {
    expect(parseMoney('20000000')).toBeNull();
    expect(parseMoney('abc')).toBeNull();
    expect(parseMoney('-5')).toBeNull();
    expect(parseMoney('0')).toBeNull();
    expect(parseMoney('fifty thousand million')).toBe(50000);
    expect(parseMoney('two lakh lakh')).toBeNull();
  });
});

describe('parseDuration', () => {
  it('returns null for empty input', () => {
    expect(parseDuration('')).toBeNull();
    expect(parseDuration('  ')).toBeNull();
  });

  it('maps common durations', () => {
    expect(parseDuration('11 months')).toBe(330);
    expect(parseDuration('1 year')).toBe(365);
    expect(parseDuration('12 months')).toBe(365);
    expect(parseDuration('2 years')).toBe(730);
    expect(parseDuration('24 months')).toBe(730);
  });

  it('parses generic months, years and days', () => {
    expect(parseDuration('6 months')).toBe(180);
    expect(parseDuration('18 months')).toBe(540);
    expect(parseDuration('3 years')).toBe(1095);
    expect(parseDuration('45 days')).toBe(45);
    expect(parseDuration('1.5 years')).toBe(548);
  });

  it('returns null for junk', () => {
    expect(parseDuration('not sure')).toBeNull();
    expect(parseDuration('forever')).toBeNull();
  });
});

describe('parseLockIn', () => {
  it('returns null for no lock-in / not sure / empty', () => {
    expect(parseLockIn('')).toBeNull();
    expect(parseLockIn('no')).toBeNull();
    expect(parseLockIn('not_sure')).toBeNull();
    expect(parseLockIn('yes')).toBeNull();
  });

  it('parses months as days', () => {
    expect(parseLockIn('6 months')).toBe(180);
    expect(parseLockIn('3 months')).toBe(90);
  });
});

describe('parseNoticePeriod', () => {
  it('returns null for not sure / empty / junk', () => {
    expect(parseNoticePeriod('')).toBeNull();
    expect(parseNoticePeriod('not_sure')).toBeNull();
    expect(parseNoticePeriod('whenever')).toBeNull();
  });

  it('parses common notice periods', () => {
    expect(parseNoticePeriod('15 days')).toBe(15);
    expect(parseNoticePeriod('1 month')).toBe(30);
    expect(parseNoticePeriod('2 months')).toBe(60);
    expect(parseNoticePeriod('45 days')).toBe(45);
    expect(parseNoticePeriod('3 months')).toBe(90);
  });
});

describe('parseIncrease', () => {
  it('returns null for no increase / not sure / empty', () => {
    expect(parseIncrease('')).toBeNull();
    expect(parseIncrease('no')).toBeNull();
    expect(parseIncrease('not_sure')).toBeNull();
  });

  it('parses percentages', () => {
    expect(parseIncrease('5%')).toBe(5);
    expect(parseIncrease('10')).toBe(10);
    expect(parseIncrease('7.5')).toBe(7.5);
    expect(parseIncrease('annual hike of 10 %')).toBe(10);
    expect(parseIncrease('vague wording')).toBeNull();
  });
});

describe('parseMaintenance / parseRepairs', () => {
  it('maps the four party values', () => {
    for (const v of ['me', 'owner', 'split', 'not_discussed'] as const) {
      expect(parseMaintenance(v)).toBe(v);
      expect(parseRepairs(v)).toBe(v);
    }
  });

  it('returns null for junk and empty', () => {
    expect(parseMaintenance('')).toBeNull();
    expect(parseMaintenance(null as unknown as string)).toBeNull();
    expect(parseMaintenance('landlord')).toBeNull();
    expect(parseRepairs('')).toBeNull();
    expect(parseRepairs(null as unknown as string)).toBeNull();
    expect(parseRepairs('owner pays')).toBeNull();
  });
});

describe('normaliseAnswers', () => {
  it('computes deposit months from amount and rent', () => {
    const out = normaliseAnswers({
      city: 'Bengaluru',
      monthlyRent: '40000',
      deposit: '120000',
      duration: '11 months',
      lockIn: 'no',
      noticePeriod: '1 month',
      maintenance: 'owner',
      repairs: 'split',
      increase: '5%',
      extras: ['Parking included']
    });
    expect(out.city).toBe('Bengaluru');
    expect(out.monthlyRent).toBe(40000);
    expect(out.deposit).toEqual({ amount: 120000, months: 3 });
    expect(out.duration).toBe(330);
    expect(out.lockIn).toBeNull();
    expect(out.noticePeriod).toBe(30);
    expect(out.maintenance).toBe('owner');
    expect(out.repairs).toBe('split');
    expect(out.increase).toBe(5);
    expect(out.extras).toEqual(['Parking included']);
  });

  it('uses months directly when deposit says "N months"', () => {
    const out = normaliseAnswers({
      city: null,
      monthlyRent: '40000',
      deposit: '2 months',
      duration: null,
      lockIn: null,
      noticePeriod: null,
      maintenance: null,
      repairs: null,
      increase: null,
      extras: []
    });
    expect(out.deposit).toEqual({ amount: null, months: 2 });
  });

  it('returns null deposit when nothing was said', () => {
    const out = normaliseAnswers({
      city: null,
      monthlyRent: null,
      deposit: null,
      duration: null,
      lockIn: null,
      noticePeriod: null,
      maintenance: null,
      repairs: null,
      increase: null,
      extras: []
    });
    expect(out.deposit).toBeNull();
    expect(out.monthlyRent).toBeNull();
  });

  it('treats a missing extras array as empty', () => {
    const out = normaliseAnswers({
      city: null,
      monthlyRent: null,
      deposit: null,
      duration: null,
      lockIn: null,
      noticePeriod: null,
      maintenance: null,
      repairs: null,
      increase: null,
      extras: undefined as unknown as string[]
    });
    expect(out.extras).toEqual([]);
  });
});

describe('formatters', () => {
  it('formatMoney', () => {
    expect(formatMoney(40000)).toBe('₹40,000');
    expect(formatMoney(null)).toBe('Not specified');
  });

  it('formatMonths', () => {
    expect(formatMonths(1)).toBe('1 month');
    expect(formatMonths(3)).toBe('3 months');
    expect(formatMonths(null)).toBe('Not specified');
  });

  it('formatDays', () => {
    expect(formatDays(30)).toBe('1 month');
    expect(formatDays(60)).toBe('2 months');
    expect(formatDays(7)).toBe('1 week');
    expect(formatDays(14)).toBe('2 weeks');
    expect(formatDays(45)).toBe('45 days');
    expect(formatDays(1)).toBe('1 day');
    expect(formatDays(null)).toBe('Not specified');
  });
});