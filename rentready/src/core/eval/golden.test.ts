/**
 * The offline half of the golden set runs in CI: every agreement's rule findings must match
 * its expected.json exactly, and the fixtures must be well-formed for `npm run eval`.
 */
import { describe, expect, it } from 'vitest';
import { segmentClauses } from '../parsing/segmenter';
import { analyseDocument } from '../analysis';
import {
  askCorrect,
  goldenAnswers,
  goldenExpectedSchema,
  rate,
  scoreAnalysis,
  scoreRules,
} from './golden';

const texts = import.meta.glob('../../../tests/fixtures/agreements/*.txt', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;
const expectations = import.meta.glob('../../../tests/fixtures/agreements/*.expected.json', {
  import: 'default',
  eager: true,
}) as Record<string, unknown>;

const cases = Object.entries(texts).map(([path, text]) => {
  const name = path.split('/').pop()!.replace('.txt', '');
  const raw = Object.entries(expectations).find(([p]) => p.endsWith(`/${name}.expected.json`))?.[1];
  return { name, text, expected: goldenExpectedSchema.parse(raw) };
});

describe('golden set', () => {
  it('has the five agreements the plan calls for, each with expectations', () => {
    expect(cases.map(c => c.name).sort()).toEqual([
      'deposit-heavy',
      'fair',
      'lockin-heavy',
      'regional-schedules',
      'sparse',
    ]);
  });

  for (const { name, text, expected } of cases) {
    it(`${name}: offline rule findings match exactly`, () => {
      const clauses = segmentClauses(text);
      const result = analyseDocument({
        answers: goldenAnswers(expected),
        clauses,
        localOnly: true,
      });
      const score = scoreRules(result, expected);
      expect({ missing: score.missing, unexpected: score.unexpected }).toEqual({
        missing: [],
        unexpected: [],
      });
    });

    it(`${name}: every question's expected clause exists`, () => {
      const labels = new Set(segmentClauses(text).map(c => c.label));
      for (const q of expected.questions) {
        for (const label of q.clauseLabels ?? []) expect(labels, q.q).toContain(label);
      }
    });
  }
});

describe('scoring helpers', () => {
  const expected = cases.find(c => c.name === 'fair')!.expected;
  const clauses = segmentClauses(cases.find(c => c.name === 'fair')!.text);
  const notice = clauses.find(c => c.label === '8')!;

  it('scores verdicts, absence and quote verification', () => {
    const result = analyseDocument({
      answers: goldenAnswers(expected),
      clauses,
      modelResponse: {
        overview: 'x',
        matchFindings: [
          {
            key: 'noticePeriod',
            found: true,
            writtenValue: '1 month',
            clauseId: notice.id,
            quote: "Either party shall give one month's written notice",
            ambiguity: null,
          },
        ],
        protectionFindings: [
          { id: 'RENT_INCREASE', state: 'absent', summary: null, clauseId: null, quote: null },
          {
            id: 'ENTRY_NOTICE',
            state: 'present',
            summary: null,
            clauseId: notice.id,
            quote: 'made-up words here',
          },
        ],
      },
    });
    const s = scoreAnalysis(result, expected);
    expect(s.verdicts).toEqual({ hit: 1, total: 4 });
    expect(s.absence).toEqual({ hit: 1, total: 2 });
    expect(s.quotes).toEqual({ hit: 1, total: 2 });
    expect(rate(s.verdicts)).toBe(0.25);
    expect(rate({ hit: 0, total: 0 })).toBe(1);
    expect(goldenAnswers({ ...expected, interview: { extras: 'Parking' } }).extras).toEqual([
      'Parking',
    ]);
  });

  it('checks Ask status and the cited clause', () => {
    const q = expected.questions[0]!;
    const cite = { clauseId: notice.id, quote: 'x', status: 'verified' as const };
    const base = { answer: '', missingInfo: [], suggestedQuestions: [] };
    expect(askCorrect({ ...base, status: 'answered', citations: [cite] }, q, clauses)).toBe(true);
    expect(askCorrect({ ...base, status: 'answered', citations: [] }, q, clauses)).toBe(false);
    expect(askCorrect({ ...base, status: 'not_in_document', citations: [] }, q, clauses)).toBe(
      false
    );
    expect(
      askCorrect(
        { ...base, status: 'not_in_document', citations: [] },
        expected.questions[1]!,
        clauses
      )
    ).toBe(true);
  });
});
