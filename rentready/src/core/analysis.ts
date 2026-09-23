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
import { runRules } from './rules/rental.js';
import { verifyQuote, evidenceKey } from './verify/verifyQuote.js';
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

/**
 * Verifies every finding's quote against the clause it cites, keyed by clause + quote.
 * Unknown clause ids and over-long quotes get no entry, so they carry no evidence.
 */
export function verifyFindingQuotes(
  clauses: Clause[],
  findings: Array<{ clauseId: string | null; quote: string | null }>
): Map<string, VerifiedQuote | null> {
  const clauseMap = new Map(clauses.map(c => [c.id, c]));
  const verified = new Map<string, VerifiedQuote | null>();
  for (const { clauseId, quote } of findings) {
    if (!clauseId || !quote) continue;
    const key = evidenceKey(clauseId, quote);
    if (verified.has(key)) continue;
    const clause = clauseMap.get(clauseId);
    if (!clause || quote.length > LIMITS.MAX_QUOTE_LENGTH) {
      verified.set(key, null);
      continue;
    }
    verified.set(key, verifyQuote(clause.text, quote, clauseId));
  }
  return verified;
}

/**
 * "Present" needs proof: a protection the model calls present without a verified (or close)
 * quote is shown as unclear, never as covered (CLAUDE.md rule 4).
 */
export function demoteGapEvidence(gaps: GapRow[]): GapRow[] {
  return gaps.map(g =>
    g.state === 'present' && (g.evidence === null || g.evidence.status === 'unverified')
      ? { ...g, state: 'unclear' }
      : g
  );
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

  const verified = verifyFindingQuotes(input.clauses, [...matchFindings, ...protectionFindings]);

  // Model reports, code judges. Without a model read there is nothing to compare the promises
  // against, so no match rows — "not covered" would be a claim nobody checked.
  const matches: MatchRow[] = local ? [] : buildMatchRows(input.answers, matchFindings, verified);

  // Checklist from model findings, or all "unclear" (not yet checked) in local mode.
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

  // Rules: deterministic, offline, read from the agreement text.
  const rules = runRules({
    clauses: input.clauses,
    matches,
    gaps,
    interview: normaliseAnswers(input.answers),
    aiChecked: !local,
  });

  return { mode: local ? 'local' : 'ai', overview, matches, gaps, rules };
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
