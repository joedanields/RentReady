import { describe, expect, it } from 'vitest';
import { extractFacts, periodDays, rupeesIn } from './extract';
import type { Clause } from '../types';

const clauses = (...texts: string[]): Clause[] =>
  texts.map((text, i) => ({
    id: `c${i + 1}`,
    label: null,
    heading: null,
    text,
    page: null,
    pageEnd: null,
    order: i + 1,
  }));

describe('periodDays', () => {
  it('reads digits, words, "word (digit)" and every unit', () => {
    expect(periodDays('eleven (11) months')).toBe(330);
    expect(periodDays('six months')).toBe(180);
    expect(periodDays('1.5 months')).toBe(45);
    expect(periodDays('45 days')).toBe(45);
    expect(periodDays('two weeks')).toBe(14);
    expect(periodDays('a term of 2 years')).toBe(730);
  });

  it('returns null when there is no period', () => {
    expect(periodDays('as soon as possible')).toBeNull();
    expect(periodDays('24 hours')).toBeNull();
  });
});

describe('rupeesIn', () => {
  it('reads Rs., INR and ₹ amounts', () => {
    expect(rupeesIn('Rs. 1,20,000/-')).toBe(120000);
    expect(rupeesIn('INR 40000')).toBe(40000);
    expect(rupeesIn('₹ 5,500.50')).toBe(5500.5);
  });

  it('returns null without an amount, or for zero', () => {
    expect(rupeesIn('forty thousand rupees')).toBeNull();
    expect(rupeesIn('Rs. 0')).toBeNull();
  });
});

describe('extractFacts', () => {
  it('reads a deposit stated in digit months', () => {
    const f = extractFacts(clauses('A security deposit of 3 months rent is payable.'));
    expect(f.deposit?.value).toEqual({ amount: null, months: 3 });
  });

  it('keeps an amount-only deposit with unknown months when the rent is not written', () => {
    const f = extractFacts(clauses('The security deposit of Rs. 90,000 is refundable.'));
    expect(f.deposit?.value).toEqual({ amount: 90000, months: null });
  });

  it('does not mistake the deposit clause for the rent', () => {
    const f = extractFacts(
      clauses("A security deposit of Rs. 1,20,000, being three months' rent of Rs. 40,000.")
    );
    expect(f.rent).toBeNull();
    expect(f.deposit?.value.months).toBe(3);
  });

  it('never reads the term from the lock-in clause', () => {
    const f = extractFacts(
      clauses(
        'Lock-in: the Tenant shall not leave for a period of 6 months.',
        'The term of 11 months starts today.'
      )
    );
    expect(f.lockInDays?.value).toBe(180);
    expect(f.durationDays?.value).toBe(330);
  });

  it('skips notice sentences with no period', () => {
    const f = extractFacts(
      clauses(
        'The Tenant shall give written notice by email.',
        "The Tenant shall give 30 days' notice."
      )
    );
    expect(f.noticeTenantDays?.value).toBe(30);
    expect(f.noticeTenantDays?.clause.id).toBe('c2');
    expect(f.noticeLandlordDays).toBeNull();
  });

  it('returns nulls for an agreement that states none of these', () => {
    expect(extractFacts(clauses('The premises are a 2BHK flat.'))).toEqual({
      rent: null,
      deposit: null,
      lockInDays: null,
      durationDays: null,
      noticeTenantDays: null,
      noticeLandlordDays: null,
    });
  });
});
