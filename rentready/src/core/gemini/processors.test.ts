import { describe, it, expect } from 'vitest';
import { processAskResponse, localAskResult } from './processors';
import type { Clause } from '../types';

const CLAUSES: Clause[] = [
  {
    id: 'c001',
    label: '1.',
    heading: null,
    text: 'The rent is payable on the fifth day of every month in advance.',
    page: 1,
    pageEnd: 1,
    order: 1,
  },
];

const response = (status: string, citations: Array<{ clauseId: string; quote: string }>) => ({
  status,
  answer: 'Some answer',
  citations,
  missingInfo: ['break clause'],
  suggestedQuestions: ['Is there a break clause?'],
});

describe('processAskResponse', () => {
  it('keeps answered status when at least one citation verifies', () => {
    const out = processAskResponse({
      clauses: CLAUSES,
      modelResponse: response('answered', [
        { clauseId: 'c001', quote: 'rent is payable on the fifth day' },
      ]),
    });
    expect(out.status).toBe('answered');
    expect(out.citations).toHaveLength(1);
    expect(out.citations[0]!.status).toBe('verified');
  });

  it('downgrades answered to not_in_document when no citation verifies', () => {
    const out = processAskResponse({
      clauses: CLAUSES,
      modelResponse: response('answered', [
        { clauseId: 'c001', quote: 'completely made up quote' },
      ]),
    });
    expect(out.status).toBe('not_in_document');
    expect(out.citations).toEqual([]);
    expect(out.missingInfo).toEqual(['break clause']);
    expect(out.suggestedQuestions).toEqual(['Is there a break clause?']);
  });

  it('drops citations for unknown clause ids', () => {
    const out = processAskResponse({
      clauses: CLAUSES,
      modelResponse: response('answered', [
        { clauseId: 'c999', quote: 'rent is payable on the fifth day' },
        { clauseId: 'c001', quote: 'rent is payable on the fifth day' },
      ]),
    });
    expect(out.citations).toHaveLength(1);
    expect(out.citations[0]!.clauseId).toBe('c001');
  });

  it('passes through not_in_document and needs_professional with all citations', () => {
    const resp = response('needs_professional', [
      { clauseId: 'c001', quote: 'made up quote body text' },
    ]);
    const out = processAskResponse({ clauses: CLAUSES, modelResponse: resp });
    expect(out.status).toBe('needs_professional');
    expect(out.citations).toHaveLength(1);
    expect(out.citations[0]!.status).toBe('unverified');
  });

  it('throws a validation error for malformed model output', () => {
    expect(() =>
      processAskResponse({ clauses: CLAUSES, modelResponse: { answer: 42 } })
    ).toThrowError();
  });
});

describe('localAskResult', () => {
  it('returns the demo-mode fallback', () => {
    const out = localAskResult();
    expect(out.status).toBe('not_in_document');
    expect(out.citations).toEqual([]);
    expect(out.answer).toContain('Demo mode');
  });
});
