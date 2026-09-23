/** Analysis orchestrator — pure TS. Model reports, code judges. Runs in Node (eval) and browser. */

import type {
  AnalysisResult,
  Clause,
  GapRow,
  InterviewAnswers,
  MatchRow,
  VerifiedQuote,
} from './types.js';
import { validateModelAnalysis } from './schemas.js';
import { normaliseAnswers } from './interview/normalise.js';
import { buildMatchRows } from './interview/compare.js';
import { buildGapRows } from './rules/protections.js';
import { runRules, buildDerived, type RuleContext } from './rules/rental.js';
import { verifyQuote } from './verify/verifyQuote.js';
import { LIMITS } from './limits.js';

export interface AnalysisInput {
  /** What the user said they were promised */
  answers: InterviewAnswers;
  /** Segmented clauses from the document */
  clauses: Clause[];
  /** The parsed (not yet validated) model response. Empty/absent for local-only mode. */
  modelResponse?: unknown;
  /** Local-only mode: skip model findings entirely (Phase 4 behavior) */
  localOnly?: boolean;
}

/** Verify all quotes from a model finding, keyed by clauseId (first hit wins, else null) */
export function verifyFindingQuotes(
  clauses: Clause[],
  findings: Array<{ clauseId: string | null; quote: string | null }>
): Map<string, VerifiedQuote | null> {
  const clauseMap = new Map(clauses.map(c => [c.id, c]));
  const verified = new Map<string, VerifiedQuote | null>();
  const seen = new Set<string>();

  for (const finding of findings) {
    if (!finding.clauseId || !finding.quote) continue;
    if (seen.has(finding.clauseId)) continue;
    seen.add(finding.clauseId);
    const clause = clauseMap.get(finding.clauseId);
    if (!clause) {
      verified.set(finding.clauseId, null); // unknown clauseId -> no evidence
      continue;
    }
    if (finding.quote.length > LIMITS.MAX_QUOTE_LENGTH) continue;
    verified.set(finding.clauseId, verifyQuote(clause.text, finding.quote, finding.clauseId));
  }
  return verified;
}

/** Demote any gap whose evidence didn't verify to 'unclear' */
export function demoteGapEvidence(gaps: GapRow[]): GapRow[] {
  return gaps.map(g => {
    if (
      g.state === 'present' &&
      g.evidence &&
      g.evidence.status !== 'verified' &&
      g.evidence.status !== 'fuzzy'
    ) {
      return { ...g, state: 'unclear' };
    }
    return g;
  });
}

export function analyseDocument(input: AnalysisInput): AnalysisResult {
  const local = input.localOnly === true || !input.modelResponse;
  const clauseMapText = new Map(input.clauses.map(c => [c.id, c.text]));

  let matchFindings: Array<{
    key: string;
    found: boolean;
    writtenValue: string | null;
    clauseId: string | null;
    quote: string | null;
    ambiguity: string | null;
  }> = [];
  let protectionFindings: Array<{
    id: string;
    state: 'present' | 'absent' | 'unclear';
    summary: string | null;
    clauseId: string | null;
    quote: string | null;
  }> = [];
  let overview = '';

  if (!local) {
    const validated = validateModelAnalysis(input.modelResponse);
    overview = validated.overview ?? '';
    matchFindings = validated.matchFindings.filter(
      f => f.clauseId === null || clauseMapText.has(f.clauseId)
    );
    protectionFindings = validated.protectionFindings;
  }

  const verified = verifyFindingQuotes(input.clauses, matchFindings);

  // Model reports, code judges
  const matches: MatchRow[] = buildMatchRows(input.answers, matchFindings, verified);

  // Build gaps from model findings (or all-unclear in local mode)
  const gaps = demoteGapEvidence(
    buildGapRows(
      local
        ? PROTECTION_PLACEHOLDER
        : protectionFindings.map(f => ({
            id: f.id,
            state: f.state,
            summary: f.summary ?? null,
            clauseId: f.clauseId,
            quote: f.quote,
          })),
      verified
    )
  );

  // Rules: deterministic, offline
  const normalised = normaliseAnswers(input.answers);
  const ctx: RuleContext = {
    clauses: input.clauses,
    matches,
    gaps,
    interview: normalised,
    derived: {
      depositMonths: null,
      monthlyRent: null,
      lockInDays: null,
      noticeTenantDays: null,
      noticeLandlordDays: null,
      durationDays: null,
    },
  };
  const derived = buildDerived(ctx);
  const rules = runRules({ ...ctx, derived });

  return { overview, matches, gaps, rules };
}

import { PROTECTION_IDS } from './rules/protections.js';

const PROTECTION_PLACEHOLDER: Array<{
  id: string;
  state: 'unclear';
  summary: null;
  clauseId: null;
  quote: null;
}> = PROTECTION_IDS.map(id => ({
  id,
  state: 'unclear' as const,
  summary: null,
  clauseId: null,
  quote: null,
}));

/** Local-only mode result (no AI): all gaps unclear, no matches beyond not_covered, rules offline */
export function analyseLocalOnly(answers: InterviewAnswers, clauses: Clause[]): AnalysisResult {
  return analyseDocument({ answers, clauses, localOnly: true });
}
