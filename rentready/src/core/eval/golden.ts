/**
 * Golden-set scoring (AI_PIPELINE §8), shared by the CI test (offline part) and `npm run eval`
 * (live part). Pure: it scores results, it never calls a model.
 */

import { z } from 'zod';
import type { AnalysisResult, AskResult, Clause, InterviewAnswers } from '../types.js';
import { INITIAL_INTERVIEW_ANSWERS } from '../interview/questions.js';
import { protectionIdSchema } from '../schemas.js';

export const goldenExpectedSchema = z.object({
  description: z.string(),
  interview: z.record(z.union([z.string(), z.array(z.string())])),
  expectVerdicts: z.record(z.enum(['matches', 'differs', 'not_covered', 'unclear'])),
  expectAbsent: z.array(protectionIdSchema),
  expectRules: z.array(z.string()),
  questions: z.array(
    z.object({
      q: z.string(),
      expect: z.enum(['answered', 'not_in_document', 'needs_professional']),
      clauseLabels: z.array(z.string()).optional(),
    })
  ),
});

export type GoldenExpected = z.infer<typeof goldenExpectedSchema>;

/** The interview answers a golden case describes, on top of an empty interview. */
export function goldenAnswers(expected: GoldenExpected): InterviewAnswers {
  const answers: InterviewAnswers = { ...INITIAL_INTERVIEW_ANSWERS, extras: [] };
  for (const [key, value] of Object.entries(expected.interview)) {
    if (key === 'extras') answers.extras = Array.isArray(value) ? value : [value];
    else if (key in answers && typeof value === 'string') {
      (answers as unknown as Record<string, string>)[key] = value;
    }
  }
  return answers;
}

export interface Tally {
  hit: number;
  total: number;
}

const tally = (hit: number, total: number): Tally => ({ hit, total });
export const rate = ({ hit, total }: Tally): number => (total === 0 ? 1 : hit / total);

/** Rule precision/recall against the exact expected set (offline, deterministic). */
export function scoreRules(result: AnalysisResult, expected: GoldenExpected) {
  const got = new Set(result.rules.map(r => r.ruleId));
  const want = new Set(expected.expectRules);
  return {
    recall: tally([...want].filter(id => got.has(id)).length, want.size),
    precision: tally([...got].filter(id => want.has(id)).length, got.size),
    missing: [...want].filter(id => !got.has(id)),
    unexpected: [...got].filter(id => !want.has(id)),
  };
}

/** Verdict accuracy, absence detection and quote-verification rate for an AI analysis. */
export function scoreAnalysis(result: AnalysisResult, expected: GoldenExpected) {
  const verdicts = Object.entries(expected.expectVerdicts);
  const verdictHits = verdicts.filter(
    ([key, want]) => result.matches.find(m => m.key === key)?.verdict === want
  ).length;
  const absentHits = expected.expectAbsent.filter(
    id => result.gaps.find(g => g.id === id)?.state === 'absent'
  ).length;
  const evidence = [...result.matches, ...result.gaps].map(r => r.evidence).filter(e => e !== null);
  const verified = evidence.filter(e => e.status !== 'unverified').length;
  return {
    verdicts: tally(verdictHits, verdicts.length),
    absence: tally(absentHits, expected.expectAbsent.length),
    quotes: tally(verified, evidence.length),
  };
}

/** Whether an Ask answer has the expected status and, where given, cites the expected clause. */
export function askCorrect(
  result: AskResult,
  want: GoldenExpected['questions'][number],
  clauses: Clause[]
): boolean {
  if (result.status !== want.expect) return false;
  if (!want.clauseLabels) return true;
  const cited = new Set(
    result.citations.map(c => clauses.find(cl => cl.id === c.clauseId)?.label ?? null)
  );
  return want.clauseLabels.some(label => cited.has(label));
}
