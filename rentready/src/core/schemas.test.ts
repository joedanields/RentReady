import { describe, it, expect } from 'vitest';
import {
  modelAnalysisResponseSchema,
  modelAskResponseSchema,
  modelNegotiationResponseSchema,
  protectionIdSchema,
  clauseSchema,
  verifiedQuoteSchema,
  validateModelAnalysis,
  validateModelAsk,
  validateModelNegotiation,
  validateInterviewAnswers,
  validateClauses,
  validateUrlParams,
  validateFileInput,
} from './schemas';

const analysis = {
  overview: 'ok',
  matchFindings: [
    {
      key: 'monthlyRent',
      found: true,
      writtenValue: '₹40,000',
      clauseId: 'c1',
      quote: null,
      ambiguity: null,
    },
  ],
  protectionFindings: [
    { id: 'ENTRY_NOTICE', state: 'absent', summary: null, clauseId: null, quote: null },
  ],
};

const ask = {
  status: 'answered',
  answer: 'Rent is due on the 5th.',
  citations: [{ clauseId: 'c1', quote: 'due on the fifth day' }],
  missingInfo: [],
  suggestedQuestions: ['When is rent due?'],
};

const negotiation = {
  message: 'Hi, please change it.',
  items: [
    {
      rowId: 'match-monthlyRent',
      ask: 'About rent',
      reason: 'Mismatch',
      suggestedWording: 'Rent: ₹40,000.',
    },
  ],
};

const interview = {
  city: 'Pune',
  monthlyRent: '40000',
  deposit: '2 months',
  duration: '11 months',
  lockIn: 'no',
  noticePeriod: '1 month',
  maintenance: 'owner',
  repairs: 'split',
  increase: 'no',
  extras: ['Parking included'],
};

describe('schema success paths', () => {
  it('parses valid model analysis', () => {
    expect(modelAnalysisResponseSchema.parse(analysis)).toBeDefined();
    expect(validateModelAnalysis(analysis).overview).toBe('ok');
  });

  it('parses valid ask and negotiation responses', () => {
    expect(modelAskResponseSchema.parse(ask).status).toBe('answered');
    expect(validateModelAsk({ ...ask, status: 'needs_professional' }).status).toBe(
      'needs_professional'
    );
    expect(modelNegotiationResponseSchema.parse(negotiation).message).toBe('Hi, please change it.');
    expect(validateModelNegotiation(negotiation).items).toHaveLength(1);
  });

  it('parses valid interview answers', () => {
    expect(validateInterviewAnswers(interview).extras).toEqual(['Parking included']);
  });

  it('parses a valid clause', () => {
    const clause = {
      id: 'c1',
      label: '1.',
      heading: null,
      text: 'text',
      page: 1,
      pageEnd: 2,
      order: 1,
    };
    expect(clauseSchema.parse(clause).order).toBe(1);
    expect(validateClauses([clause])).toHaveLength(1);
  });

  it('accepts verified quotes without offsets', () => {
    const q = { clauseId: 'c1', quote: 'some long quote', status: 'verified' };
    expect(verifiedQuoteSchema.parse(q).start).toBeUndefined();
    expect(verifiedQuoteSchema.parse({ ...q, start: 3, end: 9 }).end).toBe(9);
  });

  it('parses url params and file input', () => {
    expect(validateUrlParams({}).lang).toBeUndefined();
    expect(validateUrlParams({ demo: '1', lang: 'hi' })).toEqual({ demo: '1', lang: 'hi' });
    expect(validateFileInput({ name: 'a.pdf', type: 'pdf', size: 1024 })).toEqual({
      name: 'a.pdf',
      type: 'pdf',
      size: 1024,
    });
  });

  it('accepts every protection id', () => {
    expect(protectionIdSchema.parse('DEPOSIT_AMOUNT')).toBe('DEPOSIT_AMOUNT');
    expect(protectionIdSchema.parse('DISPUTE_RESOLUTION')).toBe('DISPUTE_RESOLUTION');
  });
});

describe('schema rejection paths', () => {
  it('rejects invalid model analysis', () => {
    expect(() => modelAnalysisResponseSchema.parse({ overview: 42 })).toThrow();
    expect(() => validateModelAnalysis({ ...analysis, matchFindings: [{ key: 1 }] })).toThrow();
  });

  it('rejects a bad protection state', () => {
    expect(() =>
      modelAnalysisResponseSchema.parse({
        ...analysis,
        protectionFindings: [{ id: 'ENTRY_NOTICE', state: 'maybe' }],
      })
    ).toThrow();
  });

  it('rejects an unknown ask status', () => {
    expect(() => modelAskResponseSchema.parse({ ...ask, status: 'maybe' })).toThrow();
  });

  it('rejects negotiation rows missing fields', () => {
    expect(() =>
      modelNegotiationResponseSchema.parse({ message: 'x', items: [{ rowId: 'a' }] })
    ).toThrow();
  });

  it('rejects interview answers with bad extras or missing keys', () => {
    expect(() => validateInterviewAnswers({ ...interview, extras: ['ok', 42] })).toThrow();
    expect(() => validateInterviewAnswers({ ...interview, extras: undefined })).toThrow();
  });

  it('rejects invalid protection ids, clauses and url params', () => {
    expect(() => protectionIdSchema.parse('NOT_A_PROTECTION')).toThrow();
    expect(() => clauseSchema.parse({ id: 'c1', text: 'text', order: 1, page: null })).toThrow();
    expect(() => validateUrlParams({ demo: 'yes' })).toThrow();
    expect(() => validateFileInput({ size: 'big' })).toThrow();
  });
});
