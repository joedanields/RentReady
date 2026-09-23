import { describe, it, expect } from 'vitest';
import { LIMITS, type LimitKey } from './limits';

describe('LIMITS', () => {
  it('enforces sane file and text caps', () => {
    expect(LIMITS.MAX_FILE_SIZE).toBe(10 * 1024 * 1024);
    expect(LIMITS.MAX_PAGES).toBe(40);
    expect(LIMITS.MAX_CHARS).toBe(120_000);
    expect(LIMITS.MAX_CLAUSES_PER_CALL).toBe(120);
  });

  it('keeps quote and question limits consistent with verifyQuote behaviour', () => {
    expect(LIMITS.MIN_QUOTE_LENGTH).toBe(12);
    expect(LIMITS.MAX_QUOTE_LENGTH).toBe(200);
    expect(LIMITS.MAX_QUESTION_CHARS).toBe(500);
  });

  it('provides an analysis budget, timeout and token caps', () => {
    expect(LIMITS.DEFAULT_BUDGET).toBe(12);
    expect(LIMITS.ANALYSIS_TIMEOUT).toBe(25_000);
    expect(LIMITS.MAX_ANALYSIS_TOKENS).toBe(8192);
    expect(LIMITS.MAX_SMALL_CALL_TOKENS).toBe(1536);
  });

  it('exposes every key via LimitKey', () => {
    const keys: LimitKey[] = Object.keys(LIMITS) as LimitKey[];
    expect(keys).toEqual([
      'MAX_FILE_SIZE',
      'MAX_PAGES',
      'MAX_CHARS',
      'MAX_CLAUSES_PER_CALL',
      'DEFAULT_BUDGET',
      'MAX_QUESTION_CHARS',
      'MIN_QUOTE_LENGTH',
      'MAX_QUOTE_LENGTH',
      'ANALYSIS_TIMEOUT',
      'MAX_ANALYSIS_TOKENS',
      'MAX_SMALL_CALL_TOKENS',
    ]);
  });
});
