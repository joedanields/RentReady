/** Ask (Q&A) processor — applies downgrade rules: answered + no verified citation -> not_in_document */

import type { AskResult, Clause, VerifiedQuote } from '../types.js';
import { validateModelAsk } from '../schemas.js';
import { verifyQuote } from '../verify/verifyQuote.js';

export interface AskInput {
  clauses: Clause[];
  modelResponse: unknown;
}

/** Post-rule: answered with zero verified citations -> not_in_document */
export function processAskResponse(input: AskInput): AskResult {
  const validated = validateModelAsk(input.modelResponse);
  const clauseMap = new Map(input.clauses.map(c => [c.id, c]));

  const verified: VerifiedQuote[] = [];
  for (const citation of validated.citations) {
    const clause = clauseMap.get(citation.clauseId);
    if (!clause) continue; // unknown clauseId dropped
    verified.push(verifyQuote(clause.text, citation.quote, citation.clauseId));
  }

  if (validated.status === 'answered') {
    const verifiedCitations = verified.filter(v => v.status !== 'unverified');
    if (verifiedCitations.length === 0) {
      return {
        status: 'not_in_document',
        answer: "I couldn't find support for that in your agreement.",
        citations: [],
        missingInfo: validated.missingInfo,
        suggestedQuestions: validated.suggestedQuestions,
      };
    }
    return { ...validated, citations: verifiedCitations };
  }

  return { ...validated, citations: verified };
}

/** Local-only ask result for when there's no AI */
export function localAskResult(): AskResult {
  return {
    status: 'not_in_document',
    answer:
      'In Demo mode / offline you can still ask questions, but the answer is only available when the analysis has run.',
    citations: [],
    missingInfo: [],
    suggestedQuestions: [],
  };
}
